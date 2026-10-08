"""
Automated Pytest Suite for Authoritative Asset ID Ingestion.

Tests:
1. Extraction with authoritative asset_id and narrative without asset ID:
   Request:
     asset_id = "BUS-142"
     report_text = "Driver reports severe brake pedal resistance during operation"
   Expected:
     Status 200
     extracted_event.asset_id == "BUS-142"
     extracted_event.subsystem == "braking"
     extracted_event.severity >= 4
     validation_status == "valid"
     No validation error.

2. LLM returns asset_id=null while request asset_id is BUS-142:
   Expected:
     extracted_event.asset_id == "BUS-142"

3. LLM returns a different asset_id while request asset_id is BUS-142:
   Expected:
     extracted_event.asset_id == "BUS-142"
     The system-provided asset ID wins over LLM output.

4. Existing extraction tests continue passing (without explicit asset_id in request).

5. Confirming the event persists it against BUS-142 and recalculates BUS-142's risk.
"""
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.models.risk_assessment import RiskAssessment
from backend.app.api.deps import get_llm_provider as get_llm_provider_dep
from backend.app.services.event_ingestion import EventIngestionService
from backend.app.services.llm import MockProvider
from data.scenarios.seed_data import seed_database


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure clean baseline database before tests."""
    seed_database(reset=True)


@pytest.fixture
def db_session():
    """Provide a database session."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    """Provide FastAPI TestClient with MockProvider override."""
    app.dependency_overrides[get_llm_provider_dep] = lambda: MockProvider()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_llm_provider_dep, None)


# ---------------------------------------------------------------------------
# Test 1: Authoritative asset_id with report text lacking explicit asset ID
# ---------------------------------------------------------------------------

def test_1_authoritative_asset_id_extraction_without_asset_in_text(client):
    """
    When the report narrative does NOT contain an asset identifier, but
    asset_id is provided in EventExtractRequest, extraction must succeed with 200
    and use the authoritative asset_id.
    """
    payload = {
        "asset_id": "BUS-142",
        "report_text": "Driver reports severe brake pedal resistance during operation"
    }

    response = client.post("/api/v1/events/extract", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["validation_status"] == "valid"
    assert data["validation_errors"] is None or len(data["validation_errors"]) == 0

    extracted = data["extracted_event"]
    assert extracted is not None
    assert extracted["asset_id"] == "BUS-142"
    assert extracted["subsystem"] == "braking"
    assert extracted["severity"] >= 4


# ---------------------------------------------------------------------------
# Test 2: LLM returns asset_id=null while request asset_id is BUS-142
# ---------------------------------------------------------------------------

def test_2_llm_returns_null_asset_id_overridden_by_request(db_session):
    """
    Mock an LLM that returns asset_id=None. The service must inject request.asset_id
    before Pydantic validation, resulting in valid extraction.
    """
    mock_provider = MagicMock(spec=MockProvider)
    mock_provider.provider_name = "mock_test"
    mock_provider.extract_event.return_value = {
        "asset_id": None,
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 4,
        "description": "Driver reports severe brake pedal resistance during operation",
        "source": "driver",
        "reporter_role": "driver",
        "location": None,
        "raw_metadata": None
    }

    service = EventIngestionService(default_provider=mock_provider)
    result = service.extract_from_report(
        report_text="Driver reports severe brake pedal resistance during operation",
        asset_id="BUS-142",
        db=db_session,
        provider=mock_provider
    )

    assert result.validation_status == "valid"
    assert result.extracted_event is not None
    assert result.extracted_event.asset_id == "BUS-142"
    assert result.extracted_event.subsystem == "braking"


# ---------------------------------------------------------------------------
# Test 3: LLM returns a different asset_id while request asset_id is BUS-142
# ---------------------------------------------------------------------------

def test_3_system_provided_asset_id_wins_over_llm_inference(db_session):
    """
    If the LLM returns an inferred asset ID (e.g. TRK-089), but the request specifies
    authoritative asset_id BUS-142, the request asset ID must win.
    """
    mock_provider = MagicMock(spec=MockProvider)
    mock_provider.provider_name = "mock_test"
    mock_provider.extract_event.return_value = {
        "asset_id": "TRK-089",  # LLM inferred/guessed TRK-089
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 4,
        "description": "Brake caliper pressure low",
        "source": "driver",
        "reporter_role": "driver"
    }

    service = EventIngestionService(default_provider=mock_provider)
    result = service.extract_from_report(
        report_text="Brake caliper pressure low",
        asset_id="BUS-142",
        db=db_session,
        provider=mock_provider
    )

    assert result.validation_status == "valid"
    assert result.extracted_event is not None
    assert result.extracted_event.asset_id == "BUS-142"


# ---------------------------------------------------------------------------
# Test 4: Extraction without explicit asset_id when text contains asset ID
# ---------------------------------------------------------------------------

def test_4_existing_extraction_without_explicit_asset_id_still_works(client):
    """
    Verify backwards compatibility: when request.asset_id is None, extraction
    extracts the asset ID from text if present.
    """
    payload = {
        "report_text": "Driver reported that BUS-142 required significantly more distance to stop during heavy rain and the brake pedal felt abnormal."
    }

    response = client.post("/api/v1/events/extract", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["validation_status"] == "valid"
    assert data["extracted_event"]["asset_id"] == "BUS-142"


# ---------------------------------------------------------------------------
# Test 5: Confirming the event persists it against BUS-142 and recalculates risk
# ---------------------------------------------------------------------------

def test_5_confirmation_persists_against_bus142_and_recalculates_risk(client, db_session):
    """
    Verify confirming the extracted event persists it against BUS-142 in DB
    and recalculates risk score accordingly.
    """
    events_count_before = db_session.query(Event).filter(Event.asset_id == "BUS-142").count()

    # Ingest confirmed event with authoritative asset_id
    payload = {
        "asset_id": "BUS-142",
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 4,
        "description": "Driver reports severe brake pedal resistance during operation",
        "source": "driver",
        "reporter_role": "driver"
    }

    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["asset_id"] == "BUS-142"
    assert data["event"]["asset_id"] == "BUS-142"
    assert data["previous_risk_score"] == 82.0
    assert data["updated_risk_score"] > 82.0
    assert len(data["why_risk_changed"]) > 0

    # Verify database persistence
    events_count_after = db_session.query(Event).filter(Event.asset_id == "BUS-142").count()
    assert events_count_after == events_count_before + 1

    persisted_event = db_session.query(Event).filter(
        Event.asset_id == "BUS-142",
        Event.description == payload["description"]
    ).first()
    assert persisted_event is not None
    assert persisted_event.subsystem == "braking"
    assert persisted_event.severity == 4
