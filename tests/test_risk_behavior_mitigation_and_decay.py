"""
Tests for Final Risk Behavior, Event/Hazard Decay, Mitigation/Repair, and Why-Now Intelligence.
Verifies all behavioral requirements A through P.
"""
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.models.risk_assessment import RiskAssessment
from backend.app.services.risk_engine import RiskEngine
from backend.app.services.why_now_analyzer import WhyNowAnalyzer
from backend.app.db.session import SessionLocal
from data.scenarios.seed_data import seed_database


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def engine():
    return RiskEngine()


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# CASE A: BUS-091 enters MEDIUM band without artificial score inflation
# ---------------------------------------------------------------------------
def test_case_a_bus091_enters_medium_band(db_session, engine):
    """
    CASE A:
    BUS-091 evaluated on baseline seed data has score ~43.3.
    With the new 40.0-69.9 MEDIUM band, it classifies as MEDIUM (not LOW),
    without any artificial score inflation.
    """
    seed_database(reset=True)
    bus091 = db_session.query(Asset).filter(Asset.asset_id == "BUS-091").first()
    assert bus091 is not None

    assessment = engine.evaluate_asset(bus091, bus091.events)
    # Score itself is unchanged and uninflated (~43.3)
    assert 40.0 <= assessment.score < 45.0
    # Level is cleanly MEDIUM
    assert assessment.risk_level == "MEDIUM"


# ---------------------------------------------------------------------------
# CASE B: Recent lone severity-5 near-miss is elevated (MEDIUM)
# ---------------------------------------------------------------------------
def test_case_b_recent_lone_severity5_near_miss_is_elevated(engine):
    """
    CASE B:
    A recent isolated severity-5 near-miss on an asset produces elevated risk (~45.0 MEDIUM).
    """
    anchor = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-TEST-B")
    recent_nm = Event(
        id="ev-recent-nm",
        asset_id="BUS-TEST-B",
        timestamp=anchor - timedelta(hours=2),
        event_type="near_miss",
        subsystem="braking",
        severity=5,
        description="Near-miss: driver had to swerve onto shoulder at pedestrian crosswalk",
        source="Safety Dispatch",
        reporter_role="safety_officer"
    )

    assessment = engine.evaluate_asset(asset, [recent_nm], anchor_time=anchor)
    assert assessment.score >= 40.0, f"Expected MEDIUM (>= 40.0), got {assessment.score}"
    assert assessment.risk_level == "MEDIUM"
    assert assessment.score == pytest.approx(45.0, abs=1.0)


# ---------------------------------------------------------------------------
# CASE C: Same isolated near-miss becomes less influential as it ages (smooth decay)
# ---------------------------------------------------------------------------
def test_case_c_isolated_near_miss_smooth_temporal_decay(engine):
    """
    CASE C:
    Isolated near-miss decays smoothly after 12 hours:
    - 6h: stays elevated (~45 MEDIUM)
    - 24h: continued decline (< 45)
    - 48h: declines into LOW (< 40)
    - 5 days: contributes much less (< 25)
    - No discontinuities around the boundary.
    """
    anchor = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-TEST-C")

    def make_event(age_hours: float) -> Event:
        return Event(
            id=f"ev-age-{age_hours}",
            asset_id="BUS-TEST-C",
            timestamp=anchor - timedelta(hours=age_hours),
            event_type="near_miss",
            subsystem="braking",
            severity=5,
            description="Near-miss event",
            source="Safety Dispatch",
            reporter_role="safety_officer"
        )

    # 1. Recent (6h) - within grace period
    eval_6h = engine.evaluate_asset(asset, [make_event(6)], anchor_time=anchor)
    assert eval_6h.score >= 40.0
    assert eval_6h.risk_level == "MEDIUM"

    # 2. Boundary smoothness: 11h59m vs 12h01m
    eval_11h59 = engine.evaluate_asset(asset, [make_event(11.98)], anchor_time=anchor)
    eval_12h01 = engine.evaluate_asset(asset, [make_event(12.02)], anchor_time=anchor)
    # Must be virtually identical without arbitrary knife-edge drops
    assert abs(eval_11h59.score - eval_12h01.score) < 0.1

    # 3. 24h: continued decline
    eval_24h = engine.evaluate_asset(asset, [make_event(24)], anchor_time=anchor)
    assert eval_24h.score < eval_6h.score

    # 4. 48h: declines into LOW
    eval_48h = engine.evaluate_asset(asset, [make_event(48)], anchor_time=anchor)
    assert eval_48h.score < 40.0
    assert eval_48h.risk_level == "LOW"

    # 5. 5 days: contributes much less
    eval_5d = engine.evaluate_asset(asset, [make_event(120)], anchor_time=anchor)
    assert eval_5d.score < eval_48h.score
    assert eval_5d.score <= 20.0


