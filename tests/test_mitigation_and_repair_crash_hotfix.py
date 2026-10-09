"""
Regression tests for PREVENT Safety Correctness Hotfix 1:
1. Fixes WHY NOW crash after a repair event (resolves staticmethod reference).
2. Proves warning/incident descriptions mentioning 'repaired' or 'replace' do not trigger mitigation.
3. Proves legitimate corrective_action events apply intended mitigation.
4. Proves verified inspection behavior is preserved.
5. Proves end-to-end API flow via /api/v1/events, /api/v1/assets/{id}/dossier, and /api/v1/assets/{id}/why-now.
"""
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.schemas.event import EventCreate
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
# Test 1: End-to-End API Flow & WHY NOW Crash Prevention (Step 2)
# ---------------------------------------------------------------------------

def test_repair_event_end_to_end_why_now_does_not_crash(client, db_session):
    """
    Submits a valid corrective_action event for BUS-142 through the supported API flow,
    then requests the affected asset dossier and WHY NOW data.
    Verifies that neither endpoint crashes with NameError: 'self', returns HTTP 200,
    and reflects the mitigation discount and evidence item.
    """
    # 1. Ingest a valid corrective-action event for BUS-142
    repair_payload = {
        "asset_id": "BUS-142",
        "event_type": "corrective_action",
        "subsystem": "braking",
        "severity": 1,
        "description": "Depot workshop: front and rear brake friction pads replaced and calipers overhauled",
        "source": "Depot Workshop Log",
        "reporter_role": "technician"
    }
    ingest_res = client.post("/api/v1/events", json=repair_payload)
    assert ingest_res.status_code == 201, f"Expected 201 Created, got {ingest_res.status_code}: {ingest_res.text}"
    ingested_data = ingest_res.json()
    repair_event_id = ingested_data["event"]["id"]

    # 2. Request the asset dossier
    dossier_res = client.get("/api/v1/assets/BUS-142")
    assert dossier_res.status_code == 200, f"Dossier failed: {dossier_res.text}"
    dossier_data = dossier_res.json()

    assert dossier_data["asset"]["asset_id"] == "BUS-142"
    assert "braking" in dossier_data["subsystems_breakdown"]
    assert dossier_data["factor_breakdown"]["mitigation_discount_points"] == 22.0
    assert dossier_data["why_now"] is not None

    # 3. Request the WHY NOW explanation endpoint directly
    why_now_res = client.get("/api/v1/assets/BUS-142/why-now")
    assert why_now_res.status_code == 200, f"Why-Now failed: {why_now_res.text}"
    why_now_data = why_now_res.json()

    # Confirm mitigation signal is populated and references the repair event
    mitigation_signals = [s for s in why_now_data["signals"] if s["label"] == "Mitigation discount applied"]
    assert len(mitigation_signals) == 1, f"Expected 1 mitigation signal, got {len(mitigation_signals)}"
    sig = mitigation_signals[0]
    assert "Hazard mitigated (-22.0 pts)" in sig["value"]
    assert repair_event_id in sig["evidence_event_ids"]

    # Confirm factor contributions include the mitigation credit
    mit_factors = [f for f in why_now_data["factor_contributions"] if f["factor_key"] == "mitigation_discount_points"]
    assert len(mit_factors) == 1
    assert mit_factors[0]["points"] == -22.0


# ---------------------------------------------------------------------------
# Test 2: Warning / Incident Descriptions Must NOT Trigger Mitigation (Step 3)
# ---------------------------------------------------------------------------

