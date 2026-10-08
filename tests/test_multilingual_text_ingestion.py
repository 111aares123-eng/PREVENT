"""
Comprehensive Deterministic Test Suite for PREVENT Phase 1 Multilingual Text Ingestion.

Verifies that POST /api/v1/events/extract accurately understands and normalizes:
- English
- Tamil script (தமிழ்)
- Tanglish (Tamil in Latin script)
- Hindi Devanagari script (हिन्दी)
- Hinglish (Hindi in Latin script)
- Code-mixed English + Tamil / Hindi reports

Test Matrix:
CASE A: English braking report
CASE B: Tamil-script braking report
CASE C: Tanglish braking report
CASE D: Hindi Devanagari braking report
CASE E: Hinglish braking report
CASE F: English + Tamil mixed report
CASE G: English + Hindi mixed report
CASE H: Canonical enum enforcement
CASE I: Severity remains 1-5 integer
CASE J: Authoritative asset_id preserved regardless of language
CASE K: Extraction preview-only guarantee (zero database mutations)
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.models.risk_assessment import RiskAssessment
from backend.app.schemas.event import EventType, Subsystem
from backend.app.api.deps import get_llm_provider as get_llm_provider_dep
from backend.app.services.llm.mock_provider import MockProvider
from data.scenarios.seed_data import seed_database


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure clean baseline database before tests."""
    seed_database(reset=True)


@pytest.fixture
def client():
    """FastAPI TestClient with deterministic MockProvider override."""
    mock = MockProvider()
    app.dependency_overrides[get_llm_provider_dep] = lambda: mock
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_llm_provider_dep, None)