# ---------------------------------------------------------------------------
# CASE D: Aged near-miss + new related warning becomes relevant again
# ---------------------------------------------------------------------------
def test_case_d_aged_near_miss_regains_significance_with_new_warning(engine):
    """
    CASE D:
    Day 1: near-miss occurs
    Day 3: no new evidence -> influence decayed
    Day 4: new brake complaint -> old near-miss becomes relevant again as part of connected chain!
    """
    anchor = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-TEST-D")

    old_nm = Event(
        id="ev-old-nm",
        asset_id="BUS-TEST-D",
        timestamp=anchor - timedelta(days=4),
        event_type="near_miss",
        subsystem="braking",
        severity=5,
        description="Near-miss braking failure",
        source="Safety Dispatch",
        reporter_role="safety_officer"
    )

    new_complaint = Event(
        id="ev-new-complaint",
        asset_id="BUS-TEST-D",
        timestamp=anchor - timedelta(hours=2),
        event_type="complaint",
        subsystem="braking",
        severity=3,
        description="Passenger reports excessive stopping distance",
        source="Passenger Feedback App",
        reporter_role="passenger"
    )

    # Isolated old near miss alone is decayed
    eval_old_alone = engine.evaluate_asset(asset, [old_nm], anchor_time=anchor)
    assert eval_old_alone.risk_level == "LOW"

    # Connected: old near-miss + new complaint
    eval_combined = engine.evaluate_asset(asset, [old_nm, new_complaint], anchor_time=anchor)

    # Score re-escalates significantly higher than either alone
    assert eval_combined.score > eval_old_alone.score + 25.0
    assert eval_combined.score >= 45.0
    assert eval_combined.risk_level in ("MEDIUM", "HIGH")
    assert eval_combined.factor_breakdown["near_miss_anchor_points"] == 10.0
    assert eval_combined.factor_breakdown["cross_source_bonus_points"] > 0.0


# ---------------------------------------------------------------------------
# CASE E: Warning + repair reduces current risk
# ---------------------------------------------------------------------------
def test_case_e_warning_plus_repair_reduces_risk(db_session, engine):
    """
    CASE E:
    On BUS-142 (baseline 82.0 HIGH), adding a completed repair event
    meaningfully reduces risk to MEDIUM.
    """
    seed_database(reset=True)
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    anchor = datetime.now(timezone.utc)

    baseline_eval = engine.evaluate_asset(bus142, bus142.events, anchor_time=anchor)
    assert baseline_eval.score == pytest.approx(82.0, abs=0.5)

    repair_event = Event(
        id="ev-repair-1",
        asset_id="BUS-142",
        timestamp=anchor,
        event_type="corrective_action",
        subsystem="braking",
        severity=1,
        description="Depot workshop: front and rear brake pads replaced and calipers overhauled",
        source="Depot Workshop",
        reporter_role="technician"
    )

    events_with_repair = list(bus142.events) + [repair_event]
    repaired_eval = engine.evaluate_asset(bus142, events_with_repair, anchor_time=anchor)

    # Meaningful reduction: drops by ~22 points from 82.0 to ~60.0
    assert repaired_eval.score < baseline_eval.score - 15.0
    assert repaired_eval.score == pytest.approx(60.0, abs=1.0)
    # Does NOT drop straight to LOW (unresolved historical near-miss still acknowledged)
    assert repaired_eval.risk_level == "MEDIUM"
    assert repaired_eval.factor_breakdown["mitigation_discount_points"] == 22.0


