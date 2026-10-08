"""
Asset dossier and event timeline endpoints.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session
from backend.app.api.deps import get_db, get_risk_engine
from backend.app.models.asset import Asset
from backend.app.schemas.fleet import (
    AssetDetailResponse,
    AssetInfo,
    AssetTimelineResponse,
    TimelineEventItem,
    RiskHistoryResponse,
    WhyNowResponse
)
from backend.app.services.risk_engine import RiskEngine
from backend.app.services.why_now_analyzer import WhyNowAnalyzer

router = APIRouter(prefix="/assets", tags=["Asset Dossiers"])


@router.get(
    "/{asset_id}",
    response_model=AssetDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Full Asset Dossier",
    description=(
        "Retrieves complete safety intelligence for a single asset, including explainable "
        "risk score, confidence score, trend vector, exact mathematical factor waterfall, "
        "confidence breakdown, subsystem risks, prescriptive recommendation, Why Now intelligence, "
        "chronological risk trajectory, and Evidence Graph data."
    ),
    responses={
        404: {"description": "Asset not found"}
    }
)
def get_asset_detail(
    asset_id: str = Path(..., description="Unique asset identifier, e.g. BUS-142"),
    db: Session = Depends(get_db),
    risk_engine: RiskEngine = Depends(get_risk_engine)
) -> AssetDetailResponse:
    """
    Evaluates and returns the complete safety intelligence dossier for an asset.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID '{asset_id}' was not found in the fleet database."
        )

    # Evaluate asset through existing RiskEngine
    assessment = risk_engine.evaluate_asset(asset, asset.events)

    # Serialize subsystem breakdowns into clean dictionary format
    subsystems_data = {}
    for sub_name, sub_bd in assessment.subsystems_breakdown.items():
        subsystems_data[sub_name] = {
            "subsystem": sub_bd.subsystem,
            "subsystem_total_score": sub_bd.subsystem_total_score,
            "base_severity_points": sub_bd.base_severity_points,
            "frequency_penalty_points": sub_bd.frequency_penalty_points,
            "cross_source_bonus_points": sub_bd.cross_source_bonus_points,
            "temporal_acceleration_points": sub_bd.temporal_acceleration_points,
            "near_miss_anchor_points": sub_bd.near_miss_anchor_points,
            "event_count": sub_bd.event_count,
            "distinct_sources_count": sub_bd.distinct_sources_count,
            "distinct_roles": sub_bd.distinct_roles,
            "temporal_rationale": sub_bd.temporal_analysis.rationale,
            "is_contracting": sub_bd.temporal_analysis.is_contracting,
            "is_severity_escalating": sub_bd.temporal_analysis.is_severity_escalating
        }

    # Generate Why-Now intelligence and Risk History
    why_now = WhyNowAnalyzer.generate_explanation(asset, asset.events, assessment)
    risk_history_dict = risk_engine.calculate_risk_history(asset, asset.events)
    risk_history = RiskHistoryResponse.model_validate(risk_history_dict)

    return AssetDetailResponse(
        asset=AssetInfo.model_validate(asset),
        risk_score=assessment.score,
        confidence=assessment.confidence,
        risk_level=assessment.risk_level,
        trend=assessment.trend,
        primary_subsystem=assessment.primary_subsystem,
        factor_breakdown=assessment.factor_breakdown,
        confidence_breakdown=assessment.confidence_breakdown,
        subsystems_breakdown=subsystems_data,
        recommended_action=assessment.recommended_action,
        explanation_narrative=assessment.explanation_narrative,
        evidence_graph=assessment.evidence_graph,
        computed_at=assessment.computed_at,
        why_now=why_now,
        risk_history=risk_history
    )


@router.get(
    "/{asset_id}/risk-history",
    response_model=RiskHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Chronological Risk Trajectory",
    description=(
        "Returns chronological risk-history trajectory points derived by replaying the asset's "
        "warning signals through the deterministic risk engine."
    ),
    responses={
        404: {"description": "Asset not found"}
    }
)
def get_asset_risk_history(
    asset_id: str = Path(..., description="Unique asset identifier, e.g. BUS-142"),
    db: Session = Depends(get_db),
    risk_engine: RiskEngine = Depends(get_risk_engine)
) -> RiskHistoryResponse:
    """
    Returns the chronological risk history points for an asset.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID '{asset_id}' was not found in the fleet database."
        )

    history_data = risk_engine.calculate_risk_history(asset, asset.events)
    return RiskHistoryResponse.model_validate(history_data)


@router.get(
    "/{asset_id}/why-now",
    response_model=WhyNowResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Why Now Intelligence",
    description=(
        "Returns structured deterministic intelligence explaining why this asset requires "
        "immediate human attention based on signals, multi-source convergence, and factor contributions."
    ),
    responses={
        404: {"description": "Asset not found"}
    }
)
def get_asset_why_now(
    asset_id: str = Path(..., description="Unique asset identifier, e.g. BUS-142"),
    db: Session = Depends(get_db),
    risk_engine: RiskEngine = Depends(get_risk_engine)
) -> WhyNowResponse:
    """
    Returns explainable Why-Now intelligence for the target asset.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID '{asset_id}' was not found in the fleet database."
        )

    assessment = risk_engine.evaluate_asset(asset, asset.events)
    return WhyNowAnalyzer.generate_explanation(asset, asset.events, assessment)


@router.get(
    "/{asset_id}/timeline",
    response_model=AssetTimelineResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Chronological Event Timeline",
    description=(
        "Returns all historical and current events associated with the asset, "
        "sorted chronologically by timestamp."
    ),
    responses={
        404: {"description": "Asset not found"}
    }
)
def get_asset_timeline(
    asset_id: str = Path(..., description="Unique asset identifier, e.g. BUS-142"),
    db: Session = Depends(get_db)
) -> AssetTimelineResponse:
    """
    Returns the chronological signal timeline for the target asset.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID '{asset_id}' was not found in the fleet database."
        )

    # Sort events chronologically ascending
    sorted_events = sorted(asset.events, key=lambda e: e.timestamp)

    timeline_items = [
        TimelineEventItem(
            id=str(ev.id),
            timestamp=ev.timestamp,
            event_type=ev.event_type,
            subsystem=ev.subsystem,
            severity=ev.severity,
            description=ev.description,
            source=ev.source,
            reporter_role=ev.reporter_role,
            is_simulated=ev.is_simulated,
            location=ev.location,
            raw_metadata=ev.raw_metadata
        )
        for ev in sorted_events
    ]

    return AssetTimelineResponse(
        asset_id=asset.asset_id,
        total_events=len(timeline_items),
        events=timeline_items
    )
