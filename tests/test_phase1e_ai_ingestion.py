"""
Automated Pytest Suite for Phase 1E: AI Event Ingestion.
Tests:
1. Mock provider extraction
2. Valid structured output
3. Invalid LLM output
4. Missing required fields
5. Unknown asset handling
6. Invalid event type rejection
7. Invalid subsystem rejection
8. Extraction endpoint (POST /api/v1/events/extract)
9. Event confirmation & persistence (POST /api/v1/events)
10. Risk recalculation after confirmed event
11. No database mutation during extraction preview
12. Gemini provider configuration
13. Missing API key behavior
"""
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.models.risk_assessment import RiskAssessment
from backend.app.schemas.event import (
    EventType,
    Subsystem,
    EventCreate,
    ExtractedEventData
)
from backend.app.services.event_ingestion import EventIngestionService
from backend.app.services.llm import (
    MockProvider,
    GeminiProvider,
    LLMConfigurationError,
    LLMExtractionError,
    get_llm_provider
)
from backend.app.api.deps import get_llm_provider as get_llm_provider_dep
from backend.app.services.risk_engine import RiskEngine
from data.scenarios.seed_data import seed_database


@pytest.fixture(scope="module", autouse=True)
def setup_phase1e_db():
    """Ensure database has clean baseline seed data for Phase 1E tests."""
    seed_database(reset=True)


@pytest.fixture
def db_session():
    """Provide a database session for direct inspection."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module")
def client():
    """Provide FastAPI TestClient with MockProvider override for deterministic preview testing."""
    app.dependency_overrides[get_llm_provider_dep] = lambda: MockProvider()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_llm_provider_dep, None)


# ---------------------------------------------------------------------------
# 1. Mock Provider Extraction
# ---------------------------------------------------------------------------

def test_mock_provider_extraction():
    """Verify MockProvider extracts key structured fields via heuristics."""
    provider = MockProvider()
    report = (
        "Driver reported that BUS-142 required significantly more distance to stop "
        "during heavy rain and the brake pedal felt abnormal."
    )
    extracted = provider.extract_event(report)

    assert extracted["asset_id"] == "BUS-142"
    assert extracted["subsystem"] == "braking"
    assert extracted["event_type"] == "operational_report"
    assert extracted["severity"] == 4
    assert extracted["reporter_role"] == "driver"
    assert extracted["source"] == "driver"
    assert extracted["raw_metadata"] == {"weather": "heavy rain"}
    assert "abnormal" in extracted["description"].lower()


# ---------------------------------------------------------------------------
# 2. Valid Structured Output
# ---------------------------------------------------------------------------

def test_valid_structured_output():
    """Verify ExtractedEventData schema validates clean structured data."""
    valid_payload = {
        "asset_id": "BUS-142",
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 4,
        "description": "Increased stopping distance during heavy rain",
        "source": "Driver Shift Log",
        "reporter_role": "driver",
        "location": "Route 4 - 5th Ave",
        "metadata": {"weather": "heavy rain"}
    }
    validated = ExtractedEventData.model_validate(valid_payload)
    assert validated.asset_id == "BUS-142"
    assert validated.event_type == EventType.OPERATIONAL_REPORT
    assert validated.subsystem == Subsystem.BRAKING
    assert validated.severity == 4
    # Check that metadata was mapped to raw_metadata
    assert validated.raw_metadata == {"weather": "heavy rain"}


# ---------------------------------------------------------------------------
# 3. Invalid LLM Output
# ---------------------------------------------------------------------------

def test_invalid_llm_output(db_session):
    """Verify service gracefully rejects malformed or non-dict LLM output."""
    provider = MockProvider()
    provider.set_mock_error(LLMExtractionError("Model hallucinated invalid tokens"))

    service = EventIngestionService(default_provider=provider)
    result = service.extract_from_report("Some report text", db=db_session, provider=provider)

    assert result.validation_status == "invalid"
    assert result.extracted_event is None
    assert any("AI extraction failed" in err for err in result.validation_errors)


# ---------------------------------------------------------------------------
# 4. Missing Required Fields
# ---------------------------------------------------------------------------

def test_missing_required_fields(db_session):
    """Verify Pydantic validation fails when required fields are missing."""
    provider = MockProvider()
    # Missing 'subsystem' and 'severity'
    provider.set_mock_response({
        "asset_id": "BUS-142",
        "event_type": "operational_report",
        "description": "Brake pedal issue",
        "source": "driver",
        "reporter_role": "driver"
    })

    service = EventIngestionService(default_provider=provider)
    result = service.extract_from_report("Test report", db=db_session, provider=provider)

    assert result.validation_status == "invalid"
    assert result.extracted_event is None
    assert len(result.validation_errors) >= 2
    assert any("subsystem" in err for err in result.validation_errors)
    assert any("severity" in err for err in result.validation_errors)


# ---------------------------------------------------------------------------
# 5. Unknown Asset Handling
# ---------------------------------------------------------------------------

def test_unknown_asset_handling(db_session, client):
    """Verify unknown asset generates validation error and persistence returns 404."""
    provider = MockProvider()
    provider.set_mock_response({
        "asset_id": "BUS-999",  # Not in fleet
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 3,
        "description": "Test brake report for non-existent vehicle",
        "source": "driver",
        "reporter_role": "driver"
    })

    service = EventIngestionService(default_provider=provider)
    result = service.extract_from_report("Test report", db=db_session, provider=provider)

    assert result.validation_status == "invalid"
    assert any("BUS-999" in err for err in result.validation_errors)

    # Persistence of unknown asset via API must return 404
    resp = client.post("/api/v1/events", json={
        "asset_id": "BUS-999",
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 3,
        "description": "Test event",
        "source": "driver",
        "reporter_role": "driver"
    })
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 6. Invalid Event Type Rejection
# ---------------------------------------------------------------------------

def test_invalid_event_type_rejection(db_session):
    """Verify unknown event type outside PREVENT's schema is rejected."""
    provider = MockProvider()
    provider.set_mock_response({
        "asset_id": "BUS-142",
        "event_type": "alien_teleportation",  # Invalid
        "subsystem": "braking",
        "severity": 3,
        "description": "Strange occurrence",
        "source": "driver",
        "reporter_role": "driver"
    })

    service = EventIngestionService(default_provider=provider)
    result = service.extract_from_report("Test report", db=db_session, provider=provider)

    assert result.validation_status == "invalid"
    assert any("event_type" in err for err in result.validation_errors)


