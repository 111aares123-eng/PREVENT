"""
Automated Pytest Suite for Phase 1B:
- Deterministic Risk Engine & Factor Waterfall
- Recency Decay
- Frequency Penalty
- Cross-Source Corroboration vs Same-Source Repetition
- Temporal Acceleration & Contracting Intervals
- Near-Miss Anchor
- Bounded 0-100 Risk & Confidence Scores
- Confidence vs Risk Independence
- What-If Simulation Non-Mutation
- Evidence Graph Structured Relations
"""
import copy
from datetime import datetime, timezone, timedelta
import pytest
from backend.app.core.config import settings, RiskScoringWeights, ConfidenceScoringWeights
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.services.temporal_analyzer import TemporalAnalyzer
from backend.app.services.correlation_engine import CorrelationEngine
from backend.app.services.risk_engine import RiskEngine
from data.scenarios.seed_data import seed_database


@pytest.fixture(scope="module", autouse=True)
def setup_seed_db():
    """Ensure database is seeded with the canonical 8 assets and 32 events."""
    seed_database(reset=True)


@pytest.fixture
def db_session():
    """Provide a database session for tests."""
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def risk_engine():
    """Provide a RiskEngine instance with default settings."""
    return RiskEngine()


# ---------------------------------------------------------------------------
# 1. High-Risk Target Asset (BUS-142)
# ---------------------------------------------------------------------------

