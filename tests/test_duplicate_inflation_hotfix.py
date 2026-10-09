"""
Regression test suite for PREVENT Phase 6: Duplicate-Report Inflation Audit & Fix.

Validates that:
1. A single report contributes normally.
2. Three confirmed duplicate submissions do not triple-count evidence.
3. All original records remain present and traceable in database and breakdown.
4. Independent reports describing an evolving fault still increase risk.
5. Genuine multi-role/source corroboration still works.
6. A genuine inspection with distinct physical findings remains independent.
7. A copied inspection is not automatically awarded independent corroboration when strong evidence establishes duplication.
8. Identical text on different assets remains independent.
9. Identical text in unrelated subsystems remains independent.
10. Identical text more than 24 hours apart follows the documented recurrence policy.
11. Scoring remains deterministic when input event ordering changes.
12. Existing mitigation behavior and the WHY NOW crash fix remain intact.
"""
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.services.risk_engine import RiskEngine
from backend.app.services.why_now_analyzer import WhyNowAnalyzer
from data.scenarios.seed_data import seed_database


@pytest.fixture(autouse=True)
def setup_clean_db():
    """Ensure clean baseline database before each test."""
    seed_database(reset=True)


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    """Database session fixture."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def risk_engine():
    """RiskEngine fixture."""
    return RiskEngine()


# ---------------------------------------------------------------------------
# Test 1: A single report contributes normally
# ---------------------------------------------------------------------------

def test_1_single_report_contributes_normally(risk_engine):
    """
    Verifies that a single safety report submitted once evaluates with standard
    baseline severity, zero frequency penalty, zero cross-source bonus, and zero
    temporal acceleration.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-1")

    ev1 = Event(
        id="ev-single-1",
        asset_id="BUS-TEST-1",
        timestamp=anchor - timedelta(hours=1),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver reported severe brake shudder and long stopping distance",
        source="Driver Shift Pad",
        reporter_role="driver"
    )

    assessment = risk_engine.evaluate_asset(asset, [ev1], anchor_time=anchor)

    # Base severity: 4 * 3.5 * recency (~0.997) = 13.96 -> rounded total score 14.0
    assert assessment.score == 14.0
    assert assessment.risk_level == "LOW"
    assert assessment.factor_breakdown["base_severity_points"] == 13.96
    assert assessment.factor_breakdown["frequency_penalty_points"] == 0.0
    assert assessment.factor_breakdown["cross_source_bonus_points"] == 0.0
    assert assessment.factor_breakdown["temporal_acceleration_points"] == 0.0
    assert assessment.factor_breakdown["near_miss_anchor_points"] == 0.0

    braking_bd = assessment.subsystems_breakdown["braking"]
    assert braking_bd.event_count == 1
    assert braking_bd.distinct_sources_count == 1
    assert braking_bd.distinct_roles == ["driver"]


# ---------------------------------------------------------------------------
# Test 2: Three confirmed duplicate submissions do not triple-count evidence
# ---------------------------------------------------------------------------