# ---------------------------------------------------------------------------
# 7. Invalid Subsystem Rejection
# ---------------------------------------------------------------------------

def test_invalid_subsystem_rejection(db_session):
    """Verify unknown vehicle subsystem is rejected by Pydantic."""
    provider = MockProvider()
    provider.set_mock_response({
        "asset_id": "BUS-142",
        "event_type": "operational_report",
        "subsystem": "hyperdrive_core",  # Invalid
        "severity": 3,
        "description": "Warp drive malfunction",
        "source": "driver",
        "reporter_role": "driver"
    })

    service = EventIngestionService(default_provider=provider)
    result = service.extract_from_report("Test report", db=db_session, provider=provider)

    assert result.validation_status == "invalid"
    assert any("subsystem" in err for err in result.validation_errors)


# ---------------------------------------------------------------------------
# 8. Extraction Endpoint Preview (POST /api/v1/events/extract)
# ---------------------------------------------------------------------------

def test_extraction_endpoint_preview(client):
    """Verify POST /api/v1/events/extract returns 200 with structured preview."""
    payload = {
        "report_text": "Driver reported that BUS-142 required significantly more distance to stop during heavy rain."
    }
    response = client.post("/api/v1/events/extract", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["provider"] in ("mock", "gemini")
    assert data["validation_status"] == "valid"
    assert data["extracted_event"] is not None
    assert data["extracted_event"]["asset_id"] == "BUS-142"
    assert data["extracted_event"]["subsystem"] == "braking"
    assert data["extracted_event"]["severity"] == 4


# ---------------------------------------------------------------------------
# 9. Event Confirmation & Persistence (POST /api/v1/events)
# ---------------------------------------------------------------------------

def test_event_confirmation_and_persistence(client, db_session):
    """Verify POST /api/v1/events persists the event and returns 201 Created."""
    event_count_before = db_session.query(Event).count()

    payload = {
        "asset_id": "BUS-142",
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 4,
        "description": "Confirmed driver report: abnormal brake pedal travel under wet conditions.",
        "source": "driver",
        "reporter_role": "driver",
        "location": "Route 4 - Broadway Crossing",
        "raw_metadata": {"weather": "heavy_rain"}
    }

    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["asset_id"] == "BUS-142"
    assert data["event"]["description"] == payload["description"]
    assert data["event"]["id"] is not None
    assert data["event"]["is_simulated"] is False

    # Check database count strictly incremented
    event_count_after = db_session.query(Event).count()
    assert event_count_after == event_count_before + 1


# ---------------------------------------------------------------------------
# 10. Risk Recalculation After Confirmed Event
# ---------------------------------------------------------------------------

def test_risk_recalculation_after_confirmed_event(client, db_session):
    """Verify deterministic risk engine recalculates risk and returns updated factors."""
    payload = {
        "asset_id": "BUS-204",  # A clean/low risk asset
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 4,
        "description": "Driver noted severe brake fade approaching terminal.",
        "source": "driver",
        "reporter_role": "driver"
    }

    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["asset_id"] == "BUS-204"
    assert "previous_risk_score" in data
    assert "updated_risk_score" in data
    assert "risk_score_delta" in data
    assert "factor_breakdown" in data
    assert "why_risk_changed" in data
    assert len(data["why_risk_changed"]) > 0

    # Risk should have increased or remained valid deterministic score
    assert data["updated_risk_score"] >= data["previous_risk_score"]

    # Verify matching risk assessment in database
    latest_assessment = (
        db_session.query(RiskAssessment)
        .filter(RiskAssessment.asset_id == "BUS-204")
        .order_by(RiskAssessment.computed_at.desc())
        .first()
    )
    assert latest_assessment is not None
    assert round(latest_assessment.score, 1) == round(data["updated_risk_score"], 1)


# ---------------------------------------------------------------------------
# 11. No Database Mutation During Extraction Preview
# ---------------------------------------------------------------------------

def test_no_database_mutation_during_extraction_preview(client, db_session):
    """Verify POST /api/v1/events/extract is strictly read-only with zero DB mutations."""
    events_count_before = db_session.query(Event).count()
    assessments_count_before = db_session.query(RiskAssessment).count()

    # Call preview multiple times
    for _ in range(5):
        resp = client.post("/api/v1/events/extract", json={
            "report_text": "Driver reported that BUS-142 required significantly more distance to stop."
        })
        assert resp.status_code == 200

    events_count_after = db_session.query(Event).count()
    assessments_count_after = db_session.query(RiskAssessment).count()

    assert events_count_after == events_count_before
    assert assessments_count_after == assessments_count_before


# ---------------------------------------------------------------------------
# 12. Gemini Provider Configuration & Factory Selection
# ---------------------------------------------------------------------------

def test_gemini_provider_configuration(monkeypatch):
    """Verify GeminiProvider initializes correctly when API key is provided and factory works."""
    provider = GeminiProvider(api_key="mock-gemini-key-123", model_name="gemini-2.5-flash")
    assert provider.provider_name == "gemini"
    assert provider.model_name == "gemini-2.5-flash"
    assert provider.api_key == "mock-gemini-key-123"

    # Verify factory selection with explicit mock provider
    mock_prov = get_llm_provider("mock")
    assert isinstance(mock_prov, MockProvider)
    assert mock_prov.provider_name == "mock"

    # Verify factory selection with gemini provider and valid key
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "mock-gemini-key-123")
    gemini_prov = get_llm_provider("gemini")
    assert isinstance(gemini_prov, GeminiProvider)
    assert gemini_prov.provider_name == "gemini"


