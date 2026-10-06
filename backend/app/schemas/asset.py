"""
Pydantic schemas for Asset data transfer.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AssetBase(BaseModel):
    asset_id: str = Field(..., description="Unique asset identifier, e.g. BUS-142")
    asset_type: str = Field(default="bus", description="Asset type (bus, tram, train, van)")
    make_model: str = Field(default="Standard Transit Vehicle", description="Make and model")
    depot_location: str = Field(default="Main Depot", description="Assigned depot location")
    criticality: str = Field(default="medium", description="Operational criticality (low, medium, high, critical)")
    status: str = Field(default="active", description="Operational status (active, in_maintenance, grounded, under_investigation)")


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    asset_type: Optional[str] = None
    make_model: Optional[str] = None
    depot_location: Optional[str] = None
    criticality: Optional[str] = None
    status: Optional[str] = None


class AssetResponse(AssetBase):
    created_at: datetime
    updated_at: datetime
    
    # Optional latest risk snapshot fields for table display
    current_risk_score: Optional[float] = None
    current_confidence: Optional[float] = None
    current_risk_level: Optional[str] = None
    current_trend: Optional[str] = None
    primary_subsystem: Optional[str] = None
    total_events_count: int = 0
    last_event_timestamp: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