def test_2_three_confirmed_duplicates_do_not_triple_count(risk_engine):
    """
    Verifies that submitting the exact same report three times within 24 hours
    does NOT multiply base severity, trigger frequency penalties, contract temporal
    intervals, or fabricate distinct role corroboration.
    Score must equal 14.0 (identical to a single submission), NOT 45.0 or 57.3.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-2")

    desc = "Driver reported severe brake shudder and long stopping distance"
    ev1 = Event(
        id="ev-dup-1",
        asset_id="BUS-TEST-2",
        timestamp=anchor - timedelta(hours=3),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Shift Pad",
        reporter_role="driver"
    )
    ev2 = Event(
        id="ev-dup-2",
        asset_id="BUS-TEST-2",
        timestamp=anchor - timedelta(hours=2),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Shift Pad",
        reporter_role="driver"
    )
    ev3 = Event(
        id="ev-dup-3",
        asset_id="BUS-TEST-2",
        timestamp=anchor - timedelta(hours=1),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Shift Pad",
        reporter_role="driver"
    )

    single_eval = risk_engine.evaluate_asset(asset, [ev1], anchor_time=anchor)
    assessment = risk_engine.evaluate_asset(asset, [ev1, ev2, ev3], anchor_time=anchor)

    # Risk score must match single report evaluation exactly (13.9)
    assert assessment.score == single_eval.score, f"Expected {single_eval.score}, got {assessment.score} (duplicate inflation detected!)"
    assert assessment.score == 13.9
    assert assessment.risk_level == "LOW"
    assert assessment.factor_breakdown["base_severity_points"] == single_eval.factor_breakdown["base_severity_points"]
    assert assessment.factor_breakdown["frequency_penalty_points"] == 0.0
    assert assessment.factor_breakdown["cross_source_bonus_points"] == 0.0
    assert assessment.factor_breakdown["temporal_acceleration_points"] == 0.0

    braking_bd = assessment.subsystems_breakdown["braking"]
    # Total submitted record count remains 3 (provenance preserved)
    assert braking_bd.event_count == 3
    # Distinct roles and sources strictly reflect effective non-duplicate evidence
    assert braking_bd.distinct_sources_count == 1
    assert braking_bd.distinct_roles == ["driver"]

    # Confidence must not artificially inflate to high confidence
    assert assessment.confidence < 50.0


# ---------------------------------------------------------------------------
# Test 3: All original records remain present and traceable
# ---------------------------------------------------------------------------

def test_3_duplicate_records_remain_preserved_and_traceable(client, db_session, risk_engine):
    """
    Proves that conservative deduplication separates risk contribution from data preservation:
    Every submitted report remains persisted in the database with its original ID, timestamp,
    source, role, and description, and appears in contributing_event_ids and timeline.
    """
    asset_id = "BUS-RECORD-PRESERVE"
    db_asset = Asset(asset_id=asset_id, asset_type="bus", status="active")
    db_session.add(db_asset)
    db_session.commit()

    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    desc = "Driver reported abnormal brake vibration approaching depot"

    # Ingest 3 duplicate events via API
    event_ids = []
    for i in range(3):
        res = client.post("/api/v1/events", json={
            "asset_id": asset_id,
            "event_type": "operational_report",
            "subsystem": "braking",
            "severity": 4,
            "description": desc,
            "source": "Driver Mobile Terminal",
            "reporter_role": "driver",
            "timestamp": (anchor - timedelta(minutes=30 * (3 - i))).isoformat()
        })
        assert res.status_code == 201
        event_ids.append(res.json()["event"]["id"])

    assert len(event_ids) == 3
    assert len(set(event_ids)) == 3, "All 3 events must have unique primary key IDs"

    # Query dossier from API
    dossier_res = client.get(f"/api/v1/assets/{asset_id}")
    assert dossier_res.status_code == 200
    dossier = dossier_res.json()

    # Score reflects non-inflated evaluation
    assert dossier["risk_score"] == 14.0
    assert dossier["subsystems_breakdown"]["braking"]["event_count"] == 3

    # All 3 events are present in database
    db_events = db_session.query(Event).filter(Event.asset_id == asset_id).all()
    assert len(db_events) == 3
    db_ids = {e.id for e in db_events}
    for eid in event_ids:
        assert eid in db_ids


# ---------------------------------------------------------------------------
# Test 4: Independent reports describing an evolving fault still increase risk
# ---------------------------------------------------------------------------

def test_4_independent_reports_evolving_fault_increase_risk(risk_engine):
    """
    Verifies that independently authored reports with different descriptions
    describing an escalating fault are NOT suppressed and increase risk score
    via base severity accumulation, frequency penalties, and temporal tracking.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-EVOLVE")

    ev1 = Event(
        id="ev-evolve-1",
        asset_id="BUS-TEST-EVOLVE",
        timestamp=anchor - timedelta(days=5),
        event_type="operational_report",
        subsystem="braking",
        severity=3,
        description="Driver noted slight brake squeal during morning run",
        source="Driver Shift Pad",
        reporter_role="driver"
    )
    ev2 = Event(
        id="ev-evolve-2",
        asset_id="BUS-TEST-EVOLVE",
        timestamp=anchor - timedelta(days=2),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver noted moderate brake shudder and pulling to the right",
        source="Driver Shift Pad",
        reporter_role="driver"
    )
    ev3 = Event(
        id="ev-evolve-3",
        asset_id="BUS-TEST-EVOLVE",
        timestamp=anchor - timedelta(hours=6),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Pre-trip test: heavy grinding noise and pulsating brake pedal",
        source="Driver Shift Pad",
        reporter_role="driver"
    )

    assessment = risk_engine.evaluate_asset(asset, [ev1, ev2, ev3], anchor_time=anchor)

    # 3 distinct warnings trigger frequency penalty (3 - 1) * 3.5 = 7.0 pts
    assert assessment.factor_breakdown["frequency_penalty_points"] == 7.0
    # Base severity capped at max_severity_points (25.0)
    assert assessment.factor_breakdown["base_severity_points"] == 25.0
    # Contracting intervals trigger temporal acceleration
    assert assessment.factor_breakdown["temporal_acceleration_points"] == 13.0
    assert assessment.score == 45.0
    assert assessment.subsystems_breakdown["braking"].event_count == 3


# ---------------------------------------------------------------------------
# Test 5: Genuine multi-role/source corroboration still works
# ---------------------------------------------------------------------------

