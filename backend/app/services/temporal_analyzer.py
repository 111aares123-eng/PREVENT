"""
Temporal Analysis Service for PREVENT.
Analyzes chronological sequences of events to detect interval contraction,
rapid follow-up clusters, and escalating severity trends over time.

IMPORTANT:
Temporal acceleration is a configurable heuristic, NOT a universal assumption.
The analyzer returns interpretable metrics and structured evidence for human verification.
"""
from datetime import datetime, timezone
from typing import List, Optional, Sequence
from pydantic import BaseModel, Field
from backend.app.core.config import RiskScoringWeights, settings
from backend.app.models.event import Event


class TemporalAnalysisResult(BaseModel):
    """Interpretable results of temporal analysis over an event sequence."""
    event_count: int = Field(..., description="Number of events analyzed in sequence")
    intervals_days: List[float] = Field(default_factory=list, description="Elapsed days between consecutive events")
    average_interval_days: Optional[float] = Field(default=None, description="Mean interval in days")
    latest_interval_days: Optional[float] = Field(default=None, description="Interval in days between last two events")
    is_contracting: bool = Field(default=False, description="True if event intervals are tightening/shortening")
    is_severity_escalating: bool = Field(default=False, description="True if event severities show an upward trend")
    is_temporal_escalation_detected: bool = Field(default=False, description="Heuristic determination of temporal escalation")
    temporal_acceleration_points: float = Field(default=0.0, description="Points awarded for temporal risk escalation")
    rationale: str = Field(..., description="Human-readable explanation of temporal dynamics")