# ---------------------------------------------------------------------------
# 13. Missing API Key Behavior
# ---------------------------------------------------------------------------

def test_missing_api_key_behavior(monkeypatch):
    """Verify GeminiProvider raises LLMConfigurationError when API key is absent or placeholder."""
    # Test with explicitly None
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)

    with pytest.raises(LLMConfigurationError) as exc_info:
        GeminiProvider(api_key=None)

    assert "GEMINI_API_KEY" in str(exc_info.value)
    assert "mock" in str(exc_info.value).lower()

    # Test with placeholder string '<USER WILL INSERT THIS LOCALLY>'
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "<USER WILL INSERT THIS LOCALLY>")
    with pytest.raises(LLMConfigurationError) as exc_info_placeholder:
        GeminiProvider(api_key=None)
    assert "Gemini API key is not configured" in str(exc_info_placeholder.value)


# ---------------------------------------------------------------------------
# 14. Invalid Extraction / Event Payload Cannot Be Persisted
# ---------------------------------------------------------------------------

def test_invalid_event_cannot_be_persisted(client, db_session):
    """Verify malformed or schema-invalid event payloads are rejected with 422 and cannot be persisted."""
    events_count_before = db_session.query(Event).count()

    # 1. Invalid severity (> 5)
    resp = client.post("/api/v1/events", json={
        "asset_id": "BUS-142",
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 9,
        "description": "Invalid severity test",
        "source": "driver",
        "reporter_role": "driver"
    })
    assert resp.status_code == 422

    # 2. Invalid subsystem
    resp = client.post("/api/v1/events", json={
        "asset_id": "BUS-142",
        "event_type": "operational_report",
        "subsystem": "anti_gravity_drive",
        "severity": 3,
        "description": "Invalid subsystem test",
        "source": "driver",
        "reporter_role": "driver"
    })
    assert resp.status_code == 422

    # 3. Invalid event type
    resp = client.post("/api/v1/events", json={
        "asset_id": "BUS-142",
        "event_type": "quantum_fluctuation",
        "subsystem": "braking",
        "severity": 3,
        "description": "Invalid event type test",
        "source": "driver",
        "reporter_role": "driver"
    })
    assert resp.status_code == 422

    # 4. Missing required field (description)
    resp = client.post("/api/v1/events", json={
        "asset_id": "BUS-142",
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 3,
        "source": "driver",
        "reporter_role": "driver"
    })
    assert resp.status_code == 422

    # Verify database was not modified
    events_count_after = db_session.query(Event).count()
    assert events_count_after == events_count_before
