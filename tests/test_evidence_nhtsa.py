"""
Unit and Integration Tests for the NHTSA Real-World Evidence Track.

Verifies:
1. Normalization and date parsing across formats and malformed strings.
2. Precursor vs Critical outcome deterministic classification.
3. Component/subsystem concentration and distribution.
4. Temporal aggregation, yearly timeline, and recall action markers.
5. Lead-time calculation from first signal to official safety action.
6. Signal diversity and symptom extraction.
7. Graceful handling of empty datasets and missing/malformed records.
8. API endpoint GET /api/v1/evidence/nhtsa.
9. Invariance: Zero coupling with operational database or RiskEngine.
"""
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.evidence.nhtsa_analyzer import (
    NHTSAEvidenceAnalyzer,
    parse_iso_date,
    calculate_lead_time_days,
    extract_signal_symptoms,
)
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def analyzer():
    """NHTSAEvidenceAnalyzer instance."""
    return NHTSAEvidenceAnalyzer()


# 1. Date Parsing
def test_parse_iso_date_valid():
    dt = parse_iso_date("2015-06-02")
    assert dt == datetime(2015, 6, 2)


def test_parse_iso_date_malformed_and_none():
    assert parse_iso_date(None) is None
    assert parse_iso_date("") is None
    assert parse_iso_date("invalid-date-format") is None
    assert parse_iso_date("2015/06/02") is None


# 2. Lead Time Calculation
def test_calculate_lead_time_days():
    days = calculate_lead_time_days("2011-04-14", "2015-06-02")
    assert days is not None
    assert days > 1400  # ~4.1 years

    # Missing or reversed dates
    assert calculate_lead_time_days(None, "2015-06-02") is None
    assert calculate_lead_time_days("2015-06-02", None) is None
    assert calculate_lead_time_days("2016-01-01", "2015-01-01") is None


# 3. Symptom Extraction
def test_extract_signal_symptoms():
    narrative_1 = "While driving, the power steering assist warning light illuminated on the dash."
    sym_1 = extract_signal_symptoms(narrative_1)
    assert "Warning Indicator / Message" in sym_1

    narrative_2 = "Steering wheel became stiff and hard to turn, lost all power steering."
    sym_2 = extract_signal_symptoms(narrative_2)
    assert "Excessive Steering Effort / Stiffness" in sym_2
    assert "Sudden Loss of Power Assist" in sym_2

    narrative_3 = "Experienced severe vibration and grinding noise from the front steering."
    sym_3 = extract_signal_symptoms(narrative_3)
    assert "Shudder / Vibration" in sym_3
    assert "Mechanical Noise / Grinding" in sym_3

    narrative_empty = ""
    sym_empty = extract_signal_symptoms(narrative_empty)
    assert sym_empty == ["General Anomaly Report"]


# 4. Deterministic Precursor vs Critical Classification
def test_precursor_vs_critical_classification(analyzer):
    mock_data = {
        "metadata": {
            "cohort": {"make": "TEST", "model": "CAR", "model_year": 2020},
            "case_study": {"target_subsystem": "STEERING", "recall_effective_date": "2020-05-01"}
        },
        "recalls": [],
        "complaints": [
            {
                "odi_number": 1,
                "primary_subsystem": "STEERING",
                "severity_tier": "PRECURSOR",
                "crash": False,
                "fire": False,
                "injuries": 0,
                "deaths": 0,
                "filed_date": "2020-01-10",
                "summary_excerpt": "Warning light came on"
            },
            {
                "odi_number": 2,
                "primary_subsystem": "STEERING",
                "severity_tier": "CRITICAL",
                "crash": True,
                "fire": False,
                "injuries": 0,
                "deaths": 0,
                "filed_date": "2020-02-15",
                "summary_excerpt": "Lost steering and crashed into barrier"
            },
            {
                "odi_number": 3,
                "primary_subsystem": "STEERING",
                "severity_tier": "CRITICAL",
                "crash": False,
                "fire": False,
                "injuries": 2,
                "deaths": 0,
                "filed_date": "2020-03-20",
                "summary_excerpt": "Steering locked, passenger injured"
            }
        ]
    }
    result = analyzer.analyze(mock_data)
    summary = result["summary"]
    assert summary["total_cohort_records"] == 3
    assert summary["target_subsystem_records"] == 3
    assert summary["precursor_signals"] == 1
    assert summary["critical_outcomes"] == 2
    assert summary["precursor_pct"] == 33.3
    assert summary["critical_pct"] == 66.7


