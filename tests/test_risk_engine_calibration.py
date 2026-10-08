"""
Comprehensive Calibration & Regression Test Suite for PREVENT Deterministic Risk Engine.

Formal Calibration Test Matrix:
CASE A: Quiet asset + 1 normal maintenance event -> LOW
CASE B: Quiet asset + 1 severity-5 near-miss -> NOT LOW (e.g. MEDIUM)
CASE C: Quiet asset + 1 severity-5 crash/major incident -> NOT LOW (e.g. MEDIUM)
CASE D: BUS-142 baseline -> approximately current known baseline (82.0) and HIGH
CASE E: BUS-142 + new severity-4 braking report today -> risk >= baseline (Risk Invariant #1)
CASE F: BUS-142 + severity-5 near-miss/collision -> reaches CRITICAL (>= 90.0)
CASE G: BUS-142 driver report shifted 4 hours earlier -> remains HIGH (robust across ±1h, ±4h, ±12h)
CASE H: BUS-142 confidence -> high confidence BUT strictly < 100%
CASE I: Explicit historical evaluation_time -> deterministic repeatable score
CASE J: Normal evaluation without explicit evaluation_time -> uses current UTC time, NOT DEFAULT_ANCHOR_TIME

Additional Invariant & Integrity Tests:
- What-If simulation non-mutation guarantee (DB event count unchanged)
- Mathematical monotonicity for relevant corroborating evidence on active subsystems
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
from backend.app.core.config import settings
from data.scenarios.seed_data import seed_database


@pytest.fixture(autouse=True)
def clean_db():
    """Ensure clean baseline database before every test."""
    seed_database(reset=True)


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    """Database session fixture."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def risk_engine():
    """RiskEngine instance fixture."""
    return RiskEngine()


# ---------------------------------------------------------------------------
# CASE A: Quiet Asset + 1 Normal Maintenance Event
# ---------------------------------------------------------------------------

def test_case_a_quiet_asset_single_routine_maintenance(risk_engine):
    """
    CASE A:
    Quiet asset with 1 normal maintenance event.
    Expected: LOW risk (score <= 44.9).
    """
    now = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-QUIET-A", asset_type="bus")
    event = Event(
        id="ev-qa-1",
        asset_id="BUS-QUIET-A",
        timestamp=now - timedelta(days=2),
        event_type="maintenance",
        subsystem="braking",
        severity=1,
        description="Routine oil and brake pad inspection pass.",
        source="Depot Log",
        reporter_role="technician"
    )

    assessment = risk_engine.evaluate_asset(asset, [event], anchor_time=now)
    assert assessment.risk_level == "LOW", f"Expected LOW risk, got {assessment.risk_level}"
    assert assessment.score <= 44.9
    assert assessment.score < 10.0  # Routine check produces negligible score (~1.2 pts)


# ---------------------------------------------------------------------------
# CASE B: Quiet Asset + 1 Severity-5 Near-Miss
# ---------------------------------------------------------------------------

def test_case_b_quiet_asset_single_severity5_near_miss(risk_engine):
    """
    CASE B:
    Quiet asset with 1 severity-5 near-miss.
    Expected: NOT LOW (must enter elevated/medium risk range, score >= 45.0).
    """
    now = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-QUIET-B", asset_type="bus")
    event = Event(
        id="ev-qb-1",
        asset_id="BUS-QUIET-B",
        timestamp=now - timedelta(hours=3),
        event_type="near_miss",
        subsystem="braking",
        severity=5,
        description="Critical near-miss: vehicle overshot red signal by 3 meters due to brake pedal softness.",
        source="Safety Dispatch",
        reporter_role="safety_officer"
    )

    assessment = risk_engine.evaluate_asset(asset, [event], anchor_time=now)
    assert assessment.risk_level != "LOW", f"Single severity-5 near-miss must NOT be LOW, got {assessment.risk_level}"
    assert assessment.score >= 45.0
    assert assessment.risk_level in ("MEDIUM", "HIGH")


