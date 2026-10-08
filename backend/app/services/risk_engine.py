"""
Explainable Deterministic Risk Engine for PREVENT.
Implements the transparent 0-100 risk scoring algorithm, confidence assessment (0-100%),
What-If simulation engine, and prescriptive recommendation generator.
"""
from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Sequence, Tuple
from pydantic import BaseModel, Field
from backend.app.core.config import (
    RiskScoringWeights,
    ConfidenceScoringWeights,
    settings
)
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.services.temporal_analyzer import TemporalAnalyzer, TemporalAnalysisResult
from backend.app.services.correlation_engine import (
    CorrelationEngine,
    SubsystemCorrelationCluster,
    EvidenceGraphData
)


class SubsystemScoreBreakdown(BaseModel):
    """Detailed mathematical point breakdown for a single subsystem."""
    subsystem: str
    base_severity_points: float
    frequency_penalty_points: float
    cross_source_bonus_points: float
    temporal_acceleration_points: float
    near_miss_anchor_points: float
    subsystem_total_score: float
    event_count: int
    distinct_sources_count: int
    distinct_roles: List[str]
    temporal_analysis: TemporalAnalysisResult


class RiskAssessmentOutput(BaseModel):
    """Complete output of a deterministic risk assessment."""
    asset_id: str
    computed_at: datetime
    anchor_time: datetime
    score: float = Field(..., ge=0.0, le=100.0, description="Explainable Risk Score (0-100)")
    confidence: float = Field(..., ge=0.0, le=100.0, description="Evidence Confidence (0-100%)")
    risk_level: str = Field(..., description="LOW | MEDIUM | HIGH | CRITICAL")
    trend: str = Field(..., description="IMPROVING | STABLE | ESCALATING | RAPIDLY_ESCALATING")
    primary_subsystem: str
    factor_breakdown: Dict[str, float]
    confidence_breakdown: Dict[str, float]
    subsystems_breakdown: Dict[str, SubsystemScoreBreakdown]
    contributing_event_ids: List[str]
    recommended_action: str
    explanation_narrative: str
    evidence_graph: EvidenceGraphData


class WhatIfSimulationOutput(BaseModel):
    """Results of a hypothetical What-If signal injection."""
    asset_id: str
    before_risk_score: float
    after_risk_score: float
    risk_score_delta: float
    before_confidence: float
    after_confidence: float
    confidence_delta: float
    before_risk_level: str
    after_risk_level: str
    before_trend: str
    after_trend: str
    factor_breakdown_delta: Dict[str, float]
    explanation_of_change: str
    simulated_assessment: RiskAssessmentOutput