def test_5_genuine_multi_role_source_corroboration_works(risk_engine):
    """
    Verifies that genuine reports from distinct roles with independent findings
    are recognized as independent corroboration and receive the multi-source bonus.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-CORROB")

    ev1 = Event(
        id="ev-corrob-1",
        asset_id="BUS-TEST-CORROB",
        timestamp=anchor - timedelta(days=3),
        event_type="complaint",
        subsystem="braking",
        severity=3,
        description="Passenger reported loud grinding noise from rear brakes during deceleration",
        source="Passenger Feedback App",
        reporter_role="passenger"
    )
    ev2 = Event(
        id="ev-corrob-2",
        asset_id="BUS-TEST-CORROB",
        timestamp=anchor - timedelta(days=1),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver reported brake pedal pulsing and increased stopping distance",
        source="Driver Shift Pad",
        reporter_role="driver"
    )
    ev3 = Event(
        id="ev-corrob-3",
        asset_id="BUS-TEST-CORROB",
        timestamp=anchor - timedelta(hours=4),
        event_type="inspection",
        subsystem="braking",
        severity=4,
        description="Depot safety audit: brake caliper pressure differential 14% between axles",
        source="State Transit Safety Inspector",
        reporter_role="inspector"
    )

    assessment = risk_engine.evaluate_asset(asset, [ev1, ev2, ev3], anchor_time=anchor)

    # 3 distinct roles: driver, inspector, passenger -> tier 3 cross-source bonus = 14.0 pts
    assert assessment.factor_breakdown["cross_source_bonus_points"] == 14.0
    braking_bd = assessment.subsystems_breakdown["braking"]
    assert braking_bd.distinct_sources_count == 3
    assert braking_bd.distinct_roles == ["driver", "inspector", "passenger"]
    assert assessment.score >= 45.0


# ---------------------------------------------------------------------------
# Test 6: A genuine inspection with distinct findings remains independent
# ---------------------------------------------------------------------------

def test_6_genuine_inspection_with_distinct_findings_remains_independent(risk_engine):
    """
    Proves that an inspection report following a complaint is NOT suppressed when it
    documents distinct physical findings (e.g. caliper measurement, pad thickness).
    It contributes as independent corroboration and advances distinct role count.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-GENUINE-INSP")

    complaint = Event(
        id="ev-comp-6",
        asset_id="BUS-TEST-GENUINE-INSP",
        timestamp=anchor - timedelta(hours=6),
        event_type="complaint",
        subsystem="braking",
        severity=4,
        description="Passenger reported bus shook violently when stopping approaching transit terminal",
        source="Transit Passenger App",
        reporter_role="passenger"
    )
    inspection = Event(
        id="ev-insp-6",
        asset_id="BUS-TEST-GENUINE-INSP",
        timestamp=anchor - timedelta(hours=2),
        event_type="inspection",
        subsystem="braking",
        severity=4,
        description="Depot brake inspection: front-left brake rotor warped by 3.2mm, pad thickness 1.8mm",
        source="Depot Mechanical Inspection Log",
        reporter_role="inspector"
    )

    assessment = risk_engine.evaluate_asset(asset, [complaint, inspection], anchor_time=anchor)

    braking_bd = assessment.subsystems_breakdown["braking"]
    assert braking_bd.distinct_roles == ["inspector", "passenger"]
    assert braking_bd.distinct_sources_count == 2
    # 2 distinct roles -> tier 2 cross-source bonus = 8.0 pts
    assert assessment.factor_breakdown["cross_source_bonus_points"] == 8.0
    assert assessment.factor_breakdown["temporal_acceleration_points"] == 7.0
    assert assessment.score == 43.5


# ---------------------------------------------------------------------------
# Test 7: A copied inspection is not awarded independent corroboration
# ---------------------------------------------------------------------------

