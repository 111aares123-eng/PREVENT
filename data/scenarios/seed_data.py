"""
Database seeding script for PREVENT.
Populates the database with the canonical 8 assets and 32 events,
including the BUS-142 escalating brake failure scenario and baseline fleet noise.
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.db.base import Base
from backend.app.db.session import engine, SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.models.risk_assessment import RiskAssessment


def parse_datetime(dt_str: str) -> datetime:
    """Parse ISO formatted UTC string into timezone-aware datetime."""
    dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def seed_database(reset: bool = True) -> Dict[str, Any]:
    """
    Creates tables if they do not exist and populates initial seed data.
    If reset=True, purges existing assets, events, and assessments first.
    """
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()

    try:
        if reset:
            session.query(RiskAssessment).delete()
            session.query(Event).delete()
            session.query(Asset).delete()
            session.commit()

        scenarios_dir = Path(__file__).parent
        bus142_path = scenarios_dir / "bus_142_escalation.json"
        baseline_path = scenarios_dir / "fleet_baseline_noise.json"

        with open(bus142_path, "r", encoding="utf-8") as f:
            bus142_data = json.load(f)

        with open(baseline_path, "r", encoding="utf-8") as f:
            baseline_data = json.load(f)

        all_assets = [bus142_data["asset"]] + baseline_data["assets"]
        all_events = bus142_data["events"] + baseline_data["events"]

        # Insert Assets
        for a_data in all_assets:
            asset = Asset(
                asset_id=a_data["asset_id"],
                asset_type=a_data.get("asset_type", "bus"),
                make_model=a_data.get("make_model", "Standard Transit Vehicle"),
                depot_location=a_data.get("depot_location", "Main Depot"),
                criticality=a_data.get("criticality", "medium"),
                status=a_data.get("status", "active")
            )
            session.add(asset)

        session.flush()

        # Insert Events
        for e_data in all_events:
            event = Event(
                asset_id=e_data["asset_id"],
                timestamp=parse_datetime(e_data["timestamp"]),
                event_type=e_data["event_type"],
                subsystem=e_data["subsystem"],
                severity=e_data["severity"],
                description=e_data["description"],
                source=e_data["source"],
                reporter_role=e_data["reporter_role"],
                location=e_data.get("location"),
                is_simulated=e_data.get("is_simulated", False),
                raw_metadata=e_data.get("raw_metadata")
            )
            session.add(event)

        session.commit()

        # Gather summary
        total_assets = session.query(Asset).count()
        total_events = session.query(Event).count()
        bus142_events = session.query(Event).filter(Event.asset_id == "BUS-142").count()

        summary = {
            "status": "success",
            "total_assets": total_assets,
            "total_events": total_events,
            "bus142_events": bus142_events,
            "assets_seeded": [a["asset_id"] for a in all_assets]
        }
        return summary

    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


if __name__ == "__main__":
    result = seed_database(reset=True)
    print("=" * 60)
    print("PREVENT DATABASE SEEDING COMPLETED")
    print("=" * 60)
    print(f"Total Assets Created: {result['total_assets']}")
    print(f"Total Events Created: {result['total_events']}")
    print(f"BUS-142 Escalating Events: {result['bus142_events']}")
    print(f"Monitored Fleet Assets: {', '.join(result['assets_seeded'])}")
    print("=" * 60)
