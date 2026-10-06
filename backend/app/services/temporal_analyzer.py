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

        # 1. Evaluate whether intervals are contracting
        is_contracting = False
        if len(intervals_days) >= 2:
            first_half = intervals_days[:len(intervals_days) // 2]
            second_half = intervals_days[len(intervals_days) // 2:]
            mean_first = sum(first_half) / len(first_half) if first_half else avg_interval
            mean_second = sum(second_half) / len(second_half) if second_half else latest_interval

            if mean_second < mean_first * 0.85:
                is_contracting = True
            elif all(intervals_days[j] <= intervals_days[j - 1] for j in range(1, len(intervals_days))) and intervals_days[-1] < intervals_days[0]:
                is_contracting = True
            elif latest_interval <= self.weights.short_interval_threshold_days and avg_interval > latest_interval:
                is_contracting = True

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

        # 3. Determine acceleration points and overall escalation flag
        # Routine events (severity <= 1, e.g. scheduled inspections, clean passes) should not trigger safety hazard escalation
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
            temporal_points = min(self.weights.max_temporal_points, self.weights.temporal_acceleration_bonus)
            rationale_parts.append(
                f"Accelerating failure pattern: intervals contracted from initial {intervals_days[0]:.1f}d "
                f"down to {latest_interval:.1f}d while severity escalated from {severities[0]} to {severities[-1]}."
            )
        elif is_contracting and max_severity >= 3:
            escalation_detected = True
            temporal_points = min(self.weights.max_temporal_points, self.weights.short_interval_bonus)
            rationale_parts.append(
                f"Event frequency tightening: average interval is {avg_interval:.1f}d with latest interval at {latest_interval:.1f}d on moderate severity issue."
            )
        elif latest_interval <= self.weights.short_interval_threshold_days and max_severity >= 3:
            escalation_detected = True
            temporal_points = min(self.weights.max_temporal_points, self.weights.short_interval_bonus)
            rationale_parts.append(
                f"Rapid recurrence: latest event occurred within {latest_interval:.1f} days (under {self.weights.short_interval_threshold_days}d threshold)."
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