def test_7_copied_inspection_not_awarded_independent_corroboration(risk_engine):
    """
    Proves that an inspection that merely copies the text of an earlier complaint
    verbatim within 24 hours is recognized as a duplicate and does NOT receive
    independent corroboration bonus (+8.0), frequency penalty (+3.5), or double-counted severity.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-COPIED-INSP")

    shared_text = "Passenger reported severe brake shudder and grinding approaching 5th Ave"

    complaint = Event(
        id="ev-comp-7",
        asset_id="BUS-TEST-COPIED-INSP",
        timestamp=anchor - timedelta(hours=6),
        event_type="complaint",
        subsystem="braking",
        severity=4,
        description=shared_text,
        source="Transit Passenger App",
        reporter_role="passenger"
    )
    copied_inspection = Event(
        id="ev-insp-7",
        asset_id="BUS-TEST-COPIED-INSP",
        timestamp=anchor - timedelta(hours=2),
        event_type="inspection",
        subsystem="braking",
        severity=4,
        description=shared_text,  # Copied verbatim from passenger complaint
        source="Depot Inspection Log",
        reporter_role="inspector"
    )

    assessment = risk_engine.evaluate_asset(asset, [complaint, copied_inspection], anchor_time=anchor)

    # Must NOT inflate score to 36.5
    assert assessment.score == 13.8, f"Expected 13.8, got {assessment.score}"
    assert assessment.factor_breakdown["cross_source_bonus_points"] == 0.0, "Copied inspection must NOT get cross-source bonus"
    assert assessment.factor_breakdown["frequency_penalty_points"] == 0.0
    assert assessment.factor_breakdown["temporal_acceleration_points"] == 0.0
    assert assessment.factor_breakdown["base_severity_points"] == 13.76

    braking_bd = assessment.subsystems_breakdown["braking"]
    # Total submitted record count preserved
    assert braking_bd.event_count == 2
    # Distinct roles among effective evidence reflects only original author
    assert braking_bd.distinct_roles == ["passenger"]
    assert braking_bd.distinct_sources_count == 1


# ---------------------------------------------------------------------------
# Test 8: Identical text on different assets remains independent
# ---------------------------------------------------------------------------

def test_8_identical_text_different_assets_remains_independent(risk_engine):
    """
    Proves that deduplication never crosses asset boundaries: identical text reported
    for two different vehicles (e.g. BUS-801 and BUS-802) evaluates independently.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    desc = "Driver reported abnormal brake pedal travel and resistance"

    ev_a = Event(
        id="ev-asset-a",
        asset_id="BUS-801",
        timestamp=anchor - timedelta(hours=1),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver"
    )
    ev_b = Event(
        id="ev-asset-b",
        asset_id="BUS-802",
        timestamp=anchor - timedelta(hours=1),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver"
    )

    eval_a = risk_engine.evaluate_asset(Asset(asset_id="BUS-801"), [ev_a, ev_b], anchor_time=anchor)
    eval_b = risk_engine.evaluate_asset(Asset(asset_id="BUS-802"), [ev_a, ev_b], anchor_time=anchor)

    # Neither asset suppresses the event or cross-deduplicates against the other
    assert eval_a.score == 14.0
    assert eval_a.contributing_event_ids == ["ev-asset-a"]
    assert eval_b.score == 14.0
    assert eval_b.contributing_event_ids == ["ev-asset-b"]


# ---------------------------------------------------------------------------
# Test 9: Identical text in unrelated subsystems remains independent
# ---------------------------------------------------------------------------

def test_9_identical_text_unrelated_subsystems_remains_independent(risk_engine):
    """
    Proves that deduplication never crosses subsystem boundaries: identical text reported
    for braking vs powertrain on the same asset evaluates independently in both subsystems.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-SUBS")

    desc = "Excessive vibration and rattling noise detected during operation"

    ev_brake = Event(
        id="ev-sub-brake",
        asset_id="BUS-TEST-SUBS",
        timestamp=anchor - timedelta(hours=2),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver"
    )
    ev_power = Event(
        id="ev-sub-power",
        asset_id="BUS-TEST-SUBS",
        timestamp=anchor - timedelta(hours=1),
        event_type="operational_report",
        subsystem="powertrain",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver"
    )

    assessment = risk_engine.evaluate_asset(asset, [ev_brake, ev_power], anchor_time=anchor)

    assert "braking" in assessment.subsystems_breakdown
    assert "powertrain" in assessment.subsystems_breakdown
    assert assessment.subsystems_breakdown["braking"].event_count == 1
    assert assessment.subsystems_breakdown["powertrain"].event_count == 1
    assert assessment.subsystems_breakdown["braking"].base_severity_points >= 13.0
    assert assessment.subsystems_breakdown["powertrain"].base_severity_points >= 13.0


# ---------------------------------------------------------------------------
# Test 10: Reports outside the 24-hour duplicate window follow documented policy
# ---------------------------------------------------------------------------

def test_10_reports_outside_24_hour_window_follow_recurrence_policy(risk_engine):
    """
    Proves that identical reports submitted more than 24 hours apart represent
    recurring issues over time (or failure to resolve), and both remain effective evidence.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-RECUR")

    desc = "Driver reported severe brake shudder and long stopping distance"

    ev1 = Event(
        id="ev-recur-1",
        asset_id="BUS-TEST-RECUR",
        timestamp=anchor - timedelta(days=5),  # 120 hours ago
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver"
    )
    ev2 = Event(
        id="ev-recur-2",
        asset_id="BUS-TEST-RECUR",
        timestamp=anchor - timedelta(days=1),  # 24 hours ago (delta = 96h > 24h)
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver"
    )

    assessment = risk_engine.evaluate_asset(asset, [ev1, ev2], anchor_time=anchor)

    # Outside 24-hour window: both events count as effective evidence
    assert assessment.subsystems_breakdown["braking"].event_count == 2
    # Frequency penalty applies for recurring events (2 - 1) * 3.5 = 3.5
    assert assessment.factor_breakdown["frequency_penalty_points"] == 3.5
    # Score reflects legitimate recurrence (30.0), not clamped to single event (14.0)
    assert assessment.score == 30.0