def _to_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware UTC for safe comparisons."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class TemporalAnalyzer:
    """Service to evaluate temporal spacing and trends across events."""

    def __init__(self, weights: Optional[RiskScoringWeights] = None):
        self.weights = weights or settings.risk_weights

    def analyze(self, events: Sequence[Event]) -> TemporalAnalysisResult:
        """
        Analyze a list of events belonging to the same asset / subsystem.
        Events are sorted chronologically by timestamp.
        """
        if not events:
            return TemporalAnalysisResult(
                event_count=0,
                intervals_days=[],
                average_interval_days=None,
                latest_interval_days=None,
                is_contracting=False,
                is_severity_escalating=False,
                is_temporal_escalation_detected=False,
                temporal_acceleration_points=0.0,
                rationale="No events available for temporal analysis."
            )

        # Ensure events are sorted ascending by timestamp (timezone-safe)
        sorted_events = sorted(events, key=lambda e: _to_utc(e.timestamp))
        k = len(sorted_events)

        if k == 1:
            return TemporalAnalysisResult(
                event_count=1,
                intervals_days=[],
                average_interval_days=None,
                latest_interval_days=None,
                is_contracting=False,
                is_severity_escalating=False,
                is_temporal_escalation_detected=False,
                temporal_acceleration_points=0.0,
                rationale="Single isolated event. No temporal escalation pattern established."
            )

        # Calculate intervals in days
        intervals_days: List[float] = []
        for i in range(1, k):
            t_curr = _to_utc(sorted_events[i].timestamp)
            t_prev = _to_utc(sorted_events[i - 1].timestamp)
            delta = t_curr - t_prev
            elapsed_days = max(0.0, delta.total_seconds() / 86400.0)
            intervals_days.append(round(elapsed_days, 2))

        avg_interval = round(sum(intervals_days) / len(intervals_days), 2)
        latest_interval = intervals_days[-1]
        tolerance = getattr(self.weights, "short_interval_tolerance_days", 1.0)
        threshold = self.weights.short_interval_threshold_days
        threshold_effective = threshold + tolerance

        # 1. Evaluate whether intervals are contracting
        is_contracting = False
        has_established_sub_acceleration = False
        if len(intervals_days) >= 2:
            first_half = intervals_days[:len(intervals_days) // 2]
            second_half = intervals_days[len(intervals_days) // 2:]
            mean_first = sum(first_half) / len(first_half) if first_half else avg_interval
            mean_second = sum(second_half) / len(second_half) if second_half else latest_interval

            if mean_second < mean_first * 0.92:
                is_contracting = True
            elif all(intervals_days[j] <= intervals_days[j - 1] for j in range(1, len(intervals_days))) and intervals_days[-1] < intervals_days[0]:
                is_contracting = True
            elif latest_interval <= threshold_effective and avg_interval >= latest_interval:
                is_contracting = True

            # If not contracting across the full sequence, check if preceding sub-sequence was contracting
            # and is followed by repeated high-severity events (severity >= 4 or near miss)
            if not is_contracting and len(intervals_days) >= 3:
                sub_intervals = intervals_days[:-1]
                sub_first = sub_intervals[:len(sub_intervals) // 2]
                sub_second = sub_intervals[len(sub_intervals) // 2:]
                sub_mean_first = sum(sub_first) / len(sub_first) if sub_first else avg_interval
                sub_mean_second = sum(sub_second) / len(sub_second) if sub_second else latest_interval
                sub_contracting = (
                    (sub_mean_second < sub_mean_first * 0.92)
                    or (sub_intervals[-1] <= threshold_effective)
                    or (all(sub_intervals[j] <= sub_intervals[j - 1] for j in range(1, len(sub_intervals))))
                )
                if sub_contracting and (sorted_events[-1].severity >= 4 or sorted_events[-1].event_type in ("near_miss", "incident")):
                    is_contracting = True
                    has_established_sub_acceleration = True

        # 2. Evaluate whether severity is escalating
        severities = [e.severity for e in sorted_events]
        max_severity = max(severities)
        is_severity_escalating = False
        if k >= 2:
            if severities[-1] > severities[0] and severities[-1] >= 4:
                is_severity_escalating = True
            elif severities[-1] > severities[-2] and severities[-1] >= 4:
                is_severity_escalating = True
            elif len(severities) >= 3 and severities[-1] >= 4 and sum(severities[-2:]) / 2 > sum(severities[:2]) / 2:
                is_severity_escalating = True
            elif max_severity >= 4 and severities[-1] >= 4 and any(s >= 4 for s in severities[:-1]):
                if max(severities[:len(severities)//2]) <= max(severities[len(severities)//2:]):
                    is_severity_escalating = True

        # 3. Determine acceleration points and overall escalation flag with smooth tolerance transitions
        # Continuous smoothing factor based on latest interval proximity to threshold
        if latest_interval <= threshold:
            smooth_ratio = 1.0
        elif latest_interval <= threshold_effective:
            smooth_ratio = max(0.5, (threshold_effective - latest_interval) / tolerance)
        else:
            smooth_ratio = 0.0

        temporal_points = 0.0
        escalation_detected = False
        rationale_parts = []

        if max_severity <= 1:
            # Routine non-hazardous events
            rationale_parts.append(
                f"Routine operational intervals: average spacing of {avg_interval:.1f} days with no elevated severity."
            )
        elif is_contracting and is_severity_escalating:
            escalation_detected = True
            base_pts = self.weights.temporal_acceleration_bonus
            # If established sub-sequence acceleration is corroborated by subsequent severe warning, retain full bonus
            if has_established_sub_acceleration:
                eff_pts = base_pts
            else:
                eff_pts = base_pts if latest_interval <= threshold else max(self.weights.short_interval_bonus, base_pts * smooth_ratio)
            temporal_points = min(self.weights.max_temporal_points, eff_pts)
            rationale_parts.append(
                f"Accelerating failure pattern: intervals contracted from initial {intervals_days[0]:.1f}d "
                f"down to {min(intervals_days):.1f}d while severity escalated to {max_severity}."
            )
        elif is_contracting and max_severity >= 3:
            escalation_detected = True
            eff_pts = self.weights.short_interval_bonus if latest_interval <= threshold else self.weights.short_interval_bonus * max(0.5, smooth_ratio)
            temporal_points = min(self.weights.max_temporal_points, eff_pts)
            rationale_parts.append(
                f"Event frequency tightening: average interval is {avg_interval:.1f}d with latest interval at {latest_interval:.1f}d on moderate severity issue."
            )
        elif latest_interval <= threshold_effective and max_severity >= 3:
            escalation_detected = True
            temporal_points = min(self.weights.max_temporal_points, self.weights.short_interval_bonus * smooth_ratio)
            rationale_parts.append(
                f"Rapid recurrence: latest event occurred within {latest_interval:.1f} days (within smoothed {threshold_effective:.1f}d threshold)."
            )
        else:
            temporal_points = 0.0
            rationale_parts.append(
                f"Stable event spacing: average interval of {avg_interval:.1f} days without contracting frequency."
            )

        return TemporalAnalysisResult(
            event_count=k,
            intervals_days=intervals_days,
            average_interval_days=avg_interval,
            latest_interval_days=latest_interval,
            is_contracting=is_contracting,
            is_severity_escalating=is_severity_escalating,
            is_temporal_escalation_detected=escalation_detected,
            temporal_acceleration_points=temporal_points,
            rationale=" ".join(rationale_parts)
        )