# ---------------------------------------------------------------------------
# CASE C: Quiet Asset + 1 Severity-5 Actual Crash / Major Incident
# ---------------------------------------------------------------------------

def test_case_c_quiet_asset_single_severity5_crash(risk_engine):
    """
    CASE C:
    Quiet asset with 1 severity-5 actual crash/major incident.
    Expected: NOT LOW (acute-event risk anchor elevates score to at least MEDIUM, >= 45.0).
    """
    now = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-QUIET-C", asset_type="bus")
    event = Event(
        id="ev-qc-1",
        asset_id="BUS-QUIET-C",
        timestamp=now - timedelta(hours=2),
        event_type="incident",
        subsystem="braking",
        severity=5,
        description="Collision incident: rear-end impact with vehicle ahead due to sudden total hydraulic brake loss.",
        source="Incident Dispatch",
        reporter_role="safety_officer"
    )

    assessment = risk_engine.evaluate_asset(asset, [event], anchor_time=now)
    assert assessment.risk_level != "LOW", f"Single severity-5 crash must NOT be LOW, got {assessment.risk_level}"
    assert assessment.score >= 45.0
    assert assessment.risk_level in ("MEDIUM", "HIGH")


# ---------------------------------------------------------------------------
# CASE D: BUS-142 Baseline Scenario
# ---------------------------------------------------------------------------

def test_case_d_bus142_baseline(db_session, risk_engine):
    """
    CASE D:
    BUS-142 baseline with seeded 5 events.
    Expected: Approximately current known baseline (~82.0) and HIGH risk level.
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    assert bus142 is not None

    latest_ev = max(bus142.events, key=lambda e: e.timestamp)
    assessment = risk_engine.evaluate_asset(bus142, bus142.events, anchor_time=latest_ev.timestamp)

    assert round(assessment.score, 1) == 82.0
    assert assessment.risk_level == "HIGH"
    assert assessment.primary_subsystem == "braking"
    assert assessment.factor_breakdown["near_miss_anchor_points"] == 10.0
    assert assessment.factor_breakdown["cross_source_bonus_points"] == 20.0
    assert assessment.factor_breakdown["temporal_acceleration_points"] == 13.0
    assert assessment.factor_breakdown["frequency_penalty_points"] == 14.0
    assert assessment.factor_breakdown["base_severity_points"] == 25.0


# ---------------------------------------------------------------------------
# CASE E: BUS-142 + New Severity-4 Braking Report Today (Risk Invariant #1)
# ---------------------------------------------------------------------------

def test_case_e_bus142_plus_today_severe_braking_report_monotonicity(db_session, risk_engine):
    """
    CASE E:
    BUS-142 baseline: 82.0
    Add: severity=4, subsystem=braking, source=driver, timestamp=today
    Expected: Risk(A, E + warning) >= Risk(A, E) (strictly >= 82.0).
    Corrected calculated score: 85.5 (+3.5 pts for compounded frequency).
    Never drops to 69.7!
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    baseline = risk_engine.evaluate_asset(bus142, bus142.events)
    assert baseline.score == 82.0

    today = datetime.now(timezone.utc)
    new_report = Event(
        id="ev-today-driver",
        asset_id="BUS-142",
        timestamp=today,
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver report today: severe brake pedal resistance and spongy travel.",
        source="Driver Pad",
        reporter_role="driver"
    )

    updated_events = list(bus142.events) + [new_report]
    updated_assessment = risk_engine.evaluate_asset(bus142, updated_events, anchor_time=today)

    # Risk Invariant #1 Assertion
    assert updated_assessment.score >= baseline.score, (
        f"Risk Invariant #1 Violated: new severe braking warning lowered risk from {baseline.score} to {updated_assessment.score}"
    )
    assert updated_assessment.score == 85.5
    assert updated_assessment.risk_level == "HIGH"
    delta = round(updated_assessment.score - baseline.score, 1)
    assert delta == 3.5


