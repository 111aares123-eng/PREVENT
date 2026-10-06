"""
Automated tests for Phase 1A:
Validates Database schemas, SQLAlchemy models, relationships,
configurable weights, and seed scenario data integrity.
"""
import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.core.config import Settings, RiskScoringWeights, ConfidenceScoringWeights
from backend.app.db.base import Base
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.models.risk_assessment import RiskAssessment
from backend.app.schemas.asset import AssetCreate, AssetResponse
from backend.app.schemas.event import EventCreate, EventType, Subsystem
from data.scenarios.seed_data import seed_database


@pytest.fixture(scope="module")
def in_memory_db():
    """In-memory SQLite database fixture for isolated testing."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()


def test_configurable_weights_loading():
    """Verify that scoring weights are loaded from config and not hardcoded."""
    settings = Settings()
    assert isinstance(settings.risk_weights, RiskScoringWeights)
    assert isinstance(settings.confidence_weights, ConfidenceScoringWeights)
    
    # Check default sensible parameters
    assert settings.risk_weights.analysis_window_days == 30
    assert settings.risk_weights.recency_half_life_days == 10.0
    assert settings.risk_weights.severity_weight > 0
    assert settings.risk_weights.cross_source_tiers[2] == 8.0
    assert settings.risk_weights.cross_source_tiers[3] == 14.0
    assert settings.risk_weights.cross_source_tiers[4] == 20.0
    assert settings.risk_weights.temporal_acceleration_bonus == 13.0
    assert settings.risk_weights.near_miss_anchor_points == 10.0


def test_asset_crud_and_relationships(in_memory_db):
    """Verify Asset model persistence and relationships."""
    test_asset = Asset(
        asset_id="BUS-TEST-01",
        asset_type="bus",
        make_model="Test Flyer 40",
        depot_location="Test Depot",
        criticality="high",
        status="active"
    )
    in_memory_db.add(test_asset)
    in_memory_db.commit()

    retrieved = in_memory_db.query(Asset).filter(Asset.asset_id == "BUS-TEST-01").first()
    assert retrieved is not None
    assert retrieved.asset_id == "BUS-TEST-01"
    assert retrieved.criticality == "high"

    # Add associated event
    event = Event(
        asset_id="BUS-TEST-01",
        timestamp=datetime.now(timezone.utc),
        event_type="maintenance",
        subsystem="braking",
        severity=3,
        description="Brake pad replacement",
        source="Shop Log",
        reporter_role="technician"
    )
    in_memory_db.add(event)
    in_memory_db.commit()

    in_memory_db.refresh(retrieved)
    assert len(retrieved.events) == 1
    assert retrieved.events[0].subsystem == "braking"


def test_pydantic_schema_validation():
    """Verify Pydantic schemas enforce type safety and constraints."""
    event_data = {
        "asset_id": "BUS-142",
        "timestamp": datetime.now(timezone.utc),
        "event_type": EventType.COMPLAINT,
        "subsystem": Subsystem.BRAKING,
        "severity": 4,
        "description": "Brake pedal vibrating",
        "source": "Passenger Feedback App",
        "reporter_role": "passenger"
    }
    schema = EventCreate(**event_data)
    assert schema.severity == 4
    assert schema.subsystem == Subsystem.BRAKING

    # Check invalid severity validation
    with pytest.raises(Exception):
        EventCreate(
            asset_id="BUS-142",
            timestamp=datetime.now(timezone.utc),
            event_type=EventType.COMPLAINT,
            subsystem=Subsystem.BRAKING,
            severity=10,  # Invalid: max is 5
            description="Bad",
            source="Test",
            reporter_role="driver"
        )


def test_seed_database_execution():
    """Verify that seed_database populates 8 assets and 32 events accurately."""
    summary = seed_database(reset=True)
    assert summary["status"] == "success"
    assert summary["total_assets"] == 8
    assert summary["total_events"] == 32
    assert summary["bus142_events"] == 5
    assert "BUS-142" in summary["assets_seeded"]
    assert "BUS-091" in summary["assets_seeded"]


def test_bus142_escalation_data_structure():
    """Verify that BUS-142 events follow the exact timeline and multi-source properties."""
    from backend.app.db.session import SessionLocal
    db = SessionLocal()
    try:
        bus142 = db.query(Asset).filter(Asset.asset_id == "BUS-142").first()
        assert bus142 is not None
        assert len(bus142.events) == 5

        # Verify all events are on 'braking'
        subsystems = {e.subsystem for e in bus142.events}
        assert subsystems == {"braking"}

        # Verify multiple independent sources and roles
        roles = {e.reporter_role for e in bus142.events}
        assert len(roles) >= 4
        assert "technician" in roles
        assert "passenger" in roles
        assert "inspector" in roles
        assert "driver" in roles
        assert "safety_officer" in roles

        # Verify chronological order
        timestamps = [e.timestamp for e in bus142.events]
        assert timestamps == sorted(timestamps)

        # Verify severity progression includes near-miss at severity 5
        severities = [e.severity for e in bus142.events]
        assert severities == [2, 3, 3, 4, 5]
        assert any(e.event_type == "near_miss" for e in bus142.events)
    finally:
        db.close()
