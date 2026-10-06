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
    TimelineEventItem
)
from backend.app.services.risk_engine import RiskEngine

router = APIRouter(prefix="/assets", tags=["Asset Dossiers"])


@router.get(
    "/{asset_id}",
    response_model=AssetDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Full Asset Dossier",
    description=(
        "Retrieves complete safety intelligence for a single asset, including explainable "
        "risk score, confidence score, trend vector, exact mathematical factor waterfall, "
        "confidence breakdown, subsystem risks, prescriptive recommendation, and Evidence Graph data."
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
        computed_at=assessment.computed_at
    )


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