# ---------------------------------------------------------------------------
# CASE F: BUS-142 + Severity-5 Collision Reaches CRITICAL (>= 90)
# ---------------------------------------------------------------------------

def test_case_f_bus142_plus_collision_reaches_critical(db_session, risk_engine):
    """
    CASE F:
    BUS-142 + severity-5 actual collision incident on braking.
    Expected: Risk reaches CRITICAL range (>= 90.0).
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    today = datetime.now(timezone.utc)

    collision_event = Event(
        id="ev-collision-sim",
        asset_id="BUS-142",
        timestamp=today,
        event_type="incident",
        subsystem="braking",
        severity=5,
        description="Braking failure collision: bus collided with depot barrier after emergency brake failure.",
        source="Safety Dispatch",
        reporter_role="safety_officer"
    )

    combined_events = list(bus142.events) + [collision_event]
    assessment = risk_engine.evaluate_asset(bus142, combined_events, anchor_time=today)

    assert assessment.score >= 90.0, f"Expected CRITICAL risk >= 90.0, got {assessment.score}"
    assert assessment.risk_level == "CRITICAL"
    assert assessment.score == 95.5


# ---------------------------------------------------------------------------
# CASE G: Temporal Factor Robustness Under Timestamp Perturbations
# ---------------------------------------------------------------------------

def test_case_g_temporal_factor_stability_under_perturbations(db_session, risk_engine):
    """
    CASE G:
    Shifting driver report timestamp by -1h, -4h, +4h, -12h.
    Expected: Risk remains broadly stable in the same risk band (HIGH),
    without discontinuous collapse from HIGH (82) to MEDIUM (69).
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    latest_ev = max(bus142.events, key=lambda e: e.timestamp)
    baseline_eval = risk_engine.evaluate_asset(bus142, bus142.events, anchor_time=latest_ev.timestamp)
    assert baseline_eval.score == 82.0

    perturbations = [-1.0, -4.0, 4.0, -12.0]  # in hours
    for shift_hours in perturbations:
        # Clone events and perturb the driver report (Sep 14)
        perturbed_events = []
        for e in bus142.events:
            ev_copy = Event(
                id=e.id,
                asset_id=e.asset_id,
                timestamp=e.timestamp,
                event_type=e.event_type,
                subsystem=e.subsystem,
                severity=e.severity,
                description=e.description,
                source=e.source,
                reporter_role=e.reporter_role
            )
            if e.reporter_role == "driver" and e.severity == 4:
                ev_copy.timestamp = e.timestamp + timedelta(hours=shift_hours)
            perturbed_events.append(ev_copy)

        eval_perturbed = risk_engine.evaluate_asset(bus142, perturbed_events, anchor_time=latest_ev.timestamp)

        # Risk must remain within reasonable tolerance of baseline (+/- 5.0 pts) and remain HIGH
        assert eval_perturbed.risk_level == "HIGH", (
            f"Perturbation {shift_hours:+0.1f}h collapsed risk level to {eval_perturbed.risk_level} (score {eval_perturbed.score})"
        )
        assert abs(eval_perturbed.score - baseline_eval.score) <= 5.0, (
            f"Perturbation {shift_hours:+0.1f}h produced excessive score jump: {eval_perturbed.score} vs {baseline_eval.score}"
        )


# ---------------------------------------------------------------------------
# CASE H: Confidence Calibration
# ---------------------------------------------------------------------------

