"""
Automated Pytest Suite for Phase 1C: FastAPI API Layer.
Tests:
1. GET /health returns 200.
2. GET /api/v1/fleet/overview returns 200.
3. Fleet overview contains all 8 seeded assets and correct summary counts.
4. BUS-142 appears with its calculated risk information (~82 risk score, HIGH, RAPIDLY_ESCALATING).
5. GET /api/v1/assets/BUS-142 returns 200.
6. BUS-142 contains risk score, confidence, trend, factor breakdown, evidence graph, recommended action.
7. GET /api/v1/assets/BUS-142/timeline returns chronological events.
8. GET for a nonexistent asset returns 404 with clear error message.
9. POST /api/v1/simulation/simulate-signal works and returns 200.
10. Simulation produces a changed score and factor shifts when a hypothetical event is added.
11. Simulation does NOT modify the database (event and asset counts identical before and after).
12. Invalid simulation input returns 422 Unprocessable Entity.
13. OpenAPI schema /openapi.json returns 200 with valid paths and schemas.
"""
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from data.scenarios.seed_data import seed_database


@pytest.fixture(scope="module", autouse=True)
def setup_api_db():
    """Ensure database has clean seed data for API tests."""
    seed_database(reset=True)


@pytest.fixture(scope="module")
def client():
    """Provide FastAPI TestClient."""
    with TestClient(app) as test_client:
        yield test_client


# ---------------------------------------------------------------------------
# 1. Health Check
# ---------------------------------------------------------------------------

