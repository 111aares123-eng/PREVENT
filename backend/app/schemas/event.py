"""
Pydantic schemas for Event data transfer.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    timestamp: Optional[datetime] = Field(
        default=None,
        description="Occurrence timestamp in UTC. If omitted, defaults immediately after latest asset event."
    )
    event_type: EventType = Field(..., description="Classification of the event")
    subsystem: Subsystem = Field(..., description="Target vehicle subsystem")
    severity: int = Field(..., ge=1, le=5, description="1 (negligible) to 5 (critical)")
    description: str = Field(..., description="Factual narrative")
    source: str = Field(..., description="Originating system or department")
    reporter_role: str = Field(..., description="Role of the reporter (technician, passenger, inspector, driver, etc.)")
    location: Optional[str] = Field(default=None, description="Location description")
    is_simulated: bool = Field(default=False, description="Whether event is simulated in what-if mode")
    raw_metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional context metadata")

    @model_validator(mode="before")
    @classmethod
    def handle_metadata_alias(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "raw_metadata" not in data and "metadata" in data:
                data = dict(data)
                data["raw_metadata"] = data.pop("metadata")
        return data


class EventCreate(EventBase):
    pass


class EventResponse(EventBase):
    id: str
    timestamp: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventExtractRequest(BaseModel):
    report_text: str = Field(..., min_length=3, max_length=10000, description="Raw unstructured safety report")
    asset_id: Optional[str] = Field(default=None, description="Authoritative target asset ID if known/selected by operator")


class ExtractedEventData(BaseModel):
    asset_id: str = Field(..., description="Target asset ID, e.g. BUS-142")
    timestamp: Optional[datetime] = Field(default=None, description="Occurrence timestamp in UTC")
    event_type: EventType = Field(..., description="Classification of the event")
    subsystem: Subsystem = Field(..., description="Target vehicle subsystem")
    severity: int = Field(..., ge=1, le=5, description="1 (negligible) to 5 (critical)")
    description: str = Field(..., description="Factual narrative")
    source: str = Field(..., description="Originating system or department")
    reporter_role: str = Field(..., description="Role of the reporter (driver, technician, passenger, inspector, etc.)")
    location: Optional[str] = Field(default=None, description="Location description")
    raw_metadata: Optional[Dict[str, Any]] = Field(default=None, description="Operational metadata")

    @model_validator(mode="before")
    @classmethod
    def handle_metadata_alias(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "raw_metadata" not in data and "metadata" in data:
                data = dict(data)
                data["raw_metadata"] = data.pop("metadata")
        return data


class EventExtractResponse(BaseModel):
    extracted_event: Optional[ExtractedEventData] = Field(default=None, description="Validated extracted event preview")
    provider: str = Field(..., description="Provider used for extraction ('gemini' or 'mock')")
    validation_status: str = Field(..., description="'valid' or 'invalid'")
    validation_errors: Optional[List[str]] = Field(default=None, description="List of validation errors if invalid")
    raw_extraction: Optional[Dict[str, Any]] = Field(default=None, description="Raw extraction payload before validation")
    fallback_used: bool = Field(default=False, description="Whether fallback was activated due to temporary upstream availability error")
    fallback_message: Optional[str] = Field(default=None, description="Human-readable notice when fallback provider was used")


class EventIngestionResponse(BaseModel):
    event: EventResponse
    asset_id: str
    previous_risk_score: float
    updated_risk_score: float
    risk_score_delta: float
    previous_risk_level: str
    updated_risk_level: str
    previous_confidence: float
    updated_confidence: float
    confidence_delta: float
    factor_breakdown: Dict[str, float]
    factor_breakdown_delta: Dict[str, float]
    explanation_narrative: str
    why_risk_changed: List[str]

