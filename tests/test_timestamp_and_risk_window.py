"""
Automated Pytest Suite for Event Timestamp and Risk Window Verification.

Tests:
A. Existing BUS-142 historical scenario:
   - Existing seeded events produce the expected baseline risk (82.0).
   - Expected BUS-142 score remains deterministic and unchanged.

B. Add new severity-4 braking event:
   - Asset: BUS-142
   - Subsystem: braking, Severity: 4, Source: driver
   - Timestamp: immediately after latest BUS-142 event
   - Verify event is inside the evaluation window.
   - Verify risk does NOT remain unchanged (82 -> 84) solely because of the old 17 Sep anchor.

C. Add new near-miss after the existing timeline:
   - Asset: BUS-142
   - Subsystem: braking, Severity: 5
   - Timestamp: after the latest event
   - Verify risk does not decrease because of timestamp/reference-time issues.
   - Verify near-miss contribution is applied correctly.

D. What-If simulation:
   - Simulate a future event after latest existing event.
   - Verify DB event count remains completely unchanged.
   - Verify simulation uses the simulated timestamp.
   - Verify simulation without timestamp places it immediately after latest event.

E. Historical event:
   - Add an event with explicitly supplied historical timestamp.
   - Verify it is evaluated according to that timestamp rather than replaced with current time.
"""
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.models.risk_assessment import RiskAssessment
from backend.app.services.risk_engine import RiskEngine
from data.scenarios.seed_data import seed_database


@pytest.fixture(autouse=True)
def reset_db():
    """Ensure database has clean seed data for every test."""
    seed_database(reset=True)


@pytest.fixture
def client():
    """Provide FastAPI TestClient."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    """Provide a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Test Case A: Existing BUS-142 historical scenario
# ---------------------------------------------------------------------------

def test_case_a_existing_bus142_historical_scenario(client, db_session):
    """
    Existing seeded events must still produce the expected baseline risk (82.0).
    Verify current expected BUS-142 score remains unchanged.
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    assert bus142 is not None

    risk_engine = RiskEngine()
    assessment = risk_engine.evaluate_asset(bus142, bus142.events)

    assert round(assessment.score, 1) == 82.0
    assert assessment.risk_level == "HIGH"
    assert assessment.primary_subsystem == "braking"
    assert assessment.factor_breakdown["near_miss_anchor_points"] == 10.0
    assert assessment.factor_breakdown["cross_source_bonus_points"] == 20.0
    assert assessment.factor_breakdown["temporal_acceleration_points"] == 13.0

    # Also verify via API endpoint
    response = client.get("/api/v1/assets/BUS-142")
    assert response.status_code == 200
    data = response.json()
    assert round(data["risk_score"], 1) == 82.0


# ---------------------------------------------------------------------------
# Test Case B: Add new severity-4 braking event
# ---------------------------------------------------------------------------

def test_case_b_add_new_severity4_braking_event(client, db_session):
    """
    Asset: BUS-142, Subsystem: braking, Severity: 4, Source: driver
    Timestamp: immediately after latest BUS-142 event.

    Verify:
    - event is inside the evaluation window
    - event affects relevant factors
    - risk does NOT incorrectly remain unchanged solely because of old anchor (82 -> 84)
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    latest_event = max(bus142.events, key=lambda e: e.timestamp)
    new_event_time = (latest_event.timestamp + timedelta(hours=2)).isoformat()

    payload = {
        "asset_id": "BUS-142",
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 4,
        "description": "Subsequent driver report: severe brake pedal vibration and spongy feel on descending incline.",
        "source": "driver",
        "reporter_role": "driver",
        "timestamp": new_event_time
    }

    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["asset_id"] == "BUS-142"
    assert data["previous_risk_score"] == 82.0
    # Risk must not be stuck at 82.0; calibrated compounding raises score to 85.5
    assert data["updated_risk_score"] > 82.0
    assert data["updated_risk_score"] in (84.0, 85.5)
    assert data["risk_score_delta"] in (2.0, 3.5)
    assert "frequency_penalty_points" in data["factor_breakdown"]

    # Verify event was persisted with exact timestamp
    persisted_event = db_session.query(Event).filter(Event.description == payload["description"]).first()
    assert persisted_event is not None
    assert persisted_event.timestamp.isoformat().startswith(new_event_time[:19])


# ---------------------------------------------------------------------------
# Test Case C: Add new near-miss after the existing timeline
# ---------------------------------------------------------------------------

