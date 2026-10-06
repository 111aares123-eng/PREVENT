"""
SQLAlchemy model for Risk Assessment snapshots.
Stores historical and current computed risk scores, confidence, trends,
and exact factor waterfalls for complete explainability.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import String, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base

if TYPE_CHECKING:
    from backend.app.models.asset import Asset


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    asset_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("assets.asset_id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True
    )
    
    # Explainable Risk Score (0.0 to 100.0)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Confidence Score (0.0 to 100.0%) - captures data certainty, source diversity, consistency
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)
    
    # Risk Level: LOW | MEDIUM | HIGH | CRITICAL
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    
    # Trend: IMPROVING | STABLE | ESCALATING | RAPIDLY_ESCALATING
    trend: Mapped[str] = mapped_column(String(30), nullable=False)
    
    # The primary subsystem driving the risk (e.g. "braking", "electrical")
    primary_subsystem: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # JSON breakdown of mathematical points:
    # {
    #   "base_severity_points": 24.2,
    #   "frequency_penalty_points": 18.0,
    #   "cross_source_bonus_points": 22.0,
    #   "temporal_acceleration_points": 15.0,
    #   "near_miss_anchor_points": 10.0,
    #   "cross_subsystem_spillover": 0.0
    # }
    factor_breakdown: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    
    # JSON breakdown of confidence points:
    # {
    #   "source_diversity_points": 35.0,
    #   "evidence_volume_points": 25.0,
    #   "subsystem_focus_points": 18.0,
    #   "temporal_coherence_points": 18.0
    # }
    confidence_breakdown: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    
    # List of event UUIDs that contributed to this assessment
    contributing_event_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    
    # Clear, prescriptive action recommendation
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Transparent human-readable audit narrative
    explanation_narrative: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    asset: Mapped["Asset"] = relationship("Asset", back_populates="risk_assessments")

    def __repr__(self) -> str:
        return (
            f"<RiskAssessment(asset_id='{self.asset_id}', score={self.score:.1f}, "
            f"conf={self.confidence:.0f}%, level='{self.risk_level}')>"
        )