def test_bus142_high_risk_and_factors(db_session, risk_engine):
    """
    Verify that BUS-142 naturally achieves HIGH RISK (~82/100)
    with full explainability breakdown emerging from the actual 5 events.
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    assert bus142 is not None

    assessment = risk_engine.evaluate_asset(bus142, bus142.events)

    # Assert risk score is in HIGH RISK band (70 - 84.9)
    assert 78.0 <= assessment.score <= 84.0, f"Expected BUS-142 score in 78-84 range, got {assessment.score}"
    assert assessment.risk_level == "HIGH"
    assert assessment.primary_subsystem == "braking"
    assert assessment.trend in ("RAPIDLY_ESCALATING", "ESCALATING")

    # Verify all factor breakdown components are present and non-zero
    fb = assessment.factor_breakdown
    assert fb["base_severity_points"] > 0.0
    assert fb["frequency_penalty_points"] > 0.0
    assert fb["cross_source_bonus_points"] >= 16.0  # 5 distinct roles >= 4 tier
    assert fb["temporal_acceleration_points"] > 0.0  # intervals contracting
    assert fb["near_miss_anchor_points"] == 10.0  # Near-miss event present

    # Verify confidence score
    assert 70.0 <= assessment.confidence <= 100.0
    assert assessment.confidence_breakdown["source_diversity_points"] > 0

    # Verify narrative explains the exact breakdown
    assert "Braking System" in assessment.explanation_narrative
    assert "Cross-Source Corroboration" in assessment.explanation_narrative


# ---------------------------------------------------------------------------
# 2. Low-Risk Comparison Assets
# ---------------------------------------------------------------------------

def test_low_risk_assets(db_session, risk_engine):
    """
    Verify that fleet baseline assets (BUS-105, BUS-402) with normal routine events
    evaluate strictly to LOW RISK (< 35).
    """
    for asset_id in ["BUS-105", "BUS-402", "BUS-112"]:
        asset = db_session.query(Asset).filter(Asset.asset_id == asset_id).first()
        assert asset is not None

        assessment = risk_engine.evaluate_asset(asset, asset.events)
        assert assessment.score <= 35.0, f"{asset_id} expected low risk <= 35, got {assessment.score}"
        assert assessment.risk_level == "LOW"
        assert assessment.trend == "STABLE"
        assert "ROUTINE" in assessment.recommended_action.upper()


# ---------------------------------------------------------------------------
# 3. Recency Decay
# ---------------------------------------------------------------------------

def test_recency_decay(risk_engine):
    """
    Verify that an identical event from 25 days ago produces significantly
    fewer points than an event from 1 day ago due to exponential decay.
    """
    anchor = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-RECENCY")

    # Recent event: 1 day old
    recent_event = Event(
        id="ev-rec",
        asset_id="BUS-TEST-RECENCY",
        timestamp=anchor - timedelta(days=1),
        event_type="maintenance",
        subsystem="braking",
        severity=4,
        description="Brake issue recent",
        source="Shop",
        reporter_role="technician"
    )

    # Old event: 25 days old
    old_event = Event(
        id="ev-old",
        asset_id="BUS-TEST-RECENCY",
        timestamp=anchor - timedelta(days=25),
        event_type="maintenance",
        subsystem="braking",
        severity=4,
        description="Brake issue old",
        source="Shop",
        reporter_role="technician"
    )

    recent_eval = risk_engine.evaluate_asset(asset, [recent_event], anchor_time=anchor)
    old_eval = risk_engine.evaluate_asset(asset, [old_event], anchor_time=anchor)

    recent_sev_pts = recent_eval.factor_breakdown["base_severity_points"]
    old_sev_pts = old_eval.factor_breakdown["base_severity_points"]

    assert recent_sev_pts > old_sev_pts * 2.5, (
        f"Recent points ({recent_sev_pts}) should be >2.5x old points ({old_sev_pts})"
    )


# ---------------------------------------------------------------------------
# 4. Repeated Events Frequency Penalty
# ---------------------------------------------------------------------------

def test_repeated_events_frequency_penalty(risk_engine):
    """
    Verify that repeated events on the same subsystem increase frequency points,
    capped at max_frequency_points.
    """
    anchor = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-FREQ")

    # 1 event -> 0 frequency penalty
    ev1 = Event(
        id="ev1",
        asset_id="BUS-TEST-FREQ",
        timestamp=anchor - timedelta(days=5),
        event_type="complaint",
        subsystem="braking",
        severity=2,
        description="Brake squeal",
        source="Passenger App",
        reporter_role="passenger"
    )
    eval1 = risk_engine.evaluate_asset(asset, [ev1], anchor_time=anchor)
    assert eval1.factor_breakdown["frequency_penalty_points"] == 0.0

    # 4 events -> frequency penalty = (4 - 1) * 3.5 = 10.5
    events_4 = [
        ev1,
        Event(id="ev2", asset_id="BUS-TEST-FREQ", timestamp=anchor - timedelta(days=4), event_type="complaint", subsystem="braking", severity=2, description="Brake squeal 2", source="Passenger App", reporter_role="passenger"),
        Event(id="ev3", asset_id="BUS-TEST-FREQ", timestamp=anchor - timedelta(days=3), event_type="complaint", subsystem="braking", severity=2, description="Brake squeal 3", source="Passenger App", reporter_role="passenger"),
        Event(id="ev4", asset_id="BUS-TEST-FREQ", timestamp=anchor - timedelta(days=2), event_type="complaint", subsystem="braking", severity=2, description="Brake squeal 4", source="Passenger App", reporter_role="passenger"),
    ]
    eval4 = risk_engine.evaluate_asset(asset, events_4, anchor_time=anchor)
    assert eval4.factor_breakdown["frequency_penalty_points"] == 10.5


# ---------------------------------------------------------------------------
# 5. Cross-Source Corroboration vs. Same-Source Repetition
# ---------------------------------------------------------------------------

def test_cross_source_corroboration_vs_same_source(risk_engine):
    """
    Crucial requirement: Distinct independent roles MUST provide stronger evidence
    than multiple reports from the same source.
    """
    anchor = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-SOURCE")

    # 4 events from the SAME role (passenger)
    same_source_events = [
        Event(id=f"ev-same-{i}", asset_id="BUS-TEST-SOURCE", timestamp=anchor - timedelta(days=10 - i*2), event_type="complaint", subsystem="braking", severity=3, description=f"Complaint {i}", source="Passenger App", reporter_role="passenger")
        for i in range(4)
    ]
    same_eval = risk_engine.evaluate_asset(asset, same_source_events, anchor_time=anchor)

    # 4 events from 4 DISTINCT roles
    distinct_source_events = [
        Event(id="ev-role-1", asset_id="BUS-TEST-SOURCE", timestamp=anchor - timedelta(days=10), event_type="maintenance", subsystem="braking", severity=3, description="Wear detected", source="Shop Log", reporter_role="technician"),
        Event(id="ev-role-2", asset_id="BUS-TEST-SOURCE", timestamp=anchor - timedelta(days=8), event_type="complaint", subsystem="braking", severity=3, description="Stopping issue", source="App", reporter_role="passenger"),
        Event(id="ev-role-3", asset_id="BUS-TEST-SOURCE", timestamp=anchor - timedelta(days=5), event_type="inspection", subsystem="braking", severity=3, description="Line balance flag", source="Inspector", reporter_role="inspector"),
        Event(id="ev-role-4", asset_id="BUS-TEST-SOURCE", timestamp=anchor - timedelta(days=2), event_type="operational_report", subsystem="braking", severity=3, description="Pedal travel abnormal", source="Driver Pad", reporter_role="driver"),
    ]
    distinct_eval = risk_engine.evaluate_asset(asset, distinct_source_events, anchor_time=anchor)

    # Same source gives 0.0 cross-source bonus; distinct sources give 20.0 bonus
    assert same_eval.factor_breakdown["cross_source_bonus_points"] == 0.0
    assert distinct_eval.factor_breakdown["cross_source_bonus_points"] == 20.0
    assert distinct_eval.score > same_eval.score + 15.0


# ---------------------------------------------------------------------------
# 6. Temporal Acceleration vs No Temporal Acceleration
# ---------------------------------------------------------------------------

def test_temporal_acceleration_detection(risk_engine):
    """
    Verify that contracting intervals + escalating severity trigger
    the temporal acceleration heuristic.
    """
    anchor = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-TEMP")

    # Contracting sequence: intervals 8d -> 4d -> 2d, severity 2 -> 3 -> 4 -> 5
    contracting_events = [
        Event(id="e1", asset_id="BUS-TEST-TEMP", timestamp=anchor - timedelta(days=14), event_type="maintenance", subsystem="braking", severity=2, description="T1", source="S1", reporter_role="technician"),
        Event(id="e2", asset_id="BUS-TEST-TEMP", timestamp=anchor - timedelta(days=6), event_type="complaint", subsystem="braking", severity=3, description="T2", source="S2", reporter_role="passenger"),
        Event(id="e3", asset_id="BUS-TEST-TEMP", timestamp=anchor - timedelta(days=2), event_type="operational_report", subsystem="braking", severity=4, description="T3", source="S3", reporter_role="driver"),
        Event(id="e4", asset_id="BUS-TEST-TEMP", timestamp=anchor - timedelta(hours=4), event_type="near_miss", subsystem="braking", severity=5, description="T4", source="S4", reporter_role="safety_officer"),
    ]
    eval_contracting = risk_engine.evaluate_asset(asset, contracting_events, anchor_time=anchor)
    assert eval_contracting.factor_breakdown["temporal_acceleration_points"] > 0.0
    assert eval_contracting.trend in ("RAPIDLY_ESCALATING", "ESCALATING")

    # Non-contracting sequence: expanding intervals 2d -> 5d -> 12d, low stable severity 1 -> 1 -> 1
    expanding_events = [
        Event(id="e1", asset_id="BUS-TEST-TEMP", timestamp=anchor - timedelta(days=19), event_type="maintenance", subsystem="braking", severity=1, description="T1", source="S1", reporter_role="technician"),
        Event(id="e2", asset_id="BUS-TEST-TEMP", timestamp=anchor - timedelta(days=17), event_type="maintenance", subsystem="braking", severity=1, description="T2", source="S1", reporter_role="technician"),
        Event(id="e3", asset_id="BUS-TEST-TEMP", timestamp=anchor - timedelta(days=12), event_type="maintenance", subsystem="braking", severity=1, description="T3", source="S1", reporter_role="technician"),
    ]
    eval_expanding = risk_engine.evaluate_asset(asset, expanding_events, anchor_time=anchor)
    assert eval_expanding.factor_breakdown["temporal_acceleration_points"] == 0.0


# ---------------------------------------------------------------------------
# 7. Near-Miss Anchor
# ---------------------------------------------------------------------------

def test_near_miss_anchor(risk_engine):
    """
    Verify that presence of a near_miss event activates the near_miss anchor points (+10).
    """
    anchor = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-ANCHOR")

    event_without = Event(
        id="e-reg",
        asset_id="BUS-TEST-ANCHOR",
        timestamp=anchor - timedelta(days=2),
        event_type="operational_report",
        subsystem="braking",
        severity=3,
        description="Minor brake noise",
        source="Driver Pad",
        reporter_role="driver"
    )

    event_with = Event(
        id="e-nm",
        asset_id="BUS-TEST-ANCHOR",
        timestamp=anchor - timedelta(days=2),
        event_type="near_miss",
        subsystem="braking",
        severity=5,
        description="Overshot pedestrian crosswalk",
        source="Safety Dispatch",
        reporter_role="safety_officer"
    )

    eval_without = risk_engine.evaluate_asset(asset, [event_without], anchor_time=anchor)
    eval_with = risk_engine.evaluate_asset(asset, [event_with], anchor_time=anchor)

    assert eval_without.factor_breakdown["near_miss_anchor_points"] == 0.0
    assert eval_with.factor_breakdown["near_miss_anchor_points"] == 10.0


# ---------------------------------------------------------------------------
# 8. Bounds & Extreme Cases
# ---------------------------------------------------------------------------

def test_scores_bounded_0_to_100(risk_engine):
    """
    Verify that risk and confidence scores remain strictly bounded within [0, 100].
    """
    anchor = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-EXTREME")

    # Empty events
    empty_eval = risk_engine.evaluate_asset(asset, [], anchor_time=anchor)
    assert empty_eval.score == 0.0
    assert empty_eval.confidence == 0.0

    # Overwhelming event flood (25 critical events)
    flood_events = [
        Event(
            id=f"flood-{i}",
            asset_id="BUS-TEST-EXTREME",
            timestamp=anchor - timedelta(hours=i * 2),
            event_type="incident",
            subsystem="braking",
            severity=5,
            description=f"Catastrophic failure {i}",
            source=f"Source-{i % 5}",
            reporter_role=f"role-{i % 5}"
        )
        for i in range(25)
    ]
    flood_eval = risk_engine.evaluate_asset(asset, flood_events, anchor_time=anchor)
    assert 0.0 <= flood_eval.score <= 100.0
    assert 0.0 <= flood_eval.confidence <= 100.0


# ---------------------------------------------------------------------------
# 9. Confidence vs Risk Independence
# ---------------------------------------------------------------------------

def test_confidence_differs_from_risk(risk_engine):
    """
    Verify that Confidence answers 'How strong is the evidence?',
    which is distinct from Risk 'How concerning is this pattern?'.
    """
    anchor = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)
    asset = Asset(asset_id="BUS-TEST-CONF")

    # Case A: Single near-miss report (elevated risk from critical event, but low confidence due to 1 report)
    single_nm = Event(
        id="snm",
        asset_id="BUS-TEST-CONF",
        timestamp=anchor - timedelta(days=1),
        event_type="near_miss",
        subsystem="braking",
        severity=5,
        description="Single uncorroborated report",
        source="Anonymous App",
        reporter_role="passenger"
    )
    eval_a = risk_engine.evaluate_asset(asset, [single_nm], anchor_time=anchor)
    # Risk is elevated due to severity 5 + near miss
    assert eval_a.score >= 25.0
    # But confidence is low due to 1 source and 1 event
    assert eval_a.confidence <= 40.0
    assert eval_a.confidence != eval_a.score

    # Case B: 6 routine check pass reports (low risk, high confidence)
    routine_events = [
        Event(
            id=f"r-{i}",
            asset_id="BUS-TEST-CONF",
            timestamp=anchor - timedelta(days=15 - i * 2),
            event_type="maintenance",
            subsystem="general",
            severity=1,
            description="Routine pass",
            source=f"Shop-{i % 3}",
            reporter_role=f"role-{i % 3}"
        )
        for i in range(6)
    ]
    eval_b = risk_engine.evaluate_asset(asset, routine_events, anchor_time=anchor)
    # Risk is low (< 25)
    assert eval_b.score < 25.0
    # Confidence is high (> 65) due to volume and multiple confirmations
    assert eval_b.confidence > 65.0


# ---------------------------------------------------------------------------
# 10. What-If Simulation Non-Mutation
# ---------------------------------------------------------------------------

def test_what_if_simulation_does_not_modify_database(db_session, risk_engine):
    """
    Verify that simulate_hypothetical_event calculates risk delta accurately
    WITHOUT adding records or mutating the database.
    """
    bus091 = db_session.query(Asset).filter(Asset.asset_id == "BUS-091").first()
    assert bus091 is not None

    initial_event_count = db_session.query(Event).filter(Event.asset_id == "BUS-091").count()
    initial_total_events = db_session.query(Event).count()

    # Create hypothetical event
    hypothetical = Event(
        id="hypo-1",
        asset_id="BUS-091",
        timestamp=datetime(2026, 9, 17, 14, 0, 0, tzinfo=timezone.utc),
        event_type="near_miss",
        subsystem="doors_body",
        severity=5,
        description="Hypothetical: Passenger caught in closing rear door",
        source="Safety Audit Pad",
        reporter_role="safety_officer"
    )

    simulation = risk_engine.simulate_hypothetical_event(
        asset=bus091,
        existing_events=bus091.events,
        hypothetical_event=hypothetical
    )

    # Verify simulation computed delta
    assert simulation.after_risk_score > simulation.before_risk_score
    assert simulation.risk_score_delta > 0
    assert "Risk increased" in simulation.explanation_of_change

    # Verify DB counts are completely unchanged
    post_event_count = db_session.query(Event).filter(Event.asset_id == "BUS-091").count()
    post_total_events = db_session.query(Event).count()

    assert post_event_count == initial_event_count
    assert post_total_events == initial_total_events


# ---------------------------------------------------------------------------
# 11. Evidence Graph Data Generation
# ---------------------------------------------------------------------------

def test_evidence_graph_generation(db_session, risk_engine):
    """
    Verify that Evidence Graph data connects:
    Asset -> Subsystem -> Events -> Temporal sequence -> Risk factors.
    """
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    assessment = risk_engine.evaluate_asset(bus142, bus142.events)

    graph = assessment.evidence_graph
    assert len(graph.nodes) > 0
    assert len(graph.edges) > 0

    node_types = {n.type for n in graph.nodes}
    assert "asset" in node_types
    assert "subsystem" in node_types
    assert "event" in node_types
    assert "risk_factor" in node_types

    edge_relations = {e.relation for e in graph.edges}
    assert "has_subsystem_focus" in edge_relations
    assert "correlates_signal" in edge_relations
    assert "temporal_sequence" in edge_relations
    assert "triggers_risk_factor" in edge_relations