# ---------------------------------------------------------------------------
# Test 11: Duplicate detection behaves deterministically regardless of event ordering
# ---------------------------------------------------------------------------

def test_11_duplicate_detection_order_invariance(risk_engine):
    """
    Proves that risk score, confidence, and factor breakdowns are strictly identical
    regardless of input event permutation or database return ordering.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-ORDER")

    ev1 = Event(
        id="ev-ord-1",
        asset_id="BUS-TEST-ORDER",
        timestamp=anchor - timedelta(hours=4),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver reported brake shudder",
        source="Driver Pad",
        reporter_role="driver"
    )
    ev2 = Event(
        id="ev-ord-2",
        asset_id="BUS-TEST-ORDER",
        timestamp=anchor - timedelta(hours=3),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver reported brake shudder",  # Duplicate of ev1
        source="Driver Pad",
        reporter_role="driver"
    )
    ev3 = Event(
        id="ev-ord-3",
        asset_id="BUS-TEST-ORDER",
        timestamp=anchor - timedelta(hours=1),
        event_type="complaint",
        subsystem="braking",
        severity=3,
        description="Passenger noted stopping jerkiness",  # Distinct event
        source="Passenger App",
        reporter_role="passenger"
    )

    perm_1 = [ev1, ev2, ev3]
    perm_2 = [ev3, ev2, ev1]
    perm_3 = [ev2, ev3, ev1]
    perm_4 = [ev1, ev3, ev2]

    eval_1 = risk_engine.evaluate_asset(asset, perm_1, anchor_time=anchor)
    eval_2 = risk_engine.evaluate_asset(asset, perm_2, anchor_time=anchor)
    eval_3 = risk_engine.evaluate_asset(asset, perm_3, anchor_time=anchor)
    eval_4 = risk_engine.evaluate_asset(asset, perm_4, anchor_time=anchor)

    assert eval_1.score == eval_2.score == eval_3.score == eval_4.score
    assert eval_1.confidence == eval_2.confidence == eval_3.confidence == eval_4.confidence
    assert eval_1.factor_breakdown == eval_2.factor_breakdown == eval_3.factor_breakdown == eval_4.factor_breakdown
    assert eval_1.risk_level == eval_2.risk_level == eval_3.risk_level == eval_4.risk_level
    assert eval_1.trend == eval_2.trend == eval_3.trend == eval_4.trend


# ---------------------------------------------------------------------------
# Test 12: Existing mitigation behavior and WHY NOW crash fix remain intact
# ---------------------------------------------------------------------------

def test_12_mitigation_and_why_now_regressions_intact(client, risk_engine):
    """
    Proves that commit ae12fc6 remains fully intact:
    1. Operational reports mentioning 'repaired' or 'replace' do not trigger mitigation.
    2. Valid corrective actions apply intended mitigation discount (-22.0).
    3. Verified post-repair inspections apply intended verified discount (-35.0).
    4. WhyNow analyzer runs without crash and correctly handles mitigation evidence.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-MIT-INTACT")

    # 1. Unmitigated warning mentioning repair
    warning = Event(
        id="ev-mit-warn",
        asset_id="BUS-TEST-MIT-INTACT",
        timestamp=anchor - timedelta(days=2),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver noted: workshop repaired the brakes yesterday but pedal remains soft",
        source="Driver Pad",
        reporter_role="driver"
    )
    is_mit, _, _ = RiskEngine._analyze_mitigation_event(warning)
    assert is_mit is False, "Warning narrative with 'repaired' must not trigger mitigation"

    # 2. Legitimate completed corrective action
    repair = Event(
        id="ev-mit-repair",
        asset_id="BUS-TEST-MIT-INTACT",
        timestamp=anchor - timedelta(hours=6),
        event_type="corrective_action",
        subsystem="braking",
        severity=1,
        description="Depot workshop: front and rear brake friction pads replaced and calipers overhauled",
        source="Depot Workshop Log",
        reporter_role="technician",
        raw_metadata={"status": "completed"}
    )
    is_mit, is_ver, _ = RiskEngine._analyze_mitigation_event(repair)
    assert is_mit is True
    assert is_ver is False

    eval_repair = risk_engine.evaluate_asset(asset, [warning, repair], anchor_time=anchor)
    assert eval_repair.factor_breakdown["mitigation_discount_points"] == 22.0

    # 3. Why-Now explanation runs without crash and generates valid factor contribution
    why_now = WhyNowAnalyzer.generate_explanation(asset, [warning, repair], eval_repair)
    assert why_now is not None
    mit_factors = [f for f in why_now.factor_contributions if f.factor_key == "mitigation_discount_points"]
    assert len(mit_factors) == 1
    assert mit_factors[0].points == -22.0

    # 4. Verified post-repair inspection applies 35.0 verified discount
    verified_insp = Event(
        id="ev-mit-verified",
        asset_id="BUS-TEST-MIT-INTACT",
        timestamp=anchor - timedelta(hours=3),
        event_type="inspection",
        subsystem="braking",
        severity=1,
        description="Depot quality audit: brake overhaul post-repair inspection passed",
        source="Depot Quality Inspector",
        reporter_role="inspector",
        raw_metadata={"status": "verified"}
    )
    is_mit_v, is_ver_v, _ = RiskEngine._analyze_mitigation_event(verified_insp)
    assert is_mit_v is True
    assert is_ver_v is True

    eval_verified = risk_engine.evaluate_asset(asset, [warning, verified_insp], anchor_time=anchor)
    assert eval_verified.factor_breakdown["mitigation_discount_points"] == 35.0


