"""
SQLAlchemy model for safety and operational events.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base

if TYPE_CHECKING:
    from backend.app.models.asset import Asset


class Event(Base):
    __tablename__ = "events"

    # Unique event identifier (UUID string)
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
    
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
    
    # Event classification
    # maintenance | inspection | complaint | violation | near_miss | incident | operational_report
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # Subsystem category
    # braking | steering | electrical | powertrain | suspension | doors_body | hvac | general
    subsystem: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # Severity rating from 1 (negligible) to 5 (critical)
    severity: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Descriptive narrative
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Reporting channel / system (e.g. "Depot Workshop Log", "Passenger Feedback App")
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Reporting role (e.g. "technician", "passenger", "inspector", "driver", "safety_officer", "telematics")
    reporter_role: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # Physical or operational location (e.g. "Route 4 - 5th Ave Crossing", "North Bay 2")
    location: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    
    # Flag to differentiate committed baseline events from interactive "What-If" simulations
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Arbitrary operational metadata (e.g. weather conditions, passenger load, speed)
    raw_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    asset: Mapped["Asset"] = relationship("Asset", back_populates="events")

    def __repr__(self) -> str:
        return (
            f"<Event(id='{self.id[:8]}', asset_id='{self.asset_id}', "
            f"type='{self.event_type}', sub='{self.subsystem}', sev={self.severity})>"
        )