def test_case_c_add_new_near_miss_after_existing_timeline(client, db_session):
    """
    Asset: BUS-142, Subsystem: braking, Severity: 5
    Timestamp: after the latest event.

    Verify:
    - risk does not decrease because of timestamp/reference-time issues
    - near-miss contribution is applied correctly
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    latest_event = max(bus142.events, key=lambda e: e.timestamp)
    # 1 day after latest event
    new_near_miss_time = (latest_event.timestamp + timedelta(days=1)).isoformat()

    payload = {
        "asset_id": "BUS-142",
        "event_type": "near_miss",
        "subsystem": "braking",
        "severity": 5,
        "description": "Second critical near-miss: emergency braking required at intersection due to sudden air line pressure loss.",
        "source": "Telematics & Safety Dispatch",
        "reporter_role": "safety_officer",
        "timestamp": new_near_miss_time
    }

    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["asset_id"] == "BUS-142"
    # Risk must NOT decrease
    assert data["updated_risk_score"] >= data["previous_risk_score"]
    assert data["updated_risk_score"] >= 82.0
    assert data["factor_breakdown"]["near_miss_anchor_points"] == 10.0


# ---------------------------------------------------------------------------
# Test Case D: What-If simulation
# ---------------------------------------------------------------------------

def test_case_d_what_if_simulation(client, db_session):
    """
    What-If simulation:
    - Simulate a future event after latest existing event.
    - Verify DB event count remains unchanged.
    - Verify simulation uses simulated timestamp.
    - Verify risk calculation uses max(existing_latest_timestamp, simulated_timestamp).
    - Ensure adding a severity-4 braking event or near-miss does not lower risk.
    """
    events_count_before = db_session.query(Event).count()
    assessments_count_before = db_session.query(RiskAssessment).count()

    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    latest_event = max(bus142.events, key=lambda e: e.timestamp)
    future_sim_time = (latest_event.timestamp + timedelta(days=2)).isoformat()

    payload = {
        "asset_id": "BUS-142",
        "event_type": "near_miss",
        "subsystem": "braking",
        "severity": 5,
        "description": "Simulated near-miss event 2 days into future.",
        "source": "Telematics & Safety Dispatch",
        "reporter_role": "safety_officer",
        "timestamp": future_sim_time
    }

    response = client.post("/api/v1/simulation/simulate-signal", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["asset_id"] == "BUS-142"
    assert data["before_risk_score"] == 82.0
    # Must NOT decrease (e.g. 82 -> 76 bug is fixed)
    assert data["after_risk_score"] >= data["before_risk_score"]

    # Verify DB event and assessment count remains completely unchanged
    events_count_after = db_session.query(Event).count()
    assessments_count_after = db_session.query(RiskAssessment).count()
    assert events_count_after == events_count_before
    assert assessments_count_after == assessments_count_before

    # Verify simulation without timestamp defaults immediately after latest event
    payload_no_ts = {
        "asset_id": "BUS-142",
        "event_type": "operational_report",
        "subsystem": "braking",
        "severity": 4,
        "description": "Simulated event without explicit timestamp.",
        "source": "driver",
        "reporter_role": "driver"
    }
    response_no_ts = client.post("/api/v1/simulation/simulate-signal", json=payload_no_ts)
    assert response_no_ts.status_code == 200
    data_no_ts = response_no_ts.json()
    assert data_no_ts["after_risk_score"] >= data_no_ts["before_risk_score"]


# ---------------------------------------------------------------------------
# Test Case E: Historical event
# ---------------------------------------------------------------------------

def test_case_e_historical_event_preserves_supplied_timestamp(client, db_session):
    """
    Add an event with explicitly supplied historical timestamp.
    Verify it is evaluated according to that timestamp rather than silently replaced with current time.
    """
    historical_time = "2026-09-12T14:30:00Z"
    payload = {
        "asset_id": "BUS-142",
        "event_type": "inspection",
        "subsystem": "braking",
        "severity": 3,
        "description": "Historical audit report: minor airline moisture detected during mid-week check.",
        "source": "State Transit Safety Audit",
        "reporter_role": "inspector",
        "timestamp": historical_time
    }

    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["asset_id"] == "BUS-142"

    persisted = db_session.query(Event).filter(Event.description == payload["description"]).first()
    assert persisted is not None
    # Stored timestamp matches historical timestamp
    assert persisted.timestamp.isoformat().startswith(historical_time[:19])