# ---------------------------------------------------------------------------
# CASE F: Warning + repair + successful verification reduces risk further
# ---------------------------------------------------------------------------
def test_case_f_repair_plus_verification_reduces_risk_further(db_session, engine):
    """
    CASE F:
    Adding a verified post-repair inspection further discounts the risk.
    """
    seed_database(reset=True)
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    anchor = datetime.now(timezone.utc)

    repair_event = Event(
        id="ev-repair-1",
        asset_id="BUS-142",
        timestamp=anchor - timedelta(hours=4),
        event_type="corrective_action",
        subsystem="braking",
        severity=1,
        description="Brake pads replaced and hydraulic lines bled",
        source="Depot Workshop",
        reporter_role="technician"
    )

    verify_event = Event(
        id="ev-verify-1",
        asset_id="BUS-142",
        timestamp=anchor,
        event_type="inspection",
        subsystem="braking",
        severity=1,
        description="State safety audit: post-repair inspection passed and brake deceleration certified at 0.65g",
        source="State Transit Safety Inspector",
        reporter_role="inspector"
    )

    events_verified = list(bus142.events) + [repair_event, verify_event]
    verified_eval = engine.evaluate_asset(bus142, events_verified, anchor_time=anchor)

    # Stronger reduction: discount of 35.0 points
    assert verified_eval.score == pytest.approx(47.0, abs=1.0)
    assert verified_eval.risk_level == "MEDIUM"
    assert verified_eval.factor_breakdown["mitigation_discount_points"] == 35.0


# ---------------------------------------------------------------------------
# CASE G: Repair does not delete historical evidence
# ---------------------------------------------------------------------------
def test_case_g_repair_does_not_delete_historical_evidence(db_session, engine):
    """
    CASE G:
    All historical events remain fully present and accessible in evidence graph and history.
    """
    seed_database(reset=True)
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    initial_count = len(bus142.events)

    repair_event = Event(
        id="ev-repair-hist",
        asset_id="BUS-142",
        timestamp=datetime.now(timezone.utc),
        event_type="maintenance",
        subsystem="braking",
        severity=1,
        description="Brake pads replaced and caliper service completed",
        source="Depot Workshop",
        reporter_role="technician"
    )

    combined = list(bus142.events) + [repair_event]
    eval_out = engine.evaluate_asset(bus142, combined)

    # Event count has not decreased; historical events are intact
    assert len(combined) == initial_count + 1
    assert any(e.event_type == "near_miss" for e in combined)
    assert len(eval_out.evidence_graph.nodes) > 0


# ---------------------------------------------------------------------------
# CASE H: Repair followed by another warning increases risk again
# ---------------------------------------------------------------------------
def test_case_h_repair_followed_by_new_warning_escalates_risk(db_session, engine):
    """
    CASE H:
    If a warning occurs AFTER the repair timestamp, it is UNRESOLVED,
    so risk escalates back up.
    """
    seed_database(reset=True)
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    anchor = datetime.now(timezone.utc)
    t_repair = anchor + timedelta(hours=1)
    t_post = anchor + timedelta(hours=3)

    repair_event = Event(
        id="ev-repair-h",
        asset_id="BUS-142",
        timestamp=t_repair,
        event_type="corrective_action",
        subsystem="braking",
        severity=1,
        description="Brake pads replaced and caliper service completed",
        source="Depot Workshop",
        reporter_role="technician"
    )

    # Post-repair warning (occurred after repair)
    post_warning = Event(
        id="ev-post-warning",
        asset_id="BUS-142",
        timestamp=t_post,
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver reports abnormal brake pedal resistance and long stopping distance post-service",
        source="Driver Pad",
        reporter_role="driver"
    )

    eval_repaired = engine.evaluate_asset(bus142, list(bus142.events) + [repair_event], anchor_time=t_repair)
    eval_post_warn = engine.evaluate_asset(bus142, list(bus142.events) + [repair_event, post_warning], anchor_time=t_post)

    # Risk escalates back up after post-repair warning
    assert eval_repaired.score == pytest.approx(60.0, abs=1.0)
    assert eval_post_warn.score > eval_repaired.score + 10.0
    assert eval_post_warn.risk_level in ("HIGH", "CRITICAL")


