"""
Pydantic schemas for intelligence, risk scoring, confidence, and explainability.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from backend.app.schemas.event import EventResponse


class RiskFactorWaterfall(BaseModel):
    """Line-by-line point contribution to the total risk score."""
    base_severity_points: float = Field(..., description="Points derived from severity and recency decay")
    frequency_penalty_points: float = Field(..., description="Points derived from repeated events on same subsystem")
    cross_source_bonus_points: float = Field(..., description="Points derived from multiple independent reporting roles")
    temporal_acceleration_points: float = Field(..., description="Points derived from contracting event intervals")
    near_miss_anchor_points: float = Field(..., description="Points derived from near-miss or critical safety flags")
    cross_subsystem_spillover: float = Field(default=0.0, description="Minor compounding from secondary subsystem risks")
    total_score: float = Field(..., description="Calculated score clamped between 0 and 100")


class ConfidenceFactorBreakdown(BaseModel):
    """Breakdown of confidence assessment factors."""
    source_diversity_points: float = Field(..., description="Certainty gained from multiple reporting perspectives")
    evidence_volume_points: float = Field(..., description="Certainty gained from quantity of corroborating events")
    subsystem_focus_points: float = Field(..., description="Certainty gained from convergence on a specific subsystem")
    temporal_coherence_points: float = Field(..., description="Certainty gained from consistent timeline progression")
    total_confidence: float = Field(..., description="Confidence percentage (0 to 100%)")


class SubsystemRiskSummary(BaseModel):
    subsystem: str
    subsystem_score: float
    events_count: int
    distinct_sources_count: int
    latest_event_timestamp: Optional[datetime]


class RiskAssessmentDetail(BaseModel):
    asset_id: str
    computed_at: datetime
    score: float = Field(..., ge=0.0, le=100.0, description="Risk Score (0-100)")
    confidence: float = Field(..., ge=0.0, le=100.0, description="Confidence Percentage (0-100%)")
    risk_level: str = Field(..., description="LOW | MEDIUM | HIGH | CRITICAL")
    trend: str = Field(..., description="IMPROVING | STABLE | ESCALATING | RAPIDLY_ESCALATING")
    primary_subsystem: str
    waterfall: RiskFactorWaterfall
    confidence_breakdown: ConfidenceFactorBreakdown
    subsystems_breakdown: List[SubsystemRiskSummary]
    contributing_events: List[EventResponse]
    recommended_action: str
    explanation_narrative: str


class FleetOverviewKPIs(BaseModel):
    total_assets: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    critical_risk_count: int
    multi_source_clusters_count: int
    latest_evaluation_time: datetime