@pytest.fixture
def db_session():
    """Database session fixture."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# CASE A: English Braking Report
# ---------------------------------------------------------------------------

def test_case_a_english_braking_report(client):
    """
    CASE A: Standard English report.
    Expected: canonical enum subsystem='braking', event_type='operational_report', severity=4.
    """
    report = (
        "Driver reported that BUS-142 required significantly more distance to stop "
        "during heavy rain and the brake pedal felt abnormal."
    )
    res = client.post("/api/v1/events/extract", json={"report_text": report})
    assert res.status_code == 200
    data = res.json()

    assert data["validation_status"] == "valid"
    ev = data["extracted_event"]
    assert ev is not None
    assert ev["asset_id"] == "BUS-142"
    assert ev["subsystem"] == "braking"
    assert ev["event_type"] == "operational_report"
    assert ev["severity"] == 4
    assert ev["reporter_role"] == "driver"


# ---------------------------------------------------------------------------
# CASE B: Tamil Script Braking Report
# ---------------------------------------------------------------------------

def test_case_b_tamil_script_braking_report(client):
    """
    CASE B: Native Tamil script report.
    Expected: Canonical English subsystem='braking' (NEVER localized/translated enum string),
    severity=4, language tracking in raw_metadata.
    """
    report = "BUS-142 கனமழையின் போது பிரேக் பெடல் மிகவும் கடினமாக இருந்தது மற்றும் வாகனம் தாமதமாக நின்றது என ஓட்டுநர் தெரிவித்தார்."
    res = client.post("/api/v1/events/extract", json={"report_text": report})
    assert res.status_code == 200
    data = res.json()

    assert data["validation_status"] == "valid"
    ev = data["extracted_event"]
    assert ev is not None
    assert ev["asset_id"] == "BUS-142"
    # Canonical enum enforcement
    assert ev["subsystem"] == "braking"
    assert ev["subsystem"] != "பிரேக்"
    assert ev["subsystem"] != "பிரேக்கிங்"
    assert ev["event_type"] == "operational_report"
    assert ev["severity"] == 4
    # Language tracking
    meta = ev.get("raw_metadata") or {}
    assert meta.get("detected_language") in ("ta", "code-mixed")
    assert meta.get("original_text") == report
    # Description normalized to English
    assert isinstance(ev["description"], str)
    assert len(ev["description"]) > 5


# ---------------------------------------------------------------------------
# CASE C: Tanglish Braking Report (Tamil in Latin Characters)
# ---------------------------------------------------------------------------

def test_case_c_tanglish_braking_report(client):
    """
    CASE C: Tanglish report (Tamil spoken phonetically in Latin script).
    Expected: Normalized English enum subsystem='braking', severity=4, detected_language='ta-Latn'.
    """
    report = "BUS-142 heavy rain-la brake romba loose-ah irundhuchu, stop panna romba distance aachu endru driver report pannaru."
    res = client.post("/api/v1/events/extract", json={"report_text": report})
    assert res.status_code == 200
    data = res.json()

    assert data["validation_status"] == "valid"
    ev = data["extracted_event"]
    assert ev is not None
    assert ev["asset_id"] == "BUS-142"
    assert ev["subsystem"] == "braking"
    assert ev["event_type"] == "operational_report"
    assert ev["severity"] == 4
    meta = ev.get("raw_metadata") or {}
    assert meta.get("detected_language") == "ta-Latn"
    assert meta.get("original_text") == report


# ---------------------------------------------------------------------------
# CASE D: Hindi Devanagari Script Braking Report
# ---------------------------------------------------------------------------

def test_case_d_hindi_devanagari_braking_report(client):
    """
    CASE D: Native Hindi Devanagari script report.
    Expected: Canonical English subsystem='braking' (NEVER localized 'ब्रेक'),
    severity=4, language tracking in raw_metadata.
    """
    report = "ड्राइवर ने सूचना दी कि भारी बारिश में BUS-142 का ब्रेक पेडल बहुत सख्त हो गया था और रुकने में काफी अधिक दूरी लगी।"
    res = client.post("/api/v1/events/extract", json={"report_text": report})
    assert res.status_code == 200
    data = res.json()

    assert data["validation_status"] == "valid"
    ev = data["extracted_event"]
    assert ev is not None
    assert ev["asset_id"] == "BUS-142"
    # Canonical enum enforcement
    assert ev["subsystem"] == "braking"
    assert ev["subsystem"] != "ब्रेक"
    assert ev["subsystem"] != "ब्रेकिंग"
    assert ev["event_type"] == "operational_report"
    assert ev["severity"] == 4
    meta = ev.get("raw_metadata") or {}
    assert meta.get("detected_language") in ("hi", "code-mixed")
    assert meta.get("original_text") == report


# ---------------------------------------------------------------------------
# CASE E: Hinglish Braking Report (Hindi in Latin Characters)
# ---------------------------------------------------------------------------

def test_case_e_hinglish_braking_report(client):
    """
    CASE E: Hinglish report (Hindi spoken phonetically in Latin script).
    Expected: Normalized English enum subsystem='braking', severity=4, detected_language='hi-Latn'.
    """
    report = "BUS-142 heavy rain me brake pedal bohot hard ho gaya tha aur gaadi rukne me bohot zyada distance le rahi thi."
    res = client.post("/api/v1/events/extract", json={"report_text": report})
    assert res.status_code == 200
    data = res.json()

    assert data["validation_status"] == "valid"
    ev = data["extracted_event"]
    assert ev is not None
    assert ev["asset_id"] == "BUS-142"
    assert ev["subsystem"] == "braking"
    assert ev["event_type"] == "operational_report"
    assert ev["severity"] == 4
    meta = ev.get("raw_metadata") or {}
    assert meta.get("detected_language") == "hi-Latn"
    assert meta.get("original_text") == report


# ---------------------------------------------------------------------------
# CASE F: English + Tamil Code-Mixed Report
# ---------------------------------------------------------------------------

def test_case_f_english_tamil_mixed_report(client):
    """
    CASE F: Bilingual code-mixed English + Tamil report.
    Expected: Subsystem='braking', detected_language='code-mixed'.
    """
    report = "BUS-142 driver reported brake pedal abnormal vibration, வண்டி சிக்னலில் நிற்காமல் தாமதமாக நின்றது during wet road conditions."
    res = client.post("/api/v1/events/extract", json={"report_text": report})
    assert res.status_code == 200
    data = res.json()

    assert data["validation_status"] == "valid"
    ev = data["extracted_event"]
    assert ev is not None
    assert ev["subsystem"] == "braking"
    assert ev["event_type"] == "operational_report"
    meta = ev.get("raw_metadata") or {}
    assert meta.get("detected_language") in ("code-mixed", "ta")


# ---------------------------------------------------------------------------
# CASE G: English + Hindi Code-Mixed Report
# ---------------------------------------------------------------------------

def test_case_g_english_hindi_mixed_report(client):
    """
    CASE G: Bilingual code-mixed English + Hindi near-miss report.
    Expected: Subsystem='braking', event_type='near_miss', severity=5.
    """
    report = "BUS-142 emergency stop: vehicle overshot the signal, बाल-बाल बचे red light crossing पर."
    res = client.post("/api/v1/events/extract", json={"report_text": report})
    assert res.status_code == 200
    data = res.json()

    assert data["validation_status"] == "valid"
    ev = data["extracted_event"]
    assert ev is not None
    assert ev["subsystem"] == "braking"
    assert ev["event_type"] == "near_miss"
    assert ev["severity"] == 5
    meta = ev.get("raw_metadata") or {}
    assert meta.get("detected_language") in ("code-mixed", "hi")


# ---------------------------------------------------------------------------
# CASE H: Canonical Enum Enforcement Across All Reports
# ---------------------------------------------------------------------------

def test_case_h_canonical_enum_enforcement(client):
    """
    CASE H: Verify that regardless of language or script, subsystem and event_type
    strictly belong to PREVENT's canonical English enumeration sets.
    """
    valid_subsystems = {s.value for s in Subsystem}
    valid_event_types = {e.value for e in EventType}

    test_reports = [
        "BUS-142 பிரேக் பழுது நீக்கப்பட்டது ஒர்க்‌ஷாப் மூலம்.",
        "BUS-142 ब्रेक की मरम्मत डिपो में पूरी हुई।",
        "BUS-204 steering pull aachu left side-la.",
        "BUS-091 दरवाजा ठीक से बंद नहीं हो रहा है, यात्री ने शिकायत की।",
        "BUS-318 ஆய்வு தணிக்கை பாஸ் செய்யப்பட்டது."
    ]

    for rep in test_reports:
        res = client.post("/api/v1/events/extract", json={"report_text": rep})
        assert res.status_code == 200
        data = res.json()
        assert data["validation_status"] == "valid"
        ev = data["extracted_event"]

        assert ev["subsystem"] in valid_subsystems, f"Invalid subsystem '{ev['subsystem']}' for report: {rep}"
        assert ev["event_type"] in valid_event_types, f"Invalid event_type '{ev['event_type']}' for report: {rep}"
        # Ensure enums contain ONLY ASCII characters
        assert ev["subsystem"].isascii(), f"Non-ASCII subsystem: {ev['subsystem']}"
        assert ev["event_type"].isascii(), f"Non-ASCII event_type: {ev['event_type']}"


# ---------------------------------------------------------------------------
# CASE I: Severity Remains Integer 1 to 5
# ---------------------------------------------------------------------------

def test_case_i_severity_remains_bounded_1_to_5(client):
    """
    CASE I: Verify that severity rating always satisfies 1 <= severity <= 5 across languages.
    """
    test_reports = [
        ("BUS-142 விபத்து: மோதல் ஏற்பட்டது.", 5),  # Collision / critical
        ("BUS-142 கனமழையில் பிரேக் பிடிக்க தாமதமானது.", 4),  # Severe braking
        ("BUS-142 லேசான பிரேக் தேய்மானம்.", 2),  # Minor wear
        ("BUS-142 डिपो में नियमित निरीक्षण पूरा हुआ।", 2),  # Routine inspection
        ("BUS-142 बाल-बाल बचे आपातकालीन ब्रेक लगाने से।", 5),  # Near-miss critical
    ]

    for rep, expected_sev in test_reports:
        res = client.post("/api/v1/events/extract", json={"report_text": rep})
        assert res.status_code == 200
        ev = res.json()["extracted_event"]
        assert isinstance(ev["severity"], int)
        assert 1 <= ev["severity"] <= 5
        assert ev["severity"] == expected_sev


# ---------------------------------------------------------------------------
# CASE J: Authoritative Asset ID Preserved Regardless of Language
# ---------------------------------------------------------------------------

def test_case_j_authoritative_asset_id_preserved_across_languages(client):
    """
    CASE J: The operator-supplied asset_id must override/anchor the extraction
    regardless of input language or text contents.
    """
    # 1. Tamil report referring to BUS-142, but target asset_id is BUS-091
    tamil_rep = "BUS-142 பிரேக் பெடல் மிகவும் கடினமாக இருந்தது."
    res_ta = client.post("/api/v1/events/extract", json={"report_text": tamil_rep, "asset_id": "BUS-091"})
    assert res_ta.status_code == 200
    assert res_ta.json()["extracted_event"]["asset_id"] == "BUS-091"

    # 2. Hindi report without any asset ID, target asset_id is BUS-204
    hindi_rep = "ड्राइवर ने ब्रेक में असामान्य देरी की सूचना दी।"
    res_hi = client.post("/api/v1/events/extract", json={"report_text": hindi_rep, "asset_id": "BUS-204"})
    assert res_hi.status_code == 200
    assert res_hi.json()["extracted_event"]["asset_id"] == "BUS-204"

    # 3. Tanglish report
    tanglish_rep = "Brake romba loose aayidichu road-la."
    res_tg = client.post("/api/v1/events/extract", json={"report_text": tanglish_rep, "asset_id": "BUS-142"})
    assert res_tg.status_code == 200
    assert res_tg.json()["extracted_event"]["asset_id"] == "BUS-142"


# ---------------------------------------------------------------------------
# CASE K: Extraction Remains Preview-Only and Does Not Mutate Database
# ---------------------------------------------------------------------------

def test_case_k_extraction_preview_does_not_mutate_database(client, db_session):
    """
    CASE K: Invariant test: AI extraction must be preview-only and NEVER mutate
    the Event table or RiskAssessment table, regardless of how many multilingual
    reports are analyzed.
    """
    events_before = db_session.query(Event).count()
    assessments_before = db_session.query(RiskAssessment).count()

    multilingual_reports = [
        {"report_text": "BUS-142 கனமழையில் பிரேக் பிடிக்க தாமதமானது.", "asset_id": "BUS-142"},
        {"report_text": "BUS-142 ब्रेक पेडल सख्त हो गया है।", "asset_id": "BUS-142"},
        {"report_text": "BUS-142 brake loose-ah irundhuchu road-la.", "asset_id": "BUS-142"},
        {"report_text": "BUS-142 gaadi rukne me time le rahi hai.", "asset_id": "BUS-142"}
    ]

    for payload in multilingual_reports:
        res = client.post("/api/v1/events/extract", json=payload)
        assert res.status_code == 200
        assert res.json()["validation_status"] == "valid"

    events_after = db_session.query(Event).count()
    assessments_after = db_session.query(RiskAssessment).count()

    assert events_after == events_before, "Database Event count mutated during multilingual extraction preview!"
    assert assessments_after == assessments_before, "Database RiskAssessment count mutated during extraction preview!"