def test_operational_report_describing_repair_does_not_trigger_mitigation(risk_engine):
    """
    An operational report describing a repair must NOT qualify as a mitigation
    or reduce the risk score.
    """
    anchor = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-TEST-OP")
    
    # Pre-existing brake warning
    warning = Event(
        id="ev-warn-1",
        asset_id="BUS-TEST-OP",
        timestamp=anchor - timedelta(days=2),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver reported severe brake shudder and long stopping distance",
        source="Driver Pad",
        reporter_role="driver"
    )
    baseline_eval = risk_engine.evaluate_asset(asset, [warning], anchor_time=anchor)
    assert baseline_eval.score > 0.0

    # Operational report mentioning a repair was performed
    op_report_repair = Event(
        id="ev-op-repair",
        asset_id="BUS-TEST-OP",
        timestamp=anchor - timedelta(hours=3),
        event_type="operational_report",
        subsystem="braking",
        severity=3,
        description="Driver noted: workshop repaired the brakes yesterday but pedal remains soft",
        source="Driver Shift Pad",
        reporter_role="driver"
    )

    is_mit, is_ver, reason = RiskEngine._analyze_mitigation_event(op_report_repair)
    assert is_mit is False, f"operational_report must not be classified as mitigation: {reason}"
    assert is_ver is False

    eval_with_op = risk_engine.evaluate_asset(asset, [warning, op_report_repair], anchor_time=anchor)
    # Mitigation discount must be strictly 0.0
    assert eval_with_op.factor_breakdown.get("mitigation_discount_points", 0.0) == 0.0
    # Additional warning should escalate or maintain, never discount
    assert eval_with_op.score >= baseline_eval.score


def test_collision_report_containing_repaired_does_not_trigger_mitigation(risk_engine):
    """
    A collision/incident report containing the word 'repaired' must NOT qualify as
    a completed mitigation or discount risk.
    """
    anchor = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-TEST-CRASH")

    crash_event = Event(
        id="ev-crash-1",
        asset_id="BUS-TEST-CRASH",
        timestamp=anchor - timedelta(hours=2),
        event_type="incident",
        subsystem="braking",
        severity=5,
        description="Collision incident: bus struck barrier after brake failure. Front bumper had been repaired last week.",
        source="Safety Dispatch",
        reporter_role="safety_officer"
    )

    is_mit, is_ver, reason = RiskEngine._analyze_mitigation_event(crash_event)
    assert is_mit is False, f"incident must never be classified as mitigation: {reason}"
    assert is_ver is False

    crash_eval = risk_engine.evaluate_asset(asset, [crash_event], anchor_time=anchor)
    assert crash_eval.factor_breakdown.get("mitigation_discount_points", 0.0) == 0.0
    assert crash_eval.score >= 45.0
    assert crash_eval.risk_level in ("MEDIUM", "HIGH", "CRITICAL")


def test_report_saying_pads_need_to_be_replaced_urgently_does_not_trigger_mitigation(risk_engine):
    """
    A report stating 'pads need to be replaced urgently' must NOT qualify as a completed
    mitigation or reduce risk to 0.0.
    """
    anchor = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-TEST-URGENT")

    urgent_report = Event(
        id="ev-urgent-1",
        asset_id="BUS-TEST-URGENT",
        timestamp=anchor - timedelta(hours=1),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Driver inspection: friction pads worn past safe limit, pads need to be replaced urgently",
        source="Driver Log",
        reporter_role="driver"
    )

    is_mit, is_ver, reason = RiskEngine._analyze_mitigation_event(urgent_report)
    assert is_mit is False, f"Urgent replacement request must NOT be classified as mitigation: {reason}"
    assert is_ver is False

    eval_result = risk_engine.evaluate_asset(asset, [urgent_report], anchor_time=anchor)
    assert eval_result.factor_breakdown.get("mitigation_discount_points", 0.0) == 0.0
    assert eval_result.score > 0.0, "Score must not collapse to 0.0 for an urgent unmitigated hazard"


def test_corrective_action_with_pending_status_does_not_trigger_mitigation(risk_engine):
    """
    Even with event_type='corrective_action', if the work is pending, scheduled,
    or unresolved, it must NOT qualify as completed mitigation.
    """
    pending_event_desc = Event(
        id="ev-sched-1",
        asset_id="BUS-TEST-SCHED",
        timestamp=datetime.now(timezone.utc),
        event_type="corrective_action",
        subsystem="braking",
        severity=2,
        description="Brake caliper replacement scheduled for next Monday",
        source="Shop Log",
        reporter_role="technician"
    )
    is_mit, _, reason = RiskEngine._analyze_mitigation_event(pending_event_desc)
    assert is_mit is False
    assert "scheduled" in reason.lower()

    pending_event_meta = Event(
        id="ev-sched-2",
        asset_id="BUS-TEST-SCHED",
        timestamp=datetime.now(timezone.utc),
        event_type="corrective_action",
        subsystem="braking",
        severity=2,
        description="Brake overhaul",
        source="Shop Log",
        reporter_role="technician",
        raw_metadata={"status": "pending"}
    )
    is_mit, _, reason = RiskEngine._analyze_mitigation_event(pending_event_meta)
    assert is_mit is False


