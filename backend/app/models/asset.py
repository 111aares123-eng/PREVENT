"""
SQLAlchemy model for monitored assets.
"""
from datetime import datetime, timezone
from typing import List, TYPE_CHECKING
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base

if TYPE_CHECKING:
    from backend.app.models.event import Event
    from backend.app.models.risk_assessment import RiskAssessment


class Asset(Base):
    __tablename__ = "assets"

    # Primary key identifier, e.g. "BUS-142"
    asset_id: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    asset_type: Mapped[str] = mapped_column(String(50), default="bus")
    make_model: Mapped[str] = mapped_column(String(100), default="Standard Transit Vehicle")
    depot_location: Mapped[str] = mapped_column(String(100), default="Main Depot")
    criticality: Mapped[str] = mapped_column(String(20), default="medium")  # low, medium, high, critical
    status: Mapped[str] = mapped_column(String(30), default="active")  # active, in_maintenance, grounded, under_investigation
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    events: Mapped[List["Event"]] = relationship(
        "Event",
        back_populates="asset",
        cascade="all, delete-orphan",
        order_by="Event.timestamp"
    )
    
    risk_assessments: Mapped[List["RiskAssessment"]] = relationship(
        "RiskAssessment",
        back_populates="asset",
        cascade="all, delete-orphan",
        order_by="desc(RiskAssessment.computed_at)"
    )

    def __repr__(self) -> str:
        return f"<Asset(asset_id='{self.asset_id}', type='{self.asset_type}', status='{self.status}')>"
