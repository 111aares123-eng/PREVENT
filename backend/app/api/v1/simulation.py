"""
What-If signal simulation endpoints.
Allows operators to evaluate the safety impact of hypothetical events in real-time
without altering persistent database state.
"""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.api.deps import get_db, get_risk_engine
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.schemas.simulation import (
    SimulateSignalRequest,
    SimulateSignalResponse
)
from backend.app.services.risk_engine import RiskEngine

router = APIRouter(prefix="/simulation", tags=["What-If Simulation"])


@router.post(
    "/simulate-signal",
    response_model=SimulateSignalResponse,
    status_code=status.HTTP_200_OK,
    summary="Simulate Hypothetical Warning Signal",
    description=(
        "Simulates the impact of adding a hypothetical event to an asset's timeline. "
        "Calculates before/after risk scores, confidence shifts, and detailed factor deltas. "
        "CRITICAL: Does NOT persist the event or modify the database."
    ),
    responses={
        404: {"description": "Target asset not found"},
        422: {"description": "Invalid event parameters"}
    }
)
def simulate_signal(
    payload: SimulateSignalRequest,
    db: Session = Depends(get_db),
    risk_engine: RiskEngine = Depends(get_risk_engine)
) -> SimulateSignalResponse:
    """
    Evaluates a What-If scenario in-memory using the existing RiskEngine.
    """
    asset = db.query(Asset).filter(Asset.asset_id == payload.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target asset '{payload.asset_id}' was not found in the fleet database."
        )

    # Determine hypothetical timestamp (defaults to current UTC evaluation time or immediately after latest event)
    hypo_time = payload.timestamp
    if hypo_time is None:
        now_utc = datetime.now(timezone.utc)
        if asset.events:
            latest_time = max(e.timestamp for e in asset.events)
            if latest_time.tzinfo is None:
                latest_time = latest_time.replace(tzinfo=timezone.utc)
            hypo_time = max(now_utc, latest_time + timedelta(hours=1))
        else:
            hypo_time = now_utc
    elif hypo_time.tzinfo is None:
        hypo_time = hypo_time.replace(tzinfo=timezone.utc)

    # Construct unpersisted transient Event model instance
    hypothetical_event = Event(
        id=f"sim-{uuid.uuid4().hex[:8]}",
        asset_id=asset.asset_id,
        timestamp=hypo_time,
        event_type=payload.event_type.value if hasattr(payload.event_type, "value") else str(payload.event_type),
        subsystem=payload.subsystem.value if hasattr(payload.subsystem, "value") else str(payload.subsystem),
        severity=payload.severity,
        description=payload.description,
        source=payload.source,
        reporter_role=payload.reporter_role,
        location=payload.location,
        is_simulated=True,
        raw_metadata=payload.raw_metadata
    )

    # Run simulation using existing RiskEngine (pure in-memory evaluation)
    simulation_output = risk_engine.simulate_hypothetical_event(
        asset=asset,
        existing_events=asset.events,
        hypothetical_event=hypothetical_event
    )

    return SimulateSignalResponse(
        asset_id=asset.asset_id,
        before_risk_score=simulation_output.before_risk_score,
        after_risk_score=simulation_output.after_risk_score,
        risk_score_delta=simulation_output.risk_score_delta,
        before_risk_level=simulation_output.before_risk_level,
        after_risk_level=simulation_output.after_risk_level,
        before_confidence=simulation_output.before_confidence,
        after_confidence=simulation_output.after_confidence,
        confidence_delta=simulation_output.confidence_delta,
        before_trend=simulation_output.before_trend,
        after_trend=simulation_output.after_trend,
        factor_breakdown_delta=simulation_output.factor_breakdown_delta,
        explanation_of_change=simulation_output.explanation_of_change,
        simulated_assessment=simulation_output.simulated_assessment
    )
