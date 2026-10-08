"""
Automated Pytest Suite for Phase 2:
- Risk Trajectory / Risk History endpoint and derivation
- "Why Now?" Intelligence synthesis
- Edge cases: empty event history, single-event assets, nonexistent assets (404)
- Verification that historical scores and factor contributions come directly from the deterministic risk engine
"""
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from backend.app.db.session import SessionLocal
from backend.app.main import app
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.services.risk_engine import RiskEngine
from backend.app.services.why_now_analyzer import WhyNowAnalyzer
from data.scenarios.seed_data import seed_database


@pytest.fixture(scope="module", autouse=True)
def reset_seed():
    """Ensure database has canonical seed data."""
    seed_database(reset=True)


@pytest.fixture
def db_session():
    """Provide database session for tests."""
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def risk_engine():
    """Provide default RiskEngine instance."""
    return RiskEngine()


@pytest.fixture
def client():
    return TestClient(app)


def test_risk_history_returns_chronological_events(client):
    """Verify GET /api/v1/assets/{asset_id}/risk-history returns chronological points."""
    response = client.get("/api/v1/assets/BUS-142/risk-history")
    assert response.status_code == 200
    data = response.json()

    assert data["asset_id"] == "BUS-142"
    assert data["total_points"] >= 5
    assert len(data["points"]) == data["total_points"]
    assert data["trend"] in ("RAPIDLY_ESCALATING", "ESCALATING")
    assert 78.0 <= data["current_risk_score"] <= 84.0

    # Verify chronological order
    timestamps = [p["timestamp"] for p in data["points"]]
    for i in range(1, len(timestamps)):
        assert timestamps[i] >= timestamps[i - 1], f"Point {i} is not chronologically after {i-1}"


def test_historical_risk_values_derived_from_actual_event_data(client, db_session, risk_engine):
    """
    Verify historical risk values are computed by replaying actual events
    through the deterministic risk engine, not hardcoded.
    """
    response = client.get("/api/v1/assets/BUS-142/risk-history")
    assert response.status_code == 200
    data = response.json()

    asset = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    assert asset is not None
    sorted_events = sorted(asset.events, key=lambda e: e.timestamp)

    # Replay manually and compare each point
    for idx, point in enumerate(data["points"]):
        sub_events = sorted_events[: idx + 1]
        ev = sorted_events[idx]
        eval_result = risk_engine.evaluate_asset(asset, sub_events, anchor_time=ev.timestamp)

        assert point["event_id"] == str(ev.id)
        assert point["severity"] == ev.severity
        assert point["event_type"] == ev.event_type
        assert point["risk_score"] == eval_result.score

    # Latest point must equal final risk score
    assert data["points"][-1]["risk_score"] == data["current_risk_score"]


def test_empty_event_history_handled_safely(client, db_session):
    """Verify that an asset with 0 events handles risk history and why-now gracefully without error."""
    # Create temporary asset with 0 events
    empty_asset = Asset(
        asset_id="BUS-EMPTY",
        asset_type="bus",
        make_model="Test Fleet Vehicle",
        depot_location="Test Depot",
        criticality="low",
        status="active"
    )
    db_session.add(empty_asset)
    db_session.commit()

    try:
        # 1. Risk history endpoint
        res_history = client.get("/api/v1/assets/BUS-EMPTY/risk-history")
        assert res_history.status_code == 200
        h_data = res_history.json()
        assert h_data["total_points"] == 0
        assert h_data["points"] == []
        assert h_data["trend"] == "STABLE"
        assert h_data["current_risk_score"] == 0.0
        assert h_data["current_risk_level"] == "LOW"

        # 2. Why now endpoint
        res_why = client.get("/api/v1/assets/BUS-EMPTY/why-now")
        assert res_why.status_code == 200
        w_data = res_why.json()
        assert w_data["asset_id"] == "BUS-EMPTY"
        assert w_data["total_signals_count"] == 0
        assert w_data["distinct_sources_count"] == 0
        assert w_data["signals"] == []
        assert w_data["current_risk_score"] == 0.0
        assert w_data["risk_level"] == "LOW"
        assert "normal operational baseline" in w_data["headline"]

        # 3. Full dossier endpoint
        res_dossier = client.get("/api/v1/assets/BUS-EMPTY")
        assert res_dossier.status_code == 200
        d_data = res_dossier.json()
        assert d_data["why_now"] is not None
        assert d_data["risk_history"] is not None
    finally:
        db_session.delete(empty_asset)
        db_session.commit()


