"""
Tests for Phase 4: Deterministic Multilingual Action Guidance Engine.

Verifies:
1. LOW -> Monitor
2. MEDIUM -> Inspect
3. HIGH -> Inspect + Escalate
4. CRITICAL -> Isolate + Escalate
5. English, Tamil, and Hindi action outputs
6. Switching action language
7. Unknown language fallback -> English
8. Unknown role fallback -> general
9. Invariants:
   - Action guidance does NOT alter risk scores
   - Action guidance does NOT mutate event records
   - Action guidance does NOT mutate database state
"""

import pytest
from backend.app.services.action_guidance import (
    get_action_category_for_risk_level,
    get_recommended_action,
    ACTION_TRANSLATIONS
)
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.models.risk_assessment import RiskAssessment
from backend.app.services.risk_engine import RiskEngine
from data.scenarios.seed_data import seed_database


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure clean baseline database state before each test."""
    seed_database(reset=True)


@pytest.fixture()
def db_session():

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def risk_engine():
    return RiskEngine()


def test_deterministic_category_mapping():
    """Verify exact 4-tier deterministic category classification."""
    assert get_action_category_for_risk_level("LOW") == "MONITOR"
    assert get_action_category_for_risk_level("MEDIUM") == "INSPECT"
    assert get_action_category_for_risk_level("HIGH") == "INSPECT_ESCALATE"
    assert get_action_category_for_risk_level("CRITICAL") == "ISOLATE_ESCALATE"
    
    # Case insensitivity
    assert get_action_category_for_risk_level("low") == "MONITOR"
    assert get_action_category_for_risk_level("medium") == "INSPECT"
    assert get_action_category_for_risk_level("high") == "INSPECT_ESCALATE"
    assert get_action_category_for_risk_level("critical") == "ISOLATE_ESCALATE"


def test_english_action_output():
    """Verify canonical English output for all risk bands."""
    low = get_recommended_action("LOW", "en")
    assert low["category"] == "MONITOR"
    assert low["title"] == "Monitor"
    assert "Continue routine observation" in low["instruction"]

    medium = get_recommended_action("MEDIUM", "en")
    assert medium["category"] == "INSPECT"
    assert medium["title"] == "Inspect"
    assert "Review the affected subsystem and check for recurring warning signals" in medium["instruction"]

    high = get_recommended_action("HIGH", "en")
    assert high["category"] == "INSPECT_ESCALATE"
    assert high["title"] == "Inspect + Escalate"
    assert "Perform a focused inspection and notify the responsible" in high["instruction"]

    critical = get_recommended_action("CRITICAL", "en")
    assert critical["category"] == "ISOLATE_ESCALATE"
    assert critical["title"] == "Isolate + Escalate"
    assert "Do not return the affected asset to normal operation" in critical["instruction"]


def test_tamil_action_output():
    """Verify natural, professional Tamil action guidance."""
    low = get_recommended_action("LOW", "ta")
    assert low["category"] == "MONITOR"
    assert low["title"] == "கண்காணிப்பு"
    assert "வழக்கமான செயல்பாட்டுக் கண்காணிப்பைத் தொடரவும்" in low["instruction"]

    medium = get_recommended_action("MEDIUM", "ta")
    assert medium["category"] == "INSPECT"
    assert medium["title"] == "ஆய்வு"
    assert "பாதிக்கப்பட்ட அமைப்பை மதிப்பாய்வு செய்து" in medium["instruction"]

    high = get_recommended_action("HIGH", "ta")
    assert high["category"] == "INSPECT_ESCALATE"
    assert "ஆய்வு" in high["title"]
    assert "முழுமையாக ஆய்வு செய்து பொறுப்பான பாதுகாப்புக் குழுவிற்கு தகவல் தெரிவிக்கவும்" in high["instruction"]

    critical = get_recommended_action("CRITICAL", "ta")
    assert critical["category"] == "ISOLATE_ESCALATE"
    assert "தனிமைப்படுத்துதல்" in critical["title"]
    assert "பொறுப்பான பாதுகாப்புக் குழு ஆய்வு செய்து உறுதிப்படுத்தும் வரை" in critical["instruction"]


def test_hindi_action_output():
    """Verify natural, professional Hindi action guidance."""
    low = get_recommended_action("LOW", "hi")
    assert low["category"] == "MONITOR"
    assert "निगरानी" in low["title"]
    assert "नियमित अवलोकन जारी रखें" in low["instruction"]

    medium = get_recommended_action("MEDIUM", "hi")
    assert medium["category"] == "INSPECT"
    assert "जाँच" in medium["title"]
    assert "प्रभावित प्रणाली की समीक्षा करें" in medium["instruction"]

    high = get_recommended_action("HIGH", "hi")
    assert high["category"] == "INSPECT_ESCALATE"
    assert "जाँच + सूचना दें" in high["title"]
    assert "जिम्मेदार सुरक्षा टीम को सूचित करें" in high["instruction"]

    critical = get_recommended_action("CRITICAL", "hi")
    assert critical["category"] == "ISOLATE_ESCALATE"
    assert "अलग करें" in critical["title"]
    assert "जब तक जिम्मेदार सुरक्षा टीम जाँच और सत्यापन न कर ले" in critical["instruction"]


def test_language_fallback_and_switching():
    """Verify language switching and unknown language fallback to English."""
    # Unknown language falls back to English
    unknown_lang = get_recommended_action("HIGH", "fr")
    assert unknown_lang["language"] == "en"
    assert unknown_lang["title"] == "Inspect + Escalate"

    # None / empty falls back to English
    empty_lang = get_recommended_action("HIGH", "")
    assert empty_lang["language"] == "en"
    assert empty_lang["title"] == "Inspect + Escalate"

    # Switching from EN to TA to HI preserves category
    en_res = get_recommended_action("CRITICAL", "en")
    ta_res = get_recommended_action("CRITICAL", "ta")
    hi_res = get_recommended_action("CRITICAL", "hi")

    assert en_res["category"] == ta_res["category"] == hi_res["category"] == "ISOLATE_ESCALATE"


def test_role_perspectives_and_fallback():
    """Verify role perspective nuances and fallback."""
    # Field worker perspective
    fw = get_recommended_action("HIGH", "en", "field_worker")
    assert fw["role"] == "field_worker"
    assert "immediately report findings to supervisor" in fw["role_instruction"]

    # Unknown role falls back to general
    unknown_role = get_recommended_action("HIGH", "en", "astronaut")
    assert unknown_role["role"] == "general"
    assert unknown_role["role_instruction"] == unknown_role["instruction"]


def test_invariance_no_database_or_risk_mutation(db_session, risk_engine):
    """Verify action guidance is purely deterministic and does NOT mutate risk, events, or DB."""
    # 1. Capture baseline counts
    event_count_before = db_session.query(Event).count()
    asset_count_before = db_session.query(Asset).count()
    assessment_count_before = db_session.query(RiskAssessment).count()

    # 2. Evaluate BUS-142 risk
    bus142 = db_session.query(Asset).filter(Asset.asset_id == "BUS-142").first()
    assert bus142 is not None
    latest_ev = max(bus142.events, key=lambda e: e.timestamp)
    assessment_before = risk_engine.evaluate_asset(bus142, bus142.events, anchor_time=latest_ev.timestamp)
    score_before = round(assessment_before.score, 1)
    level_before = assessment_before.risk_level

    # 3. Call action guidance across multiple languages & roles
    for lang in ["en", "ta", "hi", "unknown"]:
        for r_level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
            for role in ["general", "field_worker", "supervisor", "safety_officer"]:
                action = get_recommended_action(r_level, lang, role)
                assert action["category"] is not None

    # 4. Re-evaluate BUS-142 risk to ensure zero side-effects
    assessment_after = risk_engine.evaluate_asset(bus142, bus142.events, anchor_time=latest_ev.timestamp)
    assert round(assessment_after.score, 1) == score_before == 82.0
    assert assessment_after.risk_level == level_before == "HIGH"

    # 5. Verify database counts remain strictly identical
    assert db_session.query(Event).count() == event_count_before
    assert db_session.query(Asset).count() == asset_count_before
    assert db_session.query(RiskAssessment).count() == assessment_count_before
