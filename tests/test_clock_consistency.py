"""
Clock-consistency tests.

The risk engine evaluates on the live UTC clock with a rolling 30-day window, while the bundled
scenario files carry fixed September 2026 dates. These tests guard the pieces that keep the two
aligned, so the seeded story does not expire and new reports land on the same clock:
- seeding rebases scenario dates onto today (and --frozen / rebase_to_now=False keeps them)
- a report dated "now" raises, never lowers, the risk of an escalating asset
- a report sent without a timestamp is stamped with current UTC, same as the UI form
- What-If is evaluated on the same clock as the asset page
"""
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from backend.app.db.session import SessionLocal
from backend.app.main import app
from backend.app.models.event import Event
from data.scenarios.seed_data import seed_database

REPORT = {
    "event_type": "operational_report",
    "subsystem": "braking",
    "severity": 4,
    "description": "Driver reports long stopping distance in rain.",
    "source": "driver",
    "reporter_role": "driver",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _latest_bus142_event_time() -> datetime:
    db = SessionLocal()
    try:
        events = db.query(Event).filter(Event.asset_id == "BUS-142").all()
        return max(_as_utc(e.timestamp) for e in events)
    finally:
        db.close()


@pytest.fixture()
def client():
    seed_database(reset=True)
    with TestClient(app) as test_client:
        yield test_client
    seed_database(reset=True)


def test_seed_rebases_scenario_dates_onto_today():
    summary = seed_database(reset=True)
    assert summary["rebased_to_now"] is True
    age = datetime.now(timezone.utc) - _latest_bus142_event_time()
    assert timedelta(0) <= age < timedelta(days=1)


def test_seed_can_keep_original_scenario_dates():
    summary = seed_database(reset=True, rebase_to_now=False)
    assert summary["rebased_to_now"] is False
    assert _latest_bus142_event_time() == datetime(2026, 9, 17, 16, 20, tzinfo=timezone.utc)
    seed_database(reset=True)


def test_seeded_scenario_scores_on_live_clock(client):
    data = client.get("/api/v1/assets/BUS-142").json()
    assert data["risk_score"] == pytest.approx(82.0, abs=0.5)
    assert data["risk_level"] == "HIGH"


def test_report_dated_now_never_lowers_risk(client):
    """The UI sends timestamp = now. Adding a warning must not reduce the score."""
    resp = client.post("/api/v1/events", json={"asset_id": "BUS-142", **REPORT, "timestamp": _now_iso()})
    assert resp.status_code == 201
    data = resp.json()
    assert data["previous_risk_score"] == pytest.approx(82.0, abs=0.5)
    assert data["updated_risk_score"] > data["previous_risk_score"]
    assert data["updated_risk_level"] in ("HIGH", "CRITICAL")


def test_report_without_timestamp_is_stamped_with_current_utc(client):
    before = datetime.now(timezone.utc)
    data = client.post("/api/v1/events", json={"asset_id": "BUS-402", **REPORT}).json()
    stamped = _as_utc(datetime.fromisoformat(data["event"]["timestamp"].replace("Z", "+00:00")))
    assert abs((stamped - before).total_seconds()) < 60
    assert data["updated_risk_score"] > data["previous_risk_score"]


def test_form_path_and_api_default_path_agree(client):
    """The form (timestamp = now) and the bare API (no timestamp) must give the same result."""
    with_ts = client.post("/api/v1/events", json={"asset_id": "BUS-402", **REPORT, "timestamp": _now_iso()}).json()
    seed_database(reset=True)
    without_ts = client.post("/api/v1/events", json={"asset_id": "BUS-402", **REPORT}).json()
    assert with_ts["updated_risk_score"] == pytest.approx(without_ts["updated_risk_score"], abs=0.2)


def test_what_if_after_ingest_uses_one_clock(client):
    client.post("/api/v1/events", json={"asset_id": "BUS-402", **REPORT, "timestamp": _now_iso()})
    current = client.get("/api/v1/assets/BUS-402").json()["risk_score"]
    sim = client.post(
        "/api/v1/simulation/simulate-signal",
        json={"asset_id": "BUS-402", **REPORT, "event_type": "near_miss", "severity": 5},
    ).json()
    assert sim["before_risk_score"] == pytest.approx(current, abs=0.2)
    assert sim["after_risk_score"] > sim["before_risk_score"]