def test_single_event_asset_handled_safely(client, db_session):
    """Verify that an asset with a single event is handled safely with valid trajectory and why-now."""
    single_asset = Asset(
        asset_id="BUS-SINGLE",
        asset_type="bus",
        make_model="Test Vehicle",
        depot_location="Test Depot",
        criticality="medium",
        status="active"
    )
    db_session.add(single_asset)
    db_session.flush()

    single_ev = Event(
        asset_id="BUS-SINGLE",
        timestamp=datetime(2026, 9, 10, 10, 0, 0, tzinfo=timezone.utc),
        event_type="maintenance",
        subsystem="doors",
        severity=2,
        description="Routine door seal inspection.",
        source="Workshop",
        reporter_role="technician"
    )
    db_session.add(single_ev)
    db_session.commit()

    try:
        # Risk history
        res_history = client.get("/api/v1/assets/BUS-SINGLE/risk-history")
        assert res_history.status_code == 200
        h_data = res_history.json()
        assert h_data["total_points"] == 1
        assert len(h_data["points"]) == 1
        assert h_data["points"][0]["severity"] == 2
        assert h_data["points"][0]["risk_score"] > 0

        # Why now
        res_why = client.get("/api/v1/assets/BUS-SINGLE/why-now")
        assert res_why.status_code == 200
        w_data = res_why.json()
        assert w_data["total_signals_count"] == 1
        assert w_data["distinct_sources_count"] == 1
        assert len(w_data["signals"]) >= 1
    finally:
        db_session.delete(single_ev)
        db_session.delete(single_asset)
        db_session.commit()


def test_why_now_returns_correct_signal_counts(client):
    """Verify GET /api/v1/assets/BUS-142/why-now returns structured indicators matching event evidence."""
    response = client.get("/api/v1/assets/BUS-142/why-now")
    assert response.status_code == 200
    data = response.json()

    assert data["asset_id"] == "BUS-142"
    assert data["total_signals_count"] == 5
    assert data["distinct_sources_count"] >= 4
    assert len(data["signals"]) >= 4

    labels = [s["label"] for s in data["signals"]]
    assert "Related signals detected" in labels
    assert "Multiple independent sources" in labels
    assert "Severity escalation" in labels
    assert "Temporal acceleration" in labels
    assert "Near-miss detected" in labels
    assert "Subsystem concentration" in labels


def test_severity_escalation_is_derived_from_events(client):
    """Verify severity escalation in Why-Now reflects true min to max severity."""
    response = client.get("/api/v1/assets/BUS-142/why-now")
    assert response.status_code == 200
    data = response.json()

    sev_signal = next((s for s in data["signals"] if s["label"] == "Severity escalation"), None)
    assert sev_signal is not None
    assert sev_signal["value"] == "2 → 5"
    assert len(sev_signal["evidence_event_ids"]) >= 2


def test_source_diversity_is_derived_from_events(client):
    """Verify source diversity indicator reflects independent roles/sources."""
    response = client.get("/api/v1/assets/BUS-142/why-now")
    assert response.status_code == 200
    data = response.json()

    source_signal = next((s for s in data["signals"] if s["label"] == "Multiple independent sources"), None)
    assert source_signal is not None
    assert "source" in source_signal["value"].lower()
    assert len(source_signal["evidence_event_ids"]) == 5


def test_near_miss_detection_is_derived_from_events(client):
    """Verify near-miss indicator reflects near_miss events in evidence."""
    response = client.get("/api/v1/assets/BUS-142/why-now")
    assert response.status_code == 200
    data = response.json()

    nm_signal = next((s for s in data["signals"] if s["label"] == "Near-miss detected"), None)
    assert nm_signal is not None
    assert nm_signal["severity"] == "critical"
    assert "1 near-miss" in nm_signal["value"]
    assert len(nm_signal["evidence_event_ids"]) == 1


def test_factor_contributions_exactly_match_the_risk_engine(client):
    """Verify that factor contributions in Why-Now strictly equal the risk engine's factor breakdown."""
    # 1. Fetch Why-Now
    res_why = client.get("/api/v1/assets/BUS-142/why-now")
    assert res_why.status_code == 200
    w_data = res_why.json()

    # 2. Fetch Asset Detail Dossier
    res_dossier = client.get("/api/v1/assets/BUS-142")
    assert res_dossier.status_code == 200
    d_data = res_dossier.json()

    fb = d_data["factor_breakdown"]
    fc_dict = {item["factor_key"]: item["points"] for item in w_data["factor_contributions"] if item.get("factor_key")}

    assert fc_dict["base_severity_points"] == fb["base_severity_points"]
    assert fc_dict["frequency_penalty_points"] == fb["frequency_penalty_points"]
    assert fc_dict["cross_source_bonus_points"] == fb["cross_source_bonus_points"]
    assert fc_dict["temporal_acceleration_points"] == fb["temporal_acceleration_points"]
    assert fc_dict["near_miss_anchor_points"] == fb["near_miss_anchor_points"]

    # Sum of factor contribution points must equal total risk score
    total_fc = sum(item["points"] for item in w_data["factor_contributions"])
    assert total_fc == fb["total_score"]
    assert total_fc == w_data["current_risk_score"]


def test_nonexistent_asset_returns_404(client):
    """Verify that requesting risk-history or why-now for a nonexistent asset returns HTTP 404."""
    res_history = client.get("/api/v1/assets/NONEXISTENT-999/risk-history")
    assert res_history.status_code == 404
    assert "not found" in res_history.json()["detail"].lower()

    res_why = client.get("/api/v1/assets/NONEXISTENT-999/why-now")
    assert res_why.status_code == 404
    assert "not found" in res_why.json()["detail"].lower()
