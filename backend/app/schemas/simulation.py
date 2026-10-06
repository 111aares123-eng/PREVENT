"""
Pydantic schemas for What-If signal simulation.
"""
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from backend.app.schemas.event import EventType, Subsystem
from backend.app.services.risk_engine import RiskAssessmentOutput


class SimulateSignalRequest(BaseModel):
    """Input payload to simulate a hypothetical event on an asset."""
    asset_id: str = Field(..., description="Target asset ID to simulate against, e.g. BUS-142")
    timestamp: Optional[datetime] = Field(default=None, description="Hypothetical occurrence timestamp (UTC). Defaults to current time if omitted.")
    event_type: EventType = Field(..., description="Type of signal (e.g. complaint, maintenance, near_miss)")
    subsystem: Subsystem = Field(..., description="Vehicle subsystem (e.g. braking, doors_body, electrical)")
    severity: int = Field(..., ge=1, le=5, description="Severity rating 1 (negligible) to 5 (critical)")
    description: str = Field(..., min_length=3, description="Descriptive narrative of the hypothetical event")
    source: str = Field(..., min_length=2, description="Originating source (e.g. Passenger Feedback App)")
    reporter_role: str = Field(..., min_length=2, description="Reporter role (e.g. passenger, driver, technician, inspector)")
    location: Optional[str] = Field(default=None, description="Optional physical location")
    raw_metadata: Optional[Dict[str, Any]] = Field(default=None, description="Optional operational metadata")


class SimulateSignalResponse(BaseModel):
    """Response detailing the exact before/after risk shift and factor deltas."""
    asset_id: str
    before_risk_score: float
    after_risk_score: float
    risk_score_delta: float
    before_risk_level: str
    after_risk_level: str
    before_confidence: float
    after_confidence: float
    confidence_delta: float
    before_trend: str
    after_trend: str
    factor_breakdown_delta: Dict[str, float]
    explanation_of_change: str
    simulated_assessment: RiskAssessmentOutput