# ---------------------------------------------------------------------------
# Test 13: Metadata author preservation prevents false deduplication
# ---------------------------------------------------------------------------

def test_13_distinct_author_metadata_preserves_independence(risk_engine):
    """
    Proves that when two reports have identical text within 24h, but raw_metadata
    proves distinct human authors (e.g. driver_id DRV-1 vs DRV-2), both are preserved
    as independent evidence rather than falsely suppressed.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-AUTH")

    desc = "Brake shudder observed during revenue service"

    ev1 = Event(
        id="ev-auth-1",
        asset_id="BUS-TEST-AUTH",
        timestamp=anchor - timedelta(hours=3),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver",
        raw_metadata={"driver_id": "DRV-101"}
    )
    ev2 = Event(
        id="ev-auth-2",
        asset_id="BUS-TEST-AUTH",
        timestamp=anchor - timedelta(hours=1),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver",
        raw_metadata={"driver_id": "DRV-102"}
    )

    assessment = risk_engine.evaluate_asset(asset, [ev1, ev2], anchor_time=anchor)

    # Distinct drivers reporting same fault -> frequency penalty applies, neither suppressed
    assert assessment.subsystems_breakdown["braking"].event_count == 2
    assert assessment.factor_breakdown["frequency_penalty_points"] == 3.5


# ---------------------------------------------------------------------------
# Test 14: Controlled canonical identity and input order permutation invariance
# ---------------------------------------------------------------------------

def test_14_controlled_canonical_identity_and_permutation_invariance(risk_engine):
    """
    Directly addresses Phase 6C Requirement 1:
    Evaluates the exact same canonical event:
    1. By itself.
    2. Alongside two duplicate submissions.
    Proves that the score and all factor breakdown points are mathematically IDENTICAL
    (e.g. 14.0 vs 14.0, zero discrepancy).
    Also proves that reversing or randomizing input order preserves exact scores.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-CANONICAL")

    # Canonical original event at anchor - 1 hour
    canonical_event = Event(
        id="ev-canon-orig",
        asset_id="BUS-TEST-CANONICAL",
        timestamp=anchor - timedelta(hours=1),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver reported severe brake shudder and long stopping distance",
        source="Driver Shift Pad",
        reporter_role="driver"
    )

    # Subsequent duplicate submissions 15min and 30min later
    dup_event_1 = Event(
        id="ev-canon-dup1",
        asset_id="BUS-TEST-CANONICAL",
        timestamp=anchor - timedelta(minutes=45),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver reported severe brake shudder and long stopping distance",
        source="Driver Shift Pad",
        reporter_role="driver"
    )
    dup_event_2 = Event(
        id="ev-canon-dup2",
        asset_id="BUS-TEST-CANONICAL",
        timestamp=anchor - timedelta(minutes=30),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver reported severe brake shudder and long stopping distance",
        source="Driver Shift Pad",
        reporter_role="driver"
    )

    # 1. Evaluate canonical event by itself
    eval_single = risk_engine.evaluate_asset(asset, [canonical_event], anchor_time=anchor)

    # 2. Evaluate canonical event alongside two duplicate submissions
    eval_with_dups = risk_engine.evaluate_asset(
        asset,
        [canonical_event, dup_event_1, dup_event_2],
        anchor_time=anchor
    )

    # Mathematical identity: score and factor points must match exactly
    assert eval_single.score == eval_with_dups.score == 14.0
    assert eval_single.factor_breakdown == eval_with_dups.factor_breakdown
    assert eval_single.confidence == eval_with_dups.confidence
    assert eval_single.risk_level == eval_with_dups.risk_level

    # 3. Test reversed and permuted input orders
    perm_rev = [dup_event_2, dup_event_1, canonical_event]
    perm_rand = [dup_event_1, canonical_event, dup_event_2]

    eval_rev = risk_engine.evaluate_asset(asset, perm_rev, anchor_time=anchor)
    eval_rand = risk_engine.evaluate_asset(asset, perm_rand, anchor_time=anchor)

    assert eval_rev.score == eval_single.score == 14.0
    assert eval_rand.score == eval_single.score == 14.0
    assert eval_rev.factor_breakdown == eval_single.factor_breakdown
    assert eval_rand.factor_breakdown == eval_single.factor_breakdown