def test_health_check_returns_200(client):
    """Verify that GET /health returns 200 OK and status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# 2. Fleet Overview Endpoints
# ---------------------------------------------------------------------------

def test_fleet_overview_returns_200_and_kpis(client):
    """
    Verify GET /api/v1/fleet/overview returns 200, contains 8 assets,
    and classifies BUS-142 as requiring attention.
    """
    response = client.get("/api/v1/fleet/overview")
    assert response.status_code == 200
    data = response.json()

    assert data["total_assets"] == 8
    assert data["high_risk_count"] >= 1
    assert data["low_risk_count"] >= 4
    assert len(data["assets"]) == 8

    # Verify risk distribution object
    dist = data["risk_distribution"]
    assert "critical" in dist
    assert "high" in dist
    assert "medium" in dist
    assert "low" in dist
    assert dist["high"] == data["high_risk_count"]

    # Verify BUS-142 is in assets requiring attention
    attention_ids = [a["asset_id"] for a in data["assets_requiring_attention"]]
    assert "BUS-142" in attention_ids


def test_fleet_overview_bus142_intelligence(client):
    """
    Verify that BUS-142 in fleet overview contains dynamically calculated risk,
    confidence, level, trend, and recommended action.
    """
    response = client.get("/api/v1/fleet/overview")
    assert response.status_code == 200
    data = response.json()

    bus142_summary = next((a for a in data["assets"] if a["asset_id"] == "BUS-142"), None)
    assert bus142_summary is not None
    assert 78.0 <= bus142_summary["risk_score"] <= 84.0
    assert bus142_summary["confidence"] == 100.0
    assert bus142_summary["risk_level"] == "HIGH"
    assert bus142_summary["trend"] in ("RAPIDLY_ESCALATING", "ESCALATING")
    assert bus142_summary["primary_subsystem"] == "braking"
    assert "PRIORITY SAFETY ACTION" in bus142_summary["recommended_action"]
    assert bus142_summary["total_events_count"] == 5


# ---------------------------------------------------------------------------
# 3. Asset Detail Dossier Endpoints
# ---------------------------------------------------------------------------

def test_asset_detail_bus142_returns_complete_intelligence(client):
    """
    Verify GET /api/v1/assets/BUS-142 returns 200 and complete dossier with
    factor breakdown, confidence breakdown, narrative, and evidence graph.
    """
    response = client.get("/api/v1/assets/BUS-142")
    assert response.status_code == 200
    data = response.json()

    # Asset metadata
    asset_info = data["asset"]
    assert asset_info["asset_id"] == "BUS-142"
    assert asset_info["asset_type"] == "bus"
    assert asset_info["status"] == "active"

    # Evaluated scores
    assert 78.0 <= data["risk_score"] <= 84.0
    assert data["confidence"] == 100.0
    assert data["risk_level"] == "HIGH"
    assert data["primary_subsystem"] == "braking"

    # Factor waterfall
    fb = data["factor_breakdown"]
    assert fb["base_severity_points"] > 0
    assert fb["frequency_penalty_points"] > 0
    assert fb["cross_source_bonus_points"] >= 16.0
    assert fb["temporal_acceleration_points"] > 0
    assert fb["near_miss_anchor_points"] == 10.0

    # Confidence breakdown
    cb = data["confidence_breakdown"]
    assert cb["source_diversity_points"] > 0
    assert cb["evidence_volume_points"] > 0

    # Evidence graph
    graph = data["evidence_graph"]
    assert len(graph["nodes"]) >= 8
    assert len(graph["edges"]) >= 10
    node_types = {n["type"] for n in graph["nodes"]}
    assert "asset" in node_types
    assert "subsystem" in node_types
    assert "event" in node_types
    assert "risk_factor" in node_types

    # Subsystems breakdown
    assert "braking" in data["subsystems_breakdown"]
    braking_sub = data["subsystems_breakdown"]["braking"]
    assert braking_sub["event_count"] == 5
    assert braking_sub["distinct_sources_count"] == 5

    # Narrative
    assert "Braking System" in data["explanation_narrative"]


def test_asset_detail_nonexistent_returns_404(client):
    """Verify that requesting a nonexistent asset returns HTTP 404."""
    response = client.get("/api/v1/assets/BUS-DOES-NOT-EXIST")
    assert response.status_code == 404
    error = response.json()
    assert "detail" in error
    assert "BUS-DOES-NOT-EXIST" in error["detail"]


# ---------------------------------------------------------------------------
# 4. Asset Timeline Endpoints
# ---------------------------------------------------------------------------

def test_asset_timeline_returns_chronological_events(client):
    """
    Verify GET /api/v1/assets/BUS-142/timeline returns 5 chronological events.
    """
    response = client.get("/api/v1/assets/BUS-142/timeline")
    assert response.status_code == 200
    data = response.json()

    assert data["asset_id"] == "BUS-142"
    assert data["total_events"] == 5
    events = data["events"]
    assert len(events) == 5

    # Verify chronological ascending order
    timestamps = [e["timestamp"] for e in events]
    assert timestamps == sorted(timestamps)

    # Verify event fields
    first_ev = events[0]
    assert first_ev["subsystem"] == "braking"
    assert first_ev["event_type"] == "maintenance"
    assert first_ev["severity"] == 2
    assert first_ev["reporter_role"] == "technician"

    last_ev = events[-1]
    assert last_ev["event_type"] == "near_miss"
    assert last_ev["severity"] == 5
    assert last_ev["reporter_role"] == "safety_officer"


def test_asset_timeline_nonexistent_returns_404(client):
    """Verify that requesting timeline for a nonexistent asset returns HTTP 404."""
    response = client.get("/api/v1/assets/BUS-GHOST/timeline")
    assert response.status_code == 404
    assert "BUS-GHOST" in response.json()["detail"]


# ---------------------------------------------------------------------------
# 5. What-If Simulation API
# ---------------------------------------------------------------------------

def test_simulate_signal_produces_changed_score(client):
    """
    Verify POST /api/v1/simulation/simulate-signal calculates before/after shifts.
    Adding a critical near-miss to medium-risk BUS-091 should increase score and trigger factor deltas.
    """
    payload = {
        "asset_id": "BUS-091",
        "event_type": "near_miss",
        "subsystem": "doors_body",
        "severity": 5,
        "description": "Passenger arm caught in closing rear exit door as vehicle engaged drive",
        "source": "Telematics Incident Pad",
        "reporter_role": "safety_officer",
        "location": "Route 9 - Downtown Staging"
    }

    response = client.post("/api/v1/simulation/simulate-signal", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["asset_id"] == "BUS-091"
    assert data["after_risk_score"] > data["before_risk_score"]
    assert data["risk_score_delta"] > 0
    assert "Risk increased" in data["explanation_of_change"]

    # Verify factor breakdown delta
    f_delta = data["factor_breakdown_delta"]
    assert f_delta["near_miss_anchor_points"] == 10.0
    assert f_delta["base_severity_points"] > 0

    # Verify simulated assessment nested structure
    sim_assessment = data["simulated_assessment"]
    assert sim_assessment["asset_id"] == "BUS-091"
    assert sim_assessment["score"] == data["after_risk_score"]


def test_simulation_does_not_modify_database(client):
    """
    CRITICAL requirement: Verify that calling simulate-signal leaves
    persistent database state completely unchanged.
    """
    session = SessionLocal()
    try:
        initial_event_count = session.query(Event).count()
        initial_bus091_events = session.query(Event).filter(Event.asset_id == "BUS-091").count()
        initial_asset_count = session.query(Asset).count()
    finally:
        session.close()

    # Call simulation
    payload = {
        "asset_id": "BUS-091",
        "event_type": "complaint",
        "subsystem": "doors_body",
        "severity": 4,
        "description": "Door actuator jammed again during boarding",
        "source": "Driver Shift Incident Pad",
        "reporter_role": "driver"
    }
    response = client.post("/api/v1/simulation/simulate-signal", json=payload)
    assert response.status_code == 200

    # Check database counts again
    session = SessionLocal()
    try:
        post_event_count = session.query(Event).count()
        post_bus091_events = session.query(Event).filter(Event.asset_id == "BUS-091").count()
        post_asset_count = session.query(Asset).count()
    finally:
        session.close()

    assert post_event_count == initial_event_count, "Database event count must NOT change after simulation"
    assert post_bus091_events == initial_bus091_events, "Asset event count must NOT change after simulation"
    assert post_asset_count == initial_asset_count, "Asset count must NOT change after simulation"


def test_simulate_signal_nonexistent_asset_returns_404(client):
    """Verify that simulating on a nonexistent asset returns HTTP 404."""
    payload = {
        "asset_id": "BUS-NONEXISTENT",
        "event_type": "complaint",
        "subsystem": "braking",
        "severity": 3,
        "description": "Brake squeal complaint",
        "source": "App",
        "reporter_role": "passenger"
    }
    response = client.post("/api/v1/simulation/simulate-signal", json=payload)
    assert response.status_code == 404
    assert "BUS-NONEXISTENT" in response.json()["detail"]


def test_simulate_signal_invalid_input_returns_422(client):
    """Verify that invalid payloads (e.g. severity 10, empty description) return HTTP 422."""
    invalid_payload = {
        "asset_id": "BUS-142",
        "event_type": "complaint",
        "subsystem": "braking",
        "severity": 10,  # Invalid: max is 5
        "description": "",  # Invalid: min_length is 3
        "source": "X",
        "reporter_role": "passenger"
    }
    response = client.post("/api/v1/simulation/simulate-signal", json=invalid_payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# 6. OpenAPI Documentation Availability
# ---------------------------------------------------------------------------

def test_openapi_docs_available(client):
    """Verify that /openapi.json and /docs are automatically generated and reachable."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "openapi" in schema
    assert "paths" in schema
    assert "/api/v1/fleet/overview" in schema["paths"]
    assert "/api/v1/assets/{asset_id}" in schema["paths"]
    assert "/api/v1/assets/{asset_id}/timeline" in schema["paths"]
    assert "/api/v1/simulation/simulate-signal" in schema["paths"]
    assert "/health" in schema["paths"]

    # Verify Swagger UI HTML is rendered
    docs_response = client.get("/docs")
    assert docs_response.status_code == 200
    assert "swagger-ui" in docs_response.text.lower()