class RiskEngine:
    """Core deterministic risk and confidence evaluation engine."""

    def __init__(
        self,
        risk_weights: Optional[RiskScoringWeights] = None,
        confidence_weights: Optional[ConfidenceScoringWeights] = None
    ):
        self.risk_weights = risk_weights or settings.risk_weights
        self.confidence_weights = confidence_weights or settings.confidence_weights
        self.temporal_analyzer = TemporalAnalyzer(self.risk_weights)
        self.correlation_engine = CorrelationEngine()

    def _normalize_dt(self, dt: datetime) -> datetime:
        """Ensure datetime is timezone-aware UTC."""
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def _determine_anchor_time(
        self,
        events: Sequence[Event],
        explicit_anchor: Optional[datetime] = None
    ) -> datetime:
        """
        Determines the reference time T_eval for recency decay.
        1. Uses explicit_anchor if provided by caller (e.g. tests, replay, or seeded demo calls).
        2. In production / live evaluation, uses current UTC time (never silently pinning to historical anchor).
        """
        if explicit_anchor is not None:
            return self._normalize_dt(explicit_anchor)
        return datetime.now(timezone.utc)

    def _calculate_subsystem_risk(
        self,
        subsystem: str,
        events: Sequence[Event],
        anchor_time: datetime
    ) -> SubsystemScoreBreakdown:
        """
        Computes the explainable risk points for a single vehicle subsystem.
        """
        if not events:
            empty_temporal = self.temporal_analyzer.analyze([])
            return SubsystemScoreBreakdown(
                subsystem=subsystem,
                base_severity_points=0.0,
                frequency_penalty_points=0.0,
                cross_source_bonus_points=0.0,
                temporal_acceleration_points=0.0,
                near_miss_anchor_points=0.0,
                subsystem_total_score=0.0,
                event_count=0,
                distinct_sources_count=0,
                distinct_roles=[],
                temporal_analysis=empty_temporal
            )

        k = len(events)
        distinct_roles = sorted(list({e.reporter_role for e in events if e.reporter_role}))
        num_distinct_roles = len(distinct_roles)
        max_sev = max(e.severity for e in events)

        # Scaling factor: Prevents repeated negligible (severity 1) routine maintenance tasks from overwhelming risk score
        sev_scale = 0.35 if max_sev <= 1 else 1.0

        # 1. Base Severity with Exponential Recency Decay & Evidence Retention
        half_life = max(1.0, self.risk_weights.recency_half_life_days)
        decay_constant = math.log(2) / half_life
        retention_floor = getattr(self.risk_weights, "unmitigated_retention_floor", 0.65) if (k >= 2 and max_sev >= 3) else 0.0

        # Acute scale for isolated severe events (k == 1 and severity >= 5)
        # Guarantees an isolated severity-5 near-miss or crash produces at least 45.0 (entering MEDIUM, NOT LOW)
        acute_scale = 2.05 if (k == 1 and max_sev >= 5) else 1.0
        max_cap = getattr(self.risk_weights, "acute_max_severity_points", 35.0) if (k == 1 and max_sev >= 5) else self.risk_weights.max_severity_points

        raw_severity_sum = 0.0
        for ev in events:
            ev_time = self._normalize_dt(ev.timestamp)
            delta_seconds = max(0.0, (anchor_time - ev_time).total_seconds())
            delta_days = delta_seconds / 86400.0
            recency_weight = math.exp(-decay_constant * delta_days)
            if retention_floor > 0.0:
                recency_weight = max(retention_floor, recency_weight)
            raw_contrib = ev.severity * self.risk_weights.severity_weight * recency_weight * sev_scale * acute_scale
            raw_severity_sum += raw_contrib

        base_severity_points = round(min(max_cap, raw_severity_sum), 2)

        # 2. Event Repetition / Frequency Penalty
        if k >= 2:
            raw_freq = (k - 1) * self.risk_weights.frequency_penalty_per_event * sev_scale
            frequency_penalty_points = round(min(self.risk_weights.max_frequency_points, raw_freq), 2)
        else:
            frequency_penalty_points = 0.0

        # 3. Cross-Source Corroboration Multiplier
        cross_source_bonus_points = 0.0
        for tier_count in sorted(self.risk_weights.cross_source_tiers.keys()):
            if num_distinct_roles >= tier_count:
                cross_source_bonus_points = self.risk_weights.cross_source_tiers[tier_count] * sev_scale
        cross_source_bonus_points = round(min(self.risk_weights.max_cross_source_points, cross_source_bonus_points), 2)

        # 4. Temporal Acceleration Heuristic
        temporal_result = self.temporal_analyzer.analyze(events)
        temporal_acceleration_points = round(temporal_result.temporal_acceleration_points, 2)

        # 5. Near-Miss / Critical Severity Anchor (Acute vs Pattern-Based)
        has_near_miss = any(
            ev.event_type in ("near_miss", "incident") or ev.severity >= 5
            for ev in events
        )
        has_actual_incident = any(
            ev.event_type == "incident" and ev.severity >= 5
            for ev in events
        )

        near_miss_anchor_points = 0.0
        if has_near_miss:
            base_nm = self.risk_weights.near_miss_anchor_points
            if has_actual_incident:
                base_nm += getattr(self.risk_weights, "compound_incident_bonus", 10.0)
            max_nm = getattr(self.risk_weights, "max_near_miss_points", 25.0)
            near_miss_anchor_points = min(max_nm, base_nm)

        # Total Subsystem Score (clamped to 100.0)
        subsystem_total = min(
            100.0,
            base_severity_points
            + frequency_penalty_points
            + cross_source_bonus_points
            + temporal_acceleration_points
            + near_miss_anchor_points
        )

        return SubsystemScoreBreakdown(
            subsystem=subsystem,
            base_severity_points=base_severity_points,
            frequency_penalty_points=frequency_penalty_points,
            cross_source_bonus_points=cross_source_bonus_points,
            temporal_acceleration_points=temporal_acceleration_points,
            near_miss_anchor_points=near_miss_anchor_points,
            subsystem_total_score=round(subsystem_total, 2),
            event_count=k,
            distinct_sources_count=num_distinct_roles,
            distinct_roles=distinct_roles,
            temporal_analysis=temporal_result
        )

    def _calculate_confidence(
        self,
        events: Sequence[Event],
        primary_breakdown: Optional[SubsystemScoreBreakdown]
    ) -> Tuple[float, Dict[str, float]]:
        """
        Computes the Evidence Confidence Score (0-100%).
        Answers: "How strong is the evidence supporting this assessment?"
        Factors:
        - Source diversity
        - Evidence volume
        - Subsystem focus / concentration
        - Temporal coherence
        Avoids casually returning 100%.
        """
        if not events:
            return 0.0, {
                "source_diversity_points": 0.0,
                "evidence_volume_points": 0.0,
                "subsystem_focus_points": 0.0,
                "temporal_coherence_points": 0.0,
                "total_confidence": 0.0
            }

        k = len(events)
        all_roles = {e.reporter_role for e in events if e.reporter_role}
        num_roles = len(all_roles)

        # 1. Source Diversity Points
        source_div_pts = min(
            self.confidence_weights.max_source_diversity_points,
            num_roles * self.confidence_weights.points_per_distinct_source
        )

        # 2. Evidence Volume Points
        volume_pts = min(
            self.confidence_weights.max_evidence_volume_points,
            k * self.confidence_weights.points_per_event
        )

        # 3. Subsystem Focus Points
        if primary_breakdown and k > 0:
            primary_ratio = primary_breakdown.event_count / k
            subsystem_focus_pts = round(primary_ratio * self.confidence_weights.max_subsystem_focus_points, 2)
        else:
            subsystem_focus_pts = 9.0

        # 4. Temporal Coherence Points
        if k >= 3 and primary_breakdown and primary_breakdown.temporal_analysis.intervals_days:
            temporal_coherence_pts = self.confidence_weights.max_temporal_coherence_points
        elif k >= 2:
            temporal_coherence_pts = 10.0
        else:
            temporal_coherence_pts = 4.0

        raw_conf = source_div_pts + volume_pts + subsystem_focus_pts + temporal_coherence_pts
        max_ceiling = getattr(self.confidence_weights, "max_calibrated_confidence", 96.0)
        total_conf = min(max_ceiling, raw_conf)

        breakdown = {
            "source_diversity_points": round(source_div_pts, 2),
            "evidence_volume_points": round(volume_pts, 2),
            "subsystem_focus_points": round(subsystem_focus_pts, 2),
            "temporal_coherence_points": round(temporal_coherence_pts, 2),
            "total_confidence": round(total_conf, 1)
        }

        return round(total_conf, 1), breakdown

    def _determine_risk_level(self, score: float) -> str:
        """Maps numeric risk score to categorical level."""
        if score <= self.risk_weights.threshold_low_max:
            return "LOW"
        elif score <= self.risk_weights.threshold_medium_max:
            return "MEDIUM"
        elif score <= self.risk_weights.threshold_high_max:
            return "HIGH"
        else:
            return "CRITICAL"

    def _determine_trend(
        self,
        score: float,
        primary_breakdown: Optional[SubsystemScoreBreakdown]
    ) -> str:
        """Determines directional trend vector."""
        if not primary_breakdown or primary_breakdown.event_count == 0:
            return "STABLE"

        if score <= self.risk_weights.threshold_low_max:
            return "STABLE"

        temp = primary_breakdown.temporal_analysis
        if temp.is_contracting and temp.is_severity_escalating:
            return "RAPIDLY_ESCALATING"
        elif temp.is_temporal_escalation_detected or score >= 70:
            return "ESCALATING"
        elif primary_breakdown.event_count >= 2:
            return "STABLE"
        else:
            return "STABLE"

    def _generate_recommendation(
        self,
        asset_id: str,
        risk_level: str,
        primary_subsystem: str,
        breakdown: SubsystemScoreBreakdown
    ) -> str:
        """Generates prescriptive preventive action recommendations."""
        sub_title = primary_subsystem.replace("_", " ").title()

        if risk_level == "CRITICAL":
            return (
                f"CRITICAL FLEET GROUNDING: Immediately withdraw {asset_id} from revenue service. "
                f"Dispatch safety quarantine notice to depot dispatch. Perform comprehensive {sub_title} teardown "
                f"and certification before dispatch."
            )
        elif risk_level == "HIGH":
            return (
                f"PRIORITY SAFETY ACTION: Schedule immediate mechanical safety inspection for {asset_id} "
                f"targeting {sub_title} System before next operating shift. Verify brake friction, hydraulic lines, "
                f"and sensor logs with workshop lead."
            )
        elif risk_level == "MEDIUM":
            return (
                f"PROACTIVE MONITORING: Place {asset_id} on heightened surveillance for {sub_title} System. "
                f"Cross-reference driver pre-trip logs and schedule depot inspection within 72 hours."
            )
        else:
            return (
                f"ROUTINE SURVEILLANCE: Normal operational baseline for {asset_id}. "
                f"Continue standard scheduled preventative maintenance intervals."
            )

    def _generate_narrative(
        self,
        asset_id: str,
        score: float,
        risk_level: str,
        primary_subsystem: str,
        primary_breakdown: SubsystemScoreBreakdown
    ) -> str:
        """Synthesizes human-readable audit narrative explaining the score."""
        b = primary_breakdown
        sub_title = primary_subsystem.replace("_", " ").title()

        points_narrative = (
            f"Risk Score {score:.1f}/100 ({risk_level}) for {asset_id} is driven by the {sub_title} System. "
            f"Key contributing factors: "
            f"1) Base Severity & Recency: +{b.base_severity_points:.1f} pts across {b.event_count} events; "
            f"2) Cross-Source Corroboration: +{b.cross_source_bonus_points:.1f} pts from {b.distinct_sources_count} distinct roles "
            f"({', '.join(b.distinct_roles)}); "
            f"3) Frequency Penalty: +{b.frequency_penalty_points:.1f} pts for repeated subsystem faults; "
            f"4) Temporal Acceleration: +{b.temporal_acceleration_points:.1f} pts ({b.temporal_analysis.rationale}); "
            f"5) Near-Miss Flag: +{b.near_miss_anchor_points:.1f} pts."
        )
        return points_narrative

    def evaluate_asset(
        self,
        asset: Asset,
        events: Sequence[Event],
        anchor_time: Optional[datetime] = None
    ) -> RiskAssessmentOutput:
        """
        Performs full deterministic risk assessment for an asset across all its events.
        """
        t_eval = self._determine_anchor_time(events, anchor_time)

        # Filter events within analysis window and connected hazard chains
        window_days = self.risk_weights.analysis_window_days
        all_by_sub: Dict[str, List[Event]] = {}
        for e in events:
            sub = e.subsystem or "general"
            all_by_sub.setdefault(sub, []).append(e)

        window_events = []
        for sub_name, sub_evs in all_by_sub.items():
            sorted_sub_evs = sorted(sub_evs, key=lambda e: self._normalize_dt(e.timestamp), reverse=True)
            active_chain: List[Event] = []
            prev_dt: Optional[datetime] = None

            for e in sorted_sub_evs:
                ev_dt = self._normalize_dt(e.timestamp)
                delta_days = (t_eval - ev_dt).total_seconds() / 86400.0

                # Direct inclusion within rolling window (with 1 day grace)
                if -1.0 <= delta_days <= window_days:
                    active_chain.append(e)
                    prev_dt = ev_dt
                elif prev_dt is not None:
                    # Chained inclusion: preceding warning in active unmitigated sequence occurred within window_days of next event
                    chain_gap_days = (prev_dt - ev_dt).total_seconds() / 86400.0
                    if 0.0 <= chain_gap_days <= window_days:
                        active_chain.append(e)
                        prev_dt = ev_dt
                    else:
                        break
                else:
                    break

            window_events.extend(active_chain)

        # Group by subsystem
        events_by_sub: Dict[str, List[Event]] = {}
        for ev in window_events:
            sub = ev.subsystem or "general"
            events_by_sub.setdefault(sub, []).append(ev)

        # If no events at all, return baseline 0 assessment
        if not events_by_sub:
            empty_temporal = self.temporal_analyzer.analyze([])
            empty_breakdown = SubsystemScoreBreakdown(
                subsystem="general",
                base_severity_points=0.0,
                frequency_penalty_points=0.0,
                cross_source_bonus_points=0.0,
                temporal_acceleration_points=0.0,
                near_miss_anchor_points=0.0,
                subsystem_total_score=0.0,
                event_count=0,
                distinct_sources_count=0,
                distinct_roles=[],
                temporal_analysis=empty_temporal
            )
            empty_graph = self.correlation_engine.build_evidence_graph(asset, [])
            return RiskAssessmentOutput(
                asset_id=asset.asset_id,
                computed_at=datetime.now(timezone.utc),
                anchor_time=t_eval,
                score=0.0,
                confidence=0.0,
                risk_level="LOW",
                trend="STABLE",
                primary_subsystem="general",
                factor_breakdown={
                    "base_severity_points": 0.0,
                    "frequency_penalty_points": 0.0,
                    "cross_source_bonus_points": 0.0,
                    "temporal_acceleration_points": 0.0,
                    "near_miss_anchor_points": 0.0,
                    "cross_subsystem_spillover": 0.0,
                    "total_score": 0.0
                },
                confidence_breakdown={
                    "source_diversity_points": 0.0,
                    "evidence_volume_points": 0.0,
                    "subsystem_focus_points": 0.0,
                    "temporal_coherence_points": 0.0,
                    "total_confidence": 0.0
                },
                subsystems_breakdown={},
                contributing_event_ids=[],
                recommended_action=self._generate_recommendation(asset.asset_id, "LOW", "general", empty_breakdown),
                explanation_narrative=f"No warning signals recorded for {asset.asset_id} in the last {window_days} days.",
                evidence_graph=empty_graph
            )

        # Compute subsystem breakdowns
        sub_breakdowns: Dict[str, SubsystemScoreBreakdown] = {}
        for sub_name, sub_events in events_by_sub.items():
            sub_breakdowns[sub_name] = self._calculate_subsystem_risk(sub_name, sub_events, t_eval)

        # Find primary (worst) subsystem
        primary_sub = max(sub_breakdowns.keys(), key=lambda s: sub_breakdowns[s].subsystem_total_score)
        primary_breakdown = sub_breakdowns[primary_sub]

        # Calculate cross-subsystem spillover
        secondary_spillover = 0.0
        for sub_name, b_down in sub_breakdowns.items():
            if sub_name != primary_sub:
                secondary_spillover += b_down.subsystem_total_score * self.risk_weights.cross_subsystem_spillover

        # Composite asset score (bounded 0 to 100)
        composite_score = min(100.0, primary_breakdown.subsystem_total_score + secondary_spillover)
        composite_score = round(composite_score, 1)

        # Risk level and trend
        risk_level = self._determine_risk_level(composite_score)
        trend = self._determine_trend(composite_score, primary_breakdown)

        # Confidence calculation
        confidence_score, confidence_breakdown = self._calculate_confidence(window_events, primary_breakdown)

        # Action & narrative
        action = self._generate_recommendation(asset.asset_id, risk_level, primary_sub, primary_breakdown)
        narrative = self._generate_narrative(asset.asset_id, composite_score, risk_level, primary_sub, primary_breakdown)

        factor_breakdown = {
            "base_severity_points": primary_breakdown.base_severity_points,
            "frequency_penalty_points": primary_breakdown.frequency_penalty_points,
            "cross_source_bonus_points": primary_breakdown.cross_source_bonus_points,
            "temporal_acceleration_points": primary_breakdown.temporal_acceleration_points,
            "near_miss_anchor_points": primary_breakdown.near_miss_anchor_points,
            "cross_subsystem_spillover": round(secondary_spillover, 2),
            "total_score": composite_score
        }

        # Build evidence graph
        active_factors = {
            "severity_recency": primary_breakdown.base_severity_points,
            "repeated_frequency": primary_breakdown.frequency_penalty_points,
            "cross_source_corroboration": primary_breakdown.cross_source_bonus_points,
            "temporal_acceleration": primary_breakdown.temporal_acceleration_points,
            "near_miss_anchor": primary_breakdown.near_miss_anchor_points
        }
        evidence_graph = self.correlation_engine.build_evidence_graph(
            asset,
            window_events,
            active_factors=active_factors
        )

        contributing_ids = [str(e.id) for e in window_events]

        return RiskAssessmentOutput(
            asset_id=asset.asset_id,
            computed_at=datetime.now(timezone.utc),
            anchor_time=t_eval,
            score=composite_score,
            confidence=confidence_score,
            risk_level=risk_level,
            trend=trend,
            primary_subsystem=primary_sub,
            factor_breakdown=factor_breakdown,
            confidence_breakdown=confidence_breakdown,
            subsystems_breakdown=sub_breakdowns,
            contributing_event_ids=contributing_ids,
            recommended_action=action,
            explanation_narrative=narrative,
            evidence_graph=evidence_graph
        )

    def simulate_hypothetical_event(
        self,
        asset: Asset,
        existing_events: Sequence[Event],
        hypothetical_event: Event,
        anchor_time: Optional[datetime] = None
    ) -> WhatIfSimulationOutput:
        """
        Runs a What-If simulation by evaluating the impact of a hypothetical event.
        CRITICAL: Does NOT mutate the database.
        """
        # Baseline assessment
        baseline_assessment = self.evaluate_asset(asset, existing_events, anchor_time)

        # Clone and append hypothetical event
        simulated_event_list = list(existing_events) + [hypothetical_event]

        # Use the hypothetical event timestamp as new anchor if it is later than existing anchor
        sim_anchor = anchor_time
        if sim_anchor is None:
            sim_anchor = max(
                self._normalize_dt(baseline_assessment.anchor_time),
                self._normalize_dt(hypothetical_event.timestamp)
            )

        # Evaluated simulated assessment
        simulated_assessment = self.evaluate_asset(asset, simulated_event_list, sim_anchor)

        risk_delta = round(simulated_assessment.score - baseline_assessment.score, 1)
        conf_delta = round(simulated_assessment.confidence - baseline_assessment.confidence, 1)

        # Compute factor breakdown delta
        factor_delta = {}
        for key in simulated_assessment.factor_breakdown:
            before_val = baseline_assessment.factor_breakdown.get(key, 0.0)
            after_val = simulated_assessment.factor_breakdown.get(key, 0.0)
            factor_delta[key] = round(after_val - before_val, 2)

        # Explanation of change
        change_reasons = []
        if risk_delta > 0:
            change_reasons.append(f"Risk increased by +{risk_delta:.1f} pts (from {baseline_assessment.score:.1f} to {simulated_assessment.score:.1f}).")
            if factor_delta.get("cross_source_bonus_points", 0) > 0:
                change_reasons.append(f"Cross-source corroboration escalated (+{factor_delta['cross_source_bonus_points']:.1f} pts) via independent {hypothetical_event.reporter_role} report.")
            if factor_delta.get("temporal_acceleration_points", 0) > 0:
                change_reasons.append(f"Temporal acceleration triggered (+{factor_delta['temporal_acceleration_points']:.1f} pts) due to contracting intervals.")
            if factor_delta.get("frequency_penalty_points", 0) > 0:
                change_reasons.append(f"Frequency penalty compounded (+{factor_delta['frequency_penalty_points']:.1f} pts).")
            if factor_delta.get("near_miss_anchor_points", 0) > 0:
                change_reasons.append(f"Near-miss anchor activated (+{factor_delta['near_miss_anchor_points']:.1f} pts).")
        elif risk_delta < 0:
            change_reasons.append(f"Risk decreased by {risk_delta:.1f} pts.")
        else:
            change_reasons.append("Risk score remained unchanged.")

        explanation = " ".join(change_reasons)

        return WhatIfSimulationOutput(
            asset_id=asset.asset_id,
            before_risk_score=baseline_assessment.score,
            after_risk_score=simulated_assessment.score,
            risk_score_delta=risk_delta,
            before_confidence=baseline_assessment.confidence,
            after_confidence=simulated_assessment.confidence,
            confidence_delta=conf_delta,
            before_risk_level=baseline_assessment.risk_level,
            after_risk_level=simulated_assessment.risk_level,
            before_trend=baseline_assessment.trend,
            after_trend=simulated_assessment.trend,
            factor_breakdown_delta=factor_delta,
            explanation_of_change=explanation,
            simulated_assessment=simulated_assessment
        )

    def calculate_risk_history(
        self,
        asset: Asset,
        events: Sequence[Event]
    ) -> Dict[str, Any]:
        """
        Derives chronological risk-history points by replaying the asset's
        event timeline through the deterministic risk engine.
        Each point represents the evaluated risk state immediately following that event.
        """
        if not events:
            return {
                "asset_id": asset.asset_id,
                "total_points": 0,
                "points": [],
                "trend": "STABLE",
                "current_risk_score": 0.0,
                "current_risk_level": "LOW"
            }

        # Sort events chronologically ascending
        sorted_events = sorted(events, key=lambda e: self._normalize_dt(e.timestamp))

        points = []
        for i, ev in enumerate(sorted_events, start=1):
            sub_events = sorted_events[:i]
            # Evaluate using the event's timestamp as the anchor time
            step_eval = self.evaluate_asset(asset, sub_events, anchor_time=ev.timestamp)
            points.append({
                "timestamp": self._normalize_dt(ev.timestamp),
                "event_id": str(ev.id),
                "event_type": ev.event_type,
                "subsystem": ev.subsystem,
                "severity": ev.severity,
                "description": ev.description,
                "risk_score": step_eval.score,
                "risk_level": step_eval.risk_level
            })

        latest_eval = self.evaluate_asset(asset, sorted_events, anchor_time=sorted_events[-1].timestamp)

        return {
            "asset_id": asset.asset_id,
            "total_points": len(points),
            "points": points,
            "trend": latest_eval.trend,
            "current_risk_score": latest_eval.score,
            "current_risk_level": latest_eval.risk_level
        }

