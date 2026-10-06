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
