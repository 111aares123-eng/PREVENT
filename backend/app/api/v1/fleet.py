"""
Fleet-level intelligence endpoints.
"""
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from backend.app.api.deps import get_db, get_risk_engine
from backend.app.models.asset import Asset
from backend.app.schemas.fleet import (
    FleetOverviewResponse,
    FleetAssetSummary,
    RiskDistribution
)
from backend.app.services.risk_engine import RiskEngine

router = APIRouter(prefix="/fleet", tags=["Fleet Intelligence"])


@router.get(
    "/overview",
    response_model=FleetOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Fleet Risk Overview",
    description=(
        "Returns aggregated fleet-level safety intelligence. Evaluates all monitored assets "
        "dynamically through the deterministic RiskEngine, categorizing risk distribution "
        "and identifying priority assets requiring attention."
    )
)
def get_fleet_overview(
    db: Session = Depends(get_db),
    risk_engine: RiskEngine = Depends(get_risk_engine)
) -> FleetOverviewResponse:
    """
    Evaluates all assets currently in the database to build fleet safety KPIs.
    """
    assets: List[Asset] = db.query(Asset).all()

    asset_summaries: List[FleetAssetSummary] = []
    dist = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    requiring_attention: List[FleetAssetSummary] = []

    for asset in assets:
        # Evaluate current asset dynamically using existing RiskEngine
        assessment = risk_engine.evaluate_asset(asset, asset.events)

        latest_timestamp = None
        if asset.events:
            latest_ev = max(asset.events, key=lambda e: e.timestamp)
            latest_timestamp = latest_ev.timestamp

        summary = FleetAssetSummary(
            asset_id=asset.asset_id,
            asset_type=asset.asset_type,
            make_model=asset.make_model,
            depot_location=asset.depot_location,
            criticality=asset.criticality,
            status=asset.status,
            risk_score=assessment.score,
            confidence=assessment.confidence,
            risk_level=assessment.risk_level,
            trend=assessment.trend,
            primary_subsystem=assessment.primary_subsystem,
            recommended_action=assessment.recommended_action,
            total_events_count=len(asset.events),
            latest_event_timestamp=latest_timestamp
        )
        asset_summaries.append(summary)

        # Track distribution
        level_lower = assessment.risk_level.lower()
        if level_lower in dist:
            dist[level_lower] += 1

        # Assets requiring attention: HIGH and CRITICAL risk
        if assessment.risk_level in ("HIGH", "CRITICAL"):
            requiring_attention.append(summary)

    # Sort assets by risk score descending (highest risk first)
    asset_summaries.sort(key=lambda a: a.risk_score, reverse=True)
    requiring_attention.sort(key=lambda a: a.risk_score, reverse=True)

    return FleetOverviewResponse(
        total_assets=len(assets),
        high_risk_count=dist["high"],
        medium_risk_count=dist["medium"],
        low_risk_count=dist["low"],
        critical_risk_count=dist["critical"],
        risk_distribution=RiskDistribution(
            critical=dist["critical"],
            high=dist["high"],
            medium=dist["medium"],
            low=dist["low"]
        ),
        assets_requiring_attention=requiring_attention,
        assets=asset_summaries,
        evaluated_at=datetime.now(timezone.utc)
    )