def test_case_h_confidence_is_calibrated_and_under_100(db_session, risk_engine):
    """
    CASE H:
    BUS-142 confidence:
    Expected: high confidence (> 80%) BUT strictly < 100%.
    Single event:
    Expected: moderate confidence (< 60%).
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    assessment = risk_engine.evaluate_asset(bus142, bus142.events)

    # Multi-source 5-event pattern has high confidence, but never casually 100%
    assert 80.0 <= assessment.confidence < 100.0, (
        f"Expected calibrated confidence in 80-99% range, got {assessment.confidence}%"
    )
    assert assessment.confidence == 86.0

    # Single isolated event
    single_event = Event(
        id="ev-isolated",
        asset_id="BUS-TEST-CONF",
        timestamp=datetime.now(timezone.utc),
        event_type="near_miss",
        subsystem="braking",
        severity=5,
        description="Isolated event",
        source="Safety Dispatch",
        reporter_role="safety_officer"
    )
    single_eval = risk_engine.evaluate_asset(Asset(asset_id="BUS-TEST-CONF"), [single_event])
    assert single_eval.confidence < 60.0
    assert single_eval.confidence <= 40.0


# ---------------------------------------------------------------------------
# CASE I: Explicit Historical Evaluation Time
# ---------------------------------------------------------------------------

def test_case_i_explicit_historical_evaluation_time(db_session, risk_engine):
    """
    CASE I:
    Explicit historical evaluation_time:
    Expected: Deterministic, repeatable score evaluated at that exact reference point.
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    anchor = datetime(2026, 9, 17, 18, 0, 0, tzinfo=timezone.utc)

    eval_1 = risk_engine.evaluate_asset(bus142, bus142.events, anchor_time=anchor)
    eval_2 = risk_engine.evaluate_asset(bus142, bus142.events, anchor_time=anchor)

    assert eval_1.anchor_time == anchor
    assert eval_1.score == eval_2.score == 82.0
    assert eval_1.confidence == eval_2.confidence == 86.0


# ---------------------------------------------------------------------------
# CASE J: Normal Evaluation Without Explicit Anchor Uses Current UTC Time
# ---------------------------------------------------------------------------

def test_case_j_normal_evaluation_uses_current_utc_clock(db_session, risk_engine):
    """
    CASE J:
    Normal evaluation without explicit evaluation_time:
    Expected: Uses current UTC time, NOT DEFAULT_ANCHOR_TIME (no pinned demo clock).
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    before_call = datetime.now(timezone.utc)
    assessment = risk_engine.evaluate_asset(bus142, bus142.events)
    after_call = datetime.now(timezone.utc)

    # Verify anchor_time is current UTC time
    assert assessment.anchor_time >= before_call - timedelta(seconds=2)
    assert assessment.anchor_time <= after_call + timedelta(seconds=2)

    # Verify it does NOT equal the old pinned demo clock (2026-09-17)
    pinned_clock_dt = datetime.fromisoformat(settings.DEFAULT_ANCHOR_TIME.replace("Z", "+00:00"))
    assert assessment.anchor_time != pinned_clock_dt


# ---------------------------------------------------------------------------
# WHAT-IF REGRESSION: Database Event Count Unchanged
# ---------------------------------------------------------------------------

def test_what_if_simulation_does_not_mutate_database(client, db_session):
    """
    What-If simulation must remain purely in-memory:
    - Verify DB event count is identical before and after simulation.
    - Verify DB assessment count is identical before and after simulation.
    """
    events_count_before = db_session.query(Event).count()
    assessments_count_before = db_session.query(RiskAssessment).count()

    payload = {
        "asset_id": "BUS-142",
        "event_type": "incident",
        "subsystem": "braking",
        "severity": 5,
        "description": "Hypothetical severe collision for simulation check.",
        "source": "Driver Pad",
        "reporter_role": "driver"
    }

    response = client.post("/api/v1/simulation/simulate-signal", json=payload)
    assert response.status_code == 200

    events_count_after = db_session.query(Event).count()
    assessments_count_after = db_session.query(RiskAssessment).count()

    assert events_count_after == events_count_before, "What-If simulation mutated DB events table!"
    assert assessments_count_after == assessments_count_before, "What-If simulation mutated DB assessments table!"