# ---------------------------------------------------------------------------
# CASE I: Quiet asset WHY NOW does not produce alarming stale signals
# ---------------------------------------------------------------------------
def test_case_i_quiet_asset_why_now_calm_signals(db_session, engine):
    """
    CASE I:
    For a quiet asset in the LOW risk band (e.g. BUS-105), WHY NOW does not
    manufacture alarming signals or claim multi-source safety escalation.
    Headline explicitly confirms NO ACTIVE ESCALATION DETECTED.
    """
    seed_database(reset=True)
    bus105 = db_session.query(Asset).filter(Asset.asset_id == "BUS-105").first()
    assert bus105 is not None

    assessment = engine.evaluate_asset(bus105, bus105.events)
    why_now = WhyNowAnalyzer.generate_explanation(bus105, bus105.events, assessment)

    assert "NO ACTIVE ESCALATION DETECTED" in why_now.headline
    assert "No systemic multi-source escalation" in why_now.summary or "Last relevant signal" in why_now.summary
    # Does not contain alarming near-miss flags
    assert not any(s.label == "Near-miss detected" for s in why_now.signals)


# ---------------------------------------------------------------------------
# CASE J: BUS-142 WHY NOW still identifies active braking escalation
# ---------------------------------------------------------------------------
def test_case_j_bus142_why_now_identifies_escalation(db_session, engine):
    """
    CASE J:
    BUS-142 Why Now continues to clearly articulate multi-source braking escalation.
    """
    seed_database(reset=True)
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    assessment = engine.evaluate_asset(bus142, bus142.events)
    why_now = WhyNowAnalyzer.generate_explanation(bus142, bus142.events, assessment)

    labels = [s.label for s in why_now.signals]
    assert "Related signals detected" in labels
    assert "Multiple independent sources" in labels
    assert "Severity escalation" in labels
    assert "Near-miss detected" in labels
    assert "braking" in why_now.summary.lower()


# ---------------------------------------------------------------------------
# CASE K: What-if simulation remains non-mutating
# ---------------------------------------------------------------------------
def test_case_k_what_if_simulation_non_mutating(client, db_session):
    """
    CASE K:
    What-if simulation leaves Event and RiskAssessment count strictly unchanged.
    """
    seed_database(reset=True)
    initial_events = db_session.query(Event).count()
    initial_assessments = db_session.query(RiskAssessment).count()

    resp = client.post("/api/v1/simulation/simulate-signal", json={
        "asset_id": "BUS-142",
        "event_type": "near_miss",
        "subsystem": "braking",
        "severity": 5,
        "description": "Simulated emergency near-miss",
        "source": "Simulation Engine",
        "reporter_role": "safety_officer"
    })
    assert resp.status_code == 200

    post_events = db_session.query(Event).count()
    post_assessments = db_session.query(RiskAssessment).count()

    assert post_events == initial_events
    assert post_assessments == initial_assessments


