"""
Pydantic schemas for Event data transfer.
"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class EventType(str, Enum):
    MAINTENANCE = "maintenance"
    INSPECTION = "inspection"
    COMPLAINT = "complaint"
    VIOLATION = "violation"
    NEAR_MISS = "near_miss"
    INCIDENT = "incident"
    OPERATIONAL_REPORT = "operational_report"


class Subsystem(str, Enum):
    BRAKING = "braking"
    STEERING = "steering"
    ELECTRICAL = "electrical"
    POWERTRAIN = "powertrain"
    SUSPENSION = "suspension"
    DOORS_BODY = "doors_body"
    HVAC = "hvac"
    GENERAL = "general"


class EventBase(BaseModel):
    asset_id: str = Field(..., description="Target asset ID, e.g. BUS-142")
    timestamp: datetime = Field(..., description="Occurrence timestamp in UTC")
    event_type: EventType = Field(..., description="Classification of the event")
    subsystem: Subsystem = Field(..., description="Target vehicle subsystem")
    severity: int = Field(..., ge=1, le=5, description="1 (negligible) to 5 (critical)")
    description: str = Field(..., description="Factual narrative")
    source: str = Field(..., description="Originating system or department")
    reporter_role: str = Field(..., description="Role of the reporter (technician, passenger, inspector, driver, etc.)")
    location: Optional[str] = Field(default=None, description="Location description")
    is_simulated: bool = Field(default=False, description="Whether event is simulated in what-if mode")
    raw_metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional context metadata")


class EventCreate(EventBase):
    pass


class EventResponse(EventBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