# ---------------------------------------------------------------------------
# Test 3: Legitimate Corrective Action & Verified Inspection Retain Behavior
# ---------------------------------------------------------------------------

def test_legitimate_corrective_action_applies_mitigation(risk_engine):
    """
    A legitimate corrective_action event must apply the standard repair discount (22.0 pts).
    """
    anchor = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-TEST-LEGIT")

    warning = Event(
        id="ev-w1",
        asset_id="BUS-TEST-LEGIT",
        timestamp=anchor - timedelta(days=2),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Severe brake pedal pulsation",
        source="Driver Pad",
        reporter_role="driver"
    )
    baseline_eval = risk_engine.evaluate_asset(asset, [warning], anchor_time=anchor)

    repair = Event(
        id="ev-r1",
        asset_id="BUS-TEST-LEGIT",
        timestamp=anchor - timedelta(hours=2),
        event_type="corrective_action",
        subsystem="braking",
        severity=1,
        description="Depot workshop: front brake calipers overhauled and new friction pads installed",
        source="Depot Workshop Log",
        reporter_role="technician"
    )

    is_mit, is_ver, reason = RiskEngine._analyze_mitigation_event(repair)
    assert is_mit is True
    assert is_ver is False
    assert reason == "Corrective action / repair completed"

    eval_repaired = risk_engine.evaluate_asset(asset, [warning, repair], anchor_time=anchor)
    assert eval_repaired.factor_breakdown["mitigation_discount_points"] == 22.0
    assert eval_repaired.score < baseline_eval.score


def test_verified_inspection_applies_verified_mitigation(risk_engine):
    """
    An inspection event with verified post-repair keywords or metadata must
    apply the verified mitigation discount (35.0 pts).
    """
    anchor = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-TEST-VERIFY")

    warning = Event(
        id="ev-w1",
        asset_id="BUS-TEST-VERIFY",
        timestamp=anchor - timedelta(days=3),
        event_type="complaint",
        subsystem="braking",
        severity=4,
        description="Braking failure complaint",
        source="Passenger App",
        reporter_role="passenger"
    )

    repair = Event(
        id="ev-r1",
        asset_id="BUS-TEST-VERIFY",
        timestamp=anchor - timedelta(days=1),
        event_type="corrective_action",
        subsystem="braking",
        severity=1,
        description="Brake pads replaced",
        source="Workshop",
        reporter_role="technician"
    )

    verified_inspection = Event(
        id="ev-v1",
        asset_id="BUS-TEST-VERIFY",
        timestamp=anchor - timedelta(hours=2),
        event_type="inspection",
        subsystem="braking",
        severity=1,
        description="State safety audit: post-repair inspection passed and deceleration verified at 0.68g",
        source="Safety Inspector",
        reporter_role="inspector"
    )

    is_mit, is_ver, reason = RiskEngine._analyze_mitigation_event(verified_inspection)
    assert is_mit is True
    assert is_ver is True
    assert reason == "Post-repair verification passed"

    eval_verified = risk_engine.evaluate_asset(asset, [warning, repair, verified_inspection], anchor_time=anchor)
    assert eval_verified.factor_breakdown["mitigation_discount_points"] == 35.0


def test_unverified_defect_inspection_remains_warning(risk_engine):
    """
    An inspection event that notes a defect without verification keywords
    must NOT be classified as mitigation and must remain an active warning.
    """
    defect_inspection = Event(
        id="ev-insp-defect",
        asset_id="BUS-TEST-DEFECT",
        timestamp=datetime.now(timezone.utc),
        event_type="inspection",
        subsystem="braking",
        severity=3,
        description="Routine spot audit: brake air line imbalance and pressure differential noted",
        source="State Inspector",
        reporter_role="inspector"
    )
    is_mit, is_ver, reason = RiskEngine._analyze_mitigation_event(defect_inspection)
    assert is_mit is False
    assert is_ver is False
    assert reason == "Standard operational event"