# ---------------------------------------------------------------------------
# Test 15: Exact 24-hour boundary threshold (just inside vs just outside)
# ---------------------------------------------------------------------------

def test_15_exact_24_hour_boundary_threshold(risk_engine):
    """
    Directly tests the 24-hour duplicate window boundary:
    - 23 hours 59 minutes (86,340s <= 86,400s): classified as duplicate candidate (effective = 1).
    - 24 hours 1 minute (86,460s > 86,400s): classified as recurring operational observation (effective = 2).
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset_in = Asset(asset_id="BUS-TEST-BOUND-IN")
    asset_out = Asset(asset_id="BUS-TEST-BOUND-OUT")

    desc = "Brake pedal soft and spongy on downhill gradient"

    ev_base = Event(
        id="ev-bound-base",
        asset_id="BUS-TEST-BOUND-IN",
        timestamp=anchor - timedelta(hours=25),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver"
    )

    # Exactly 23h 59m after ev_base (86,340s delta <= 86,400s -> DUPLICATE)
    ev_inside = Event(
        id="ev-bound-inside",
        asset_id="BUS-TEST-BOUND-IN",
        timestamp=ev_base.timestamp + timedelta(hours=23, minutes=59),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver"
    )

    eval_inside = risk_engine.evaluate_asset(asset_in, [ev_base, ev_inside], anchor_time=anchor)
    assert eval_inside.factor_breakdown["frequency_penalty_points"] == 0.0, "Inside 24h must be treated as duplicate"
    assert eval_inside.subsystems_breakdown["braking"].distinct_sources_count == 1

    # Exactly 24h 1m after ev_base (86,460s delta > 86,400s -> RECURRING EVIDENCE)
    ev_base_out = Event(
        id="ev-bound-out-base",
        asset_id="BUS-TEST-BOUND-OUT",
        timestamp=anchor - timedelta(hours=26),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver"
    )
    ev_outside = Event(
        id="ev-bound-outside",
        asset_id="BUS-TEST-BOUND-OUT",
        timestamp=ev_base_out.timestamp + timedelta(hours=24, minutes=1),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc,
        source="Driver Pad",
        reporter_role="driver"
    )

    eval_outside = risk_engine.evaluate_asset(asset_out, [ev_base_out, ev_outside], anchor_time=anchor)
    assert eval_outside.factor_breakdown["frequency_penalty_points"] == 3.5, "Outside 24h must receive recurrence penalty"
    assert eval_outside.score > eval_inside.score


# ---------------------------------------------------------------------------
# Test 16: Missing reporter identity and generic narrative policy
# ---------------------------------------------------------------------------

def test_16_missing_reporter_identity_and_generic_narrative(risk_engine):
    """
    Tests policy for missing reporter identity with generic narrative:
    When two identical generic reports arrive within 24h without metadata proving
    independent authorship, PREVENT conservatively suppresses duplicate evidence multiplication
    while preserving all records in event_count and contributing_event_ids.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-GENERIC")

    ev1 = Event(
        id="ev-gen-1",
        asset_id="BUS-TEST-GENERIC",
        timestamp=anchor - timedelta(hours=4),
        event_type="operational_report",
        subsystem="braking",
        severity=3,
        description="brake noise",
        source="Intake Form",
        reporter_role="operator",
        raw_metadata=None  # No authenticated author ID
    )
    ev2 = Event(
        id="ev-gen-2",
        asset_id="BUS-TEST-GENERIC",
        timestamp=anchor - timedelta(hours=2),
        event_type="operational_report",
        subsystem="braking",
        severity=3,
        description="brake noise",
        source="Intake Form",
        reporter_role="operator",
        raw_metadata=None  # No authenticated author ID
    )

    assessment = risk_engine.evaluate_asset(asset, [ev1, ev2], anchor_time=anchor)

    # Conservative policy: suppress duplicate evidence multiplication
    assert assessment.factor_breakdown["frequency_penalty_points"] == 0.0
    # Provenance preserved: both events tracked
    assert assessment.subsystems_breakdown["braking"].event_count == 2
    assert "ev-gen-1" in assessment.contributing_event_ids
    assert "ev-gen-2" in assessment.contributing_event_ids


