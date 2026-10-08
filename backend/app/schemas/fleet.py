"""
Pydantic schemas for Fleet Overview and Asset Dossiers.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.schemas.asset import AssetResponse
from backend.app.services.correlation_engine import EvidenceGraphData


class FleetAssetSummary(BaseModel):
    """Compact summary of an asset and its current evaluated safety intelligence."""
    asset_id: str
    asset_type: str
    make_model: str
    depot_location: str
    criticality: str
    status: str
    risk_score: float = Field(..., ge=0.0, le=100.0)
    confidence: float = Field(..., ge=0.0, le=100.0)
    risk_level: str
    trend: str
    primary_subsystem: str
    recommended_action: str
    total_events_count: int
    latest_event_timestamp: Optional[datetime] = None


class RiskDistribution(BaseModel):
    """Count of assets across standard risk classifications."""
    critical: int = Field(default=0)
    high: int = Field(default=0)
    medium: int = Field(default=0)
    low: int = Field(default=0)


class FleetOverviewResponse(BaseModel):
    """Fleet-wide safety intelligence overview."""
    total_assets: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    critical_risk_count: int
    risk_distribution: RiskDistribution
    assets_requiring_attention: List[FleetAssetSummary]
    assets: List[FleetAssetSummary]
    evaluated_at: datetime


class AssetInfo(BaseModel):
    """Metadata for an asset."""
    asset_id: str
    asset_type: str
    make_model: str
    depot_location: str
    criticality: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WhyNowSignalItem(BaseModel):
    """Individual warning signal or pattern indicator in the Why-Now intelligence assessment."""
    label: str
    value: str
    severity: str = Field(default="info", description="info | warning | critical | positive")
    evidence_event_ids: List[str] = Field(default_factory=list)


class FactorContributionItem(BaseModel):
    """Explainable risk factor contribution point entry."""
    factor_key: Optional[str] = None
    label: str
    points: float


class WhyNowResponse(BaseModel):
    """Structured deterministic explanation of why an asset requires immediate attention."""
    asset_id: str
    headline: str
    summary: str
    signals: List[WhyNowSignalItem]
    factor_contributions: List[FactorContributionItem]
    current_risk_score: float
    risk_level: str
    primary_subsystem: str
    total_signals_count: int
    distinct_sources_count: int


class RiskHistoryPoint(BaseModel):
    """Point in time showing how an asset's risk evolved as warning signals accumulated."""
    timestamp: datetime
    event_id: str
    event_type: str
    subsystem: Optional[str] = None
    severity: int
    description: str
    risk_score: float
    risk_level: Optional[str] = None


class RiskHistoryResponse(BaseModel):
    """Chronological risk history trajectory for an asset."""
    asset_id: str
    total_points: int
    points: List[RiskHistoryPoint]
    trend: str
    current_risk_score: float
    current_risk_level: str


class AssetDetailResponse(BaseModel):
    """Complete safety intelligence dossier for a single asset."""
    asset: AssetInfo
    risk_score: float
    confidence: float
    risk_level: str
    trend: str
    primary_subsystem: str
    factor_breakdown: Dict[str, float]
    confidence_breakdown: Dict[str, float]
    subsystems_breakdown: Dict[str, Any]
    recommended_action: str
    explanation_narrative: str
    evidence_graph: EvidenceGraphData
    computed_at: datetime
    why_now: Optional[WhyNowResponse] = None
    risk_history: Optional[RiskHistoryResponse] = None


class TimelineEventItem(BaseModel):
    """Event representation for the chronological asset timeline."""
    id: str
    timestamp: datetime
    event_type: str
    subsystem: str
    severity: int
    description: str
    source: str
    reporter_role: str
    is_simulated: bool
    location: Optional[str] = None
    raw_metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class AssetTimelineResponse(BaseModel):
    """Chronological event history for an asset."""
    asset_id: str
    total_events: int
    events: List[TimelineEventItem]