def test_ambiguous_corrective_action_does_not_trigger_mitigation(risk_engine):
    """
    Case 6: A corrective_action event with no explicit completion status and ambiguous
    narrative (e.g. 'evaluated assembly') must NOT receive a mitigation discount.
    """
    anchor = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-TEST-AMBIGUOUS")
    warning = Event(
        id="ev-w1",
        asset_id="BUS-TEST-AMBIGUOUS",
        timestamp=anchor - timedelta(days=2),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Brake pedal shudder",
        source="Driver Pad",
        reporter_role="driver"
    )
    ambiguous_action = Event(
        id="ev-ambig",
        asset_id="BUS-TEST-AMBIGUOUS",
        timestamp=anchor - timedelta(hours=1),
        event_type="corrective_action",
        subsystem="braking",
        severity=2,
        description="Technician evaluated brake assembly and checked hydraulic lines",
        source="Shop Log",
        reporter_role="technician"
    )
    is_mit, is_ver, reason = RiskEngine._analyze_mitigation_event(ambiguous_action)
    assert is_mit is False
    assert is_ver is False
    assert "does not establish completed repair" in reason

    eval_result = risk_engine.evaluate_asset(asset, [warning, ambiguous_action], anchor_time=anchor)
    assert eval_result.factor_breakdown.get("mitigation_discount_points", 0.0) == 0.0


def test_contradictory_metadata_does_not_trigger_mitigation(risk_engine):
    """
    Case 9: A corrective_action event with contradictory metadata and description
    (e.g. status='completed' but narrative states 'issue persists') must NOT qualify as mitigation.
    """
    contradictory_event = Event(
        id="ev-contradict",
        asset_id="BUS-TEST-CONTRA",
        timestamp=datetime.now(timezone.utc),
        event_type="corrective_action",
        subsystem="braking",
        severity=2,
        description="Brake overhaul attempted, but issue persists on test drive",
        source="Shop Log",
        reporter_role="technician",
        raw_metadata={"status": "completed"}
    )
    is_mit, is_ver, reason = RiskEngine._analyze_mitigation_event(contradictory_event)
    assert is_mit is False
    assert is_ver is False
    assert "hazard remains active" in reason.lower()


def test_unrelated_subsystem_repair_does_not_discount_target_hazard(risk_engine):
    """
    Case 10: A completed repair on an unrelated subsystem (e.g. HVAC) must NOT
    discount the risk points of an active hazard in another subsystem (e.g. braking).
    """
    anchor = datetime.now(timezone.utc)
    asset = Asset(asset_id="BUS-TEST-UNRELATED")
    brake_warning = Event(
        id="ev-bw1",
        asset_id="BUS-TEST-UNRELATED",
        timestamp=anchor - timedelta(days=2),
        event_type="operational_report",
        subsystem="braking",
        severity=4,
        description="Severe brake pedal pulsation",
        source="Driver Pad",
        reporter_role="driver"
    )
    base_eval = risk_engine.evaluate_asset(asset, [brake_warning], anchor_time=anchor)

    hvac_repair = Event(
        id="ev-hr1",
        asset_id="BUS-TEST-UNRELATED",
        timestamp=anchor - timedelta(hours=1),
        event_type="corrective_action",
        subsystem="hvac",
        severity=1,
        description="Replaced cabin air filter and AC blower motor",
        source="Shop Log",
        reporter_role="technician",
        raw_metadata={"status": "completed"}
    )
    eval_with_hvac = risk_engine.evaluate_asset(asset, [brake_warning, hvac_repair], anchor_time=anchor)

    # Mitigation discount on primary subsystem (braking) must be 0.0
    assert eval_with_hvac.subsystems_breakdown["braking"].mitigation_discount_points == 0.0
    assert eval_with_hvac.score == base_eval.score