# ---------------------------------------------------------------------------
# Test 17: Post-mitigation re-escalation with duplicates
# ---------------------------------------------------------------------------

def test_17_post_mitigation_re_escalation_with_duplicates(risk_engine):
    """
    Verifies that when a completed mitigation is followed by recurring faults,
    a single new fault re-escalates risk, but duplicate submissions of that new fault
    do NOT triple-count re-escalation or post-repair penalties.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-RE-ESC")

    warning_pre = Event(
        id="ev-pre-warn",
        asset_id="BUS-TEST-RE-ESC",
        timestamp=anchor - timedelta(days=6),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver reported brake shudder",
        source="Driver Pad",
        reporter_role="driver"
    )
    repair = Event(
        id="ev-repair-done",
        asset_id="BUS-TEST-RE-ESC",
        timestamp=anchor - timedelta(days=4),
        event_type="corrective_action",
        subsystem="braking",
        severity=1,
        description="Depot workshop: front and rear brake friction pads replaced and calipers overhauled",
        source="Depot Workshop Log",
        reporter_role="technician",
        raw_metadata={"status": "completed"}
    )

    # Post-repair recurrence (submitted once)
    desc_post = "Post-service test: brake pedal remains soft and shudder re-occurred"
    warning_post_1 = Event(
        id="ev-post-warn-1",
        asset_id="BUS-TEST-RE-ESC",
        timestamp=anchor - timedelta(hours=4),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc_post,
        source="Driver Pad",
        reporter_role="driver"
    )

    eval_single_re_esc = risk_engine.evaluate_asset(
        asset,
        [warning_pre, repair, warning_post_1],
        anchor_time=anchor
    )
    assert eval_single_re_esc.score > 0.0, "New post-repair warning must re-escalate risk"

    # Post-repair recurrence submitted 3 times (duplicates within 2 hours)
    warning_post_2 = Event(
        id="ev-post-warn-2",
        asset_id="BUS-TEST-RE-ESC",
        timestamp=anchor - timedelta(hours=3),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc_post,
        source="Driver Pad",
        reporter_role="driver"
    )
    warning_post_3 = Event(
        id="ev-post-warn-3",
        asset_id="BUS-TEST-RE-ESC",
        timestamp=anchor - timedelta(hours=2),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description=desc_post,
        source="Driver Pad",
        reporter_role="driver"
    )

    eval_dup_re_esc = risk_engine.evaluate_asset(
        asset,
        [warning_pre, repair, warning_post_1, warning_post_2, warning_post_3],
        anchor_time=anchor
    )

    # Duplicates must NOT amplify re-escalation or triple-penalize mitigation
    assert eval_dup_re_esc.score == eval_single_re_esc.score
    assert eval_dup_re_esc.factor_breakdown == eval_single_re_esc.factor_breakdown


# ---------------------------------------------------------------------------
# Test 18: Incident vs routine maintenance incompatibility prevents false suppression
# ---------------------------------------------------------------------------

def test_18_incident_vs_routine_maintenance_incompatibility(risk_engine):
    """
    Proves that an acute severe safety incident (severity 5) is NEVER suppressed as a
    duplicate of a routine maintenance task, even if narrative phrases overlap.
    """
    anchor = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-INCIDENT")

    overlap_text = "Brake failure inspection required"

    routine = Event(
        id="ev-maint-1",
        asset_id="BUS-TEST-INCIDENT",
        timestamp=anchor - timedelta(hours=5),
        event_type="maintenance",
        subsystem="braking",
        severity=1,
        description=overlap_text,
        source="Depot Schedule",
        reporter_role="technician"
    )
    incident = Event(
        id="ev-inc-1",
        asset_id="BUS-TEST-INCIDENT",
        timestamp=anchor - timedelta(hours=2),
        event_type="incident",
        subsystem="braking",
        severity=5,
        description=overlap_text,
        source="Safety Dispatch",
        reporter_role="safety_officer"
    )

    assessment = risk_engine.evaluate_asset(asset, [routine, incident], anchor_time=anchor)

    # Incompatible contexts: the severity 5 incident must NOT be suppressed by routine maintenance
    assert assessment.factor_breakdown["near_miss_anchor_points"] > 0.0, "Incident anchor must remain active"
    assert assessment.score >= 40.0
    assert assessment.subsystems_breakdown["braking"].event_count == 2