# 5. Component Concentration & Aggregation
def test_component_breakdown_calculation(analyzer):
    mock_data = {
        "metadata": {"case_study": {"target_subsystem": "BRAKES"}},
        "recalls": [],
        "complaints": [
            {"primary_subsystem": "BRAKES", "severity_tier": "PRECURSOR"},
            {"primary_subsystem": "BRAKES", "severity_tier": "PRECURSOR"},
            {"primary_subsystem": "BRAKES", "severity_tier": "PRECURSOR"},
            {"primary_subsystem": "ENGINE", "severity_tier": "PRECURSOR"},
        ]
    }
    result = analyzer.analyze(mock_data)
    breakdown = result["subsystem_breakdown"]
    assert len(breakdown) == 2
    assert breakdown[0]["subsystem"] == "BRAKES"
    assert breakdown[0]["count"] == 3
    assert breakdown[0]["percentage"] == 75.0
    assert breakdown[0]["is_target"] is True
    assert breakdown[1]["subsystem"] == "ENGINE"
    assert breakdown[1]["count"] == 1
    assert breakdown[1]["percentage"] == 25.0


# 6. Temporal Timeline & Action Marker
def test_temporal_timeline_action_marker(analyzer):
    mock_data = {
        "metadata": {
            "case_study": {
                "target_subsystem": "STEERING",
                "recall_effective_date": "2015-06-02",
                "official_recall_campaign": "15V340000"
            }
        },
        "recalls": [],
        "complaints": [
            {"primary_subsystem": "STEERING", "severity_tier": "PRECURSOR", "filed_date": "2014-05-01"},
            {"primary_subsystem": "STEERING", "severity_tier": "PRECURSOR", "filed_date": "2015-01-15"},
            {"primary_subsystem": "STEERING", "severity_tier": "CRITICAL", "filed_date": "2015-04-10"},
            {"primary_subsystem": "STEERING", "severity_tier": "PRECURSOR", "filed_date": "2016-02-01"},
        ]
    }
    result = analyzer.analyze(mock_data)
    timeline = result["temporal_timeline"]
    assert len(timeline) == 3  # 2014, 2015, 2016
    y2015 = next(item for item in timeline if item["period"] == "2015")
    assert y2015["action_marker"] is True
    assert y2015["total_count"] == 2
    assert y2015["precursor_count"] == 1
    assert y2015["critical_count"] == 1


# 7. Empty Dataset Handling
def test_empty_dataset(analyzer):
    empty_data = {"metadata": {}, "recalls": [], "complaints": []}
    result = analyzer.analyze(empty_data)
    assert result["summary"]["total_cohort_records"] == 0
    assert result["summary"]["target_subsystem_records"] == 0
    assert result["subsystem_breakdown"] == []
    assert result["temporal_timeline"] == []
    assert result["traceable_signals"] == []


# 8. Malformed Complaints Handling
def test_malformed_complaints_resilience(analyzer):
    malformed_data = {
        "metadata": {"case_study": {"target_subsystem": "STEERING"}},
        "recalls": [],
        "complaints": [
            {},  # completely empty record
            {"primary_subsystem": None, "filed_date": 12345},  # wrong types
            {"primary_subsystem": "STEERING", "filed_date": "not-a-date", "severity_tier": "UNKNOWN"}
        ]
    }
    result = analyzer.analyze(malformed_data)
    assert result["summary"]["total_cohort_records"] == 3
    assert result["summary"]["target_subsystem_records"] == 1


# 9. Real Snapshot End-to-End API Integration
def test_get_nhtsa_evidence_api_endpoint(client):
    response = client.get("/api/v1/evidence/nhtsa")
    assert response.status_code == 200
    data = response.json()

    assert "metadata" in data
    assert "summary" in data
    assert "safety_action" in data
    assert "subsystem_breakdown" in data
    assert "temporal_timeline" in data
    assert "traceable_signals" in data

    summary = data["summary"]
    assert summary["total_cohort_records"] == 2787
    assert summary["target_subsystem"] == "STEERING"
    assert summary["target_subsystem_records"] == 1429
    assert summary["subsystem_concentration_pct"] == 51.3
    assert summary["precursor_signals"] == 1383
    assert summary["critical_outcomes"] == 46
    assert summary["pre_action_signals"] == 414
    assert len(data["traceable_signals"]) > 0


# 10. Invariance: Zero DB Coupling
def test_evidence_track_zero_database_mutation(client):
    """Confirm reading evidence never queries or mutates operational database."""
    session = SessionLocal()
    try:
        asset_count_before = session.query(Asset).count()
        event_count_before = session.query(Event).count()

        response = client.get("/api/v1/evidence/nhtsa")
        assert response.status_code == 200

        assert session.query(Asset).count() == asset_count_before
        assert session.query(Event).count() == event_count_before
    finally:
        session.close()