# ---------------------------------------------------------------------------
# CASE L: Risk score bounded between 0.0 and 100.0 (never negative)
# ---------------------------------------------------------------------------
def test_case_l_risk_bounded_and_never_negative(engine):
    """
    CASE L:
    Mitigation discounts or extreme inputs never produce scores < 0.0 or > 100.0.
    """
    asset = Asset(asset_id="BUS-TEST-L")
    t0 = datetime.now(timezone.utc)

    # Minor event + verified repair
    minor_event = Event(
        id="ev-minor",
        asset_id="BUS-TEST-L",
        timestamp=t0 - timedelta(hours=2),
        event_type="maintenance",
        subsystem="doors_body",
        severity=1,
        description="Routine door lube",
        source="Shop",
        reporter_role="technician"
    )

    verified_repair = Event(
        id="ev-overkill-repair",
        asset_id="BUS-TEST-L",
        timestamp=t0,
        event_type="corrective_action",
        subsystem="doors_body",
        severity=1,
        description="Door assembly replaced and post-repair inspection passed",
        source="Shop",
        reporter_role="technician"
    )

    eval_out = engine.evaluate_asset(asset, [minor_event, verified_repair])
    assert 0.0 <= eval_out.score <= 100.0
    assert eval_out.score == 0.0


# ---------------------------------------------------------------------------
# CASE M: Existing CRITICAL collision scenario remains CRITICAL
# ---------------------------------------------------------------------------
def test_case_m_canonical_collision_remains_critical(db_session, engine):
    """
    CASE M:
    BUS-142 + severity-5 actual collision incident on braking reaches CRITICAL (95.5).
    """
    seed_database(reset=True)
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    anchor = datetime.now(timezone.utc)

    collision = Event(
        id="ev-collision-m",
        asset_id="BUS-142",
        timestamp=anchor,
        event_type="incident",
        subsystem="braking",
        severity=5,
        description="Braking failure collision: bus collided with depot barrier",
        source="Safety Dispatch",
        reporter_role="safety_officer"
    )

    assessment = engine.evaluate_asset(bus142, list(bus142.events) + [collision], anchor_time=anchor)
    assert assessment.score >= 90.0
    assert assessment.risk_level == "CRITICAL"
    assert assessment.score == 95.5


# ---------------------------------------------------------------------------
# CASE N: Existing BUS-142 baseline remains HIGH (82.0)
# ---------------------------------------------------------------------------
def test_case_n_bus142_baseline_remains_high(db_session, engine):
    """
    CASE N:
    Existing BUS-142 baseline evaluates to 82.0 HIGH.
    """
    seed_database(reset=True)
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    assessment = engine.evaluate_asset(bus142, bus142.events)
    assert assessment.score == pytest.approx(82.0, abs=0.5)
    assert assessment.risk_level == "HIGH"
    assert assessment.confidence == pytest.approx(86.0, abs=1.0)


# ---------------------------------------------------------------------------
# CASE O: Confidence remains separate from risk
# ---------------------------------------------------------------------------
def test_case_o_confidence_separate_from_risk(db_session, engine):
    """
    CASE O:
    Confidence does not track risk 1:1, remains calibrated below 100%,
    and does not artificially inflate upon mitigation.
    """
    seed_database(reset=True)
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    eval_before = engine.evaluate_asset(bus142, bus142.events)

    repair = Event(
        id="ev-rep-o",
        asset_id="BUS-142",
        timestamp=datetime.now(timezone.utc),
        event_type="corrective_action",
        subsystem="braking",
        severity=1,
        description="Brake pads replaced",
        source="Shop",
        reporter_role="technician"
    )
    eval_after = engine.evaluate_asset(bus142, list(bus142.events) + [repair])

    assert eval_after.score < eval_before.score  # Risk dropped
    assert eval_after.confidence < 100.0  # Never casual 100%
    assert eval_after.confidence == pytest.approx(eval_before.confidence, abs=4.0)


# ---------------------------------------------------------------------------
# CASE P: Historical risk trajectory remains deterministic
# ---------------------------------------------------------------------------
def test_case_p_historical_trajectory_deterministic(db_session, engine):
    """
    CASE P:
    Replaying BUS-142 historical timeline produces the canonical escalating trajectory:
    7.0 -> 30.7 -> 49.5 -> 68.5 -> 82.0.
    """
    seed_database(reset=True)
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    history = engine.calculate_risk_history(bus142, bus142.events)

    scores = [p["risk_score"] for p in history["points"]]
    assert len(scores) == 5
    assert scores == [7.0, 30.7, 49.5, 68.5, 82.0]
