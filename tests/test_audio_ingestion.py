"""
Comprehensive Deterministic Test Suite for PREVENT Phase 2 Audio/Voice Ingestion.

Verifies the audio ingestion architecture:
  AUDIO FILE -> SPEECH-TO-TEXT -> EXISTING multilingual text extraction pipeline
  -> canonical ExtractedEventData -> human-review preview -> 0 DB mutations.

Test Matrix:
CASE A: English audio extraction
CASE B: Tamil audio extraction
CASE C: Hindi audio extraction
CASE D: Tanglish audio extraction
CASE E: Hinglish audio extraction
CASE F: Authoritative asset_id preservation
CASE G: Canonical enum validation (ASCII enums only)
CASE H: Transcript passed directly into existing multilingual extraction
CASE I: Missing audio file -> 422 Unprocessable Entity
CASE J: Unsupported audio format/type -> 422 Unprocessable Entity
CASE K: Empty or corrupt audio -> 422 Unprocessable Entity
CASE L: Preview-only guarantee (zero database mutations)
CASE M: Mock transcription operates completely offline without network
CASE N: Provider failure behavior does not silently fabricate an event
CASE O: Audio transcription router fallback behavior
"""
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.models.risk_assessment import RiskAssessment
from backend.app.schemas.event import EventType, Subsystem
from backend.app.api.deps import (
    get_llm_provider as get_llm_provider_dep,
    get_audio_transcriber as get_audio_transcriber_dep,
)
from backend.app.services.event_ingestion import EventIngestionService
from backend.app.services.llm.base import (
    LLMConfigurationError,
    LLMExtractionError,
    LLMTemporaryUnavailableError,
)
from backend.app.services.llm.mock_provider import MockProvider
from backend.app.services.llm.audio_transcriber import (
    AudioTranscriber,
    MockAudioTranscriber,
    AudioTranscriptionRouter,
    GroqAudioTranscriber,
    GeminiAudioTranscriber,
)
from data.scenarios.seed_data import seed_database


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure baseline database state before each test."""
    seed_database(reset=True)


@pytest.fixture
def mock_transcriber():
    """Mock audio transcriber instance."""
    return MockAudioTranscriber()


@pytest.fixture
def mock_llm_provider():
    """Deterministic mock LLM provider."""
    return MockProvider()


@pytest.fixture
def client(mock_transcriber, mock_llm_provider):
    """FastAPI TestClient with deterministic transcriber and LLM provider overrides."""
    app.dependency_overrides[get_audio_transcriber_dep] = lambda: mock_transcriber
    app.dependency_overrides[get_llm_provider_dep] = lambda: mock_llm_provider
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_audio_transcriber_dep, None)
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
# CASE A: English Audio Extraction
# ---------------------------------------------------------------------------

def test_case_a_english_audio_extraction(client):
    """
    CASE A: English voice report.
    Expected: canonical enum subsystem='braking', event_type='operational_report',
    severity=4, transcript and audio metadata preserved in raw_metadata.
    """
    files = {"audio": ("report_english.webm", b"[MOCK_AUDIO_ENGLISH]", "audio/webm")}
    data = {"asset_id": "BUS-142"}

    res = client.post("/api/v1/events/extract-audio", files=files, data=data)
    assert res.status_code == 200
    body = res.json()

    assert body["validation_status"] == "valid"
    ev = body["extracted_event"]
    assert ev is not None
    assert ev["asset_id"] == "BUS-142"
    assert ev["subsystem"] == "braking"
    assert ev["event_type"] == "operational_report"
    assert ev["severity"] == 4

    # Audio metadata preservation
    meta = ev.get("raw_metadata") or {}
    assert meta.get("source") == "audio/voice"
    assert meta.get("audio_transcribed") is True
    assert meta.get("transcript") == "The brake pedal became very hard during operation."
    assert meta.get("transcription_provider") == "mock"

    # Equivalence check with direct text extraction
    text_res = client.post("/api/v1/events/extract", json={
        "report_text": meta["transcript"],
        "asset_id": "BUS-142"
    }).json()
    assert text_res["validation_status"] == "valid"
    text_ev = text_res["extracted_event"]
    assert ev["subsystem"] == text_ev["subsystem"]
    assert ev["event_type"] == text_ev["event_type"]
    assert ev["severity"] == text_ev["severity"]


# ---------------------------------------------------------------------------
# CASE B: Tamil Audio Extraction
# ---------------------------------------------------------------------------

def test_case_b_tamil_audio_extraction(client):
    """
    CASE B: Tamil spoken voice report.
    Expected: canonical English enum subsystem='braking' (NEVER 'பிரேக்'),
    severity=4, detected_language='ta', verbatim transcript in raw_metadata.
    """
    files = {"audio": ("report_tamil.wav", b"[MOCK_AUDIO_TAMIL]", "audio/wav")}
    data = {"asset_id": "BUS-142"}

    res = client.post("/api/v1/events/extract-audio", files=files, data=data)
    assert res.status_code == 200
    body = res.json()

    assert body["validation_status"] == "valid"
    ev = body["extracted_event"]
    assert ev is not None
    assert ev["asset_id"] == "BUS-142"
    assert ev["subsystem"] == "braking"
    assert ev["subsystem"] != "பிரேக்"
    assert ev["subsystem"] != "பிரேக்கிங்"
    assert ev["event_type"] == "operational_report"
    assert ev["severity"] == 4

    meta = ev.get("raw_metadata") or {}
    assert meta.get("source") == "audio/voice"
    assert meta.get("detected_language") in ("ta", "code-mixed")
    assert meta.get("transcript") == "பிரேக் பெடல் மிகவும் கடினமாக இருந்தது"


# ---------------------------------------------------------------------------
# CASE C: Hindi Audio Extraction
# ---------------------------------------------------------------------------

def test_case_c_hindi_audio_extraction(client):
    """
    CASE C: Hindi spoken voice report.
    Expected: canonical English enum subsystem='braking' (NEVER 'ब्रेक'),
    severity=4, detected_language='hi', verbatim transcript in raw_metadata.
    """
    files = {"audio": ("report_hindi.wav", b"[MOCK_AUDIO_HINDI]", "audio/wav")}
    data = {"asset_id": "BUS-142"}

    res = client.post("/api/v1/events/extract-audio", files=files, data=data)
    assert res.status_code == 200
    body = res.json()

    assert body["validation_status"] == "valid"
    ev = body["extracted_event"]
    assert ev is not None
    assert ev["asset_id"] == "BUS-142"
    assert ev["subsystem"] == "braking"
    assert ev["subsystem"] != "ब्रेक"
    assert ev["subsystem"] != "ब्रेकिंग"
    assert ev["event_type"] == "operational_report"
    assert ev["severity"] == 4

    meta = ev.get("raw_metadata") or {}
    assert meta.get("source") == "audio/voice"
    assert meta.get("detected_language") in ("hi", "code-mixed")
    assert meta.get("transcript") == "ब्रेक पेडल बहुत सख्त हो गया था"


# ---------------------------------------------------------------------------
# CASE D: Tanglish Audio Extraction
# ---------------------------------------------------------------------------

def test_case_d_tanglish_audio_extraction(client):
    """
    CASE D: Tanglish spoken voice report.
    Expected: subsystem='braking', detected_language='ta-Latn', severity=4.
    """
    files = {"audio": ("report_tanglish.mp3", b"[MOCK_AUDIO_TANGLISH]", "audio/mp3")}
    data = {"asset_id": "BUS-142"}

    res = client.post("/api/v1/events/extract-audio", files=files, data=data)
    assert res.status_code == 200
    body = res.json()

    assert body["validation_status"] == "valid"
    ev = body["extracted_event"]
    assert ev is not None
    assert ev["asset_id"] == "BUS-142"
    assert ev["subsystem"] == "braking"
    assert ev["event_type"] == "operational_report"
    assert ev["severity"] == 4

    meta = ev.get("raw_metadata") or {}
    assert meta.get("detected_language") == "ta-Latn"
    assert meta.get("transcript") == "brake romba hard-ah irundhuchu"


# ---------------------------------------------------------------------------
# CASE E: Hinglish Audio Extraction
# ---------------------------------------------------------------------------

def test_case_e_hinglish_audio_extraction(client):
    """
    CASE E: Hinglish spoken voice report.
    Expected: subsystem='braking', detected_language='hi-Latn', severity=4.
    """
    files = {"audio": ("report_hinglish.m4a", b"[MOCK_AUDIO_HINGLISH]", "audio/m4a")}
    data = {"asset_id": "BUS-142"}

    res = client.post("/api/v1/events/extract-audio", files=files, data=data)
    assert res.status_code == 200
    body = res.json()

    assert body["validation_status"] == "valid"
    ev = body["extracted_event"]
    assert ev is not None
    assert ev["asset_id"] == "BUS-142"
    assert ev["subsystem"] == "braking"
    assert ev["event_type"] == "operational_report"
    assert ev["severity"] == 4

    meta = ev.get("raw_metadata") or {}
    assert meta.get("detected_language") == "hi-Latn"
    assert meta.get("transcript") == "brake pedal bohot hard ho gaya tha"


# ---------------------------------------------------------------------------
# CASE F: Authoritative Asset ID Preservation
# ---------------------------------------------------------------------------

def test_case_f_asset_id_preservation(client):
    """
    CASE F: Authoritative asset_id supplied by operator is preserved regardless
    of the language spoken in the audio file.
    """
    # Test with BUS-091
    files_1 = {"audio": ("voice_tamil.wav", b"[MOCK_AUDIO_TAMIL]", "audio/wav")}
    res_1 = client.post("/api/v1/events/extract-audio", files=files_1, data={"asset_id": "BUS-091"})
    assert res_1.status_code == 200
    assert res_1.json()["extracted_event"]["asset_id"] == "BUS-091"

    # Test with BUS-318
    files_2 = {"audio": ("voice_hindi.wav", b"[MOCK_AUDIO_HINDI]", "audio/wav")}
    res_2 = client.post("/api/v1/events/extract-audio", files=files_2, data={"asset_id": "BUS-318"})
    assert res_2.status_code == 200
    assert res_2.json()["extracted_event"]["asset_id"] == "BUS-318"


# ---------------------------------------------------------------------------
# CASE G: Canonical Enum Validation Across All Reports
# ---------------------------------------------------------------------------

def test_case_g_canonical_enum_validation(client):
    """
    CASE G: Verify that regardless of language or audio input, subsystem and event_type
    strictly belong to PREVENT's canonical ASCII English enumeration sets.
    """
    valid_subsystems = {s.value for s in Subsystem}
    valid_event_types = {e.value for e in EventType}

    audio_samples = [
        ("report_english.webm", b"[MOCK_AUDIO_ENGLISH]", "audio/webm"),
        ("report_tamil.wav", b"[MOCK_AUDIO_TAMIL]", "audio/wav"),
        ("report_hindi.wav", b"[MOCK_AUDIO_HINDI]", "audio/wav"),
        ("report_tanglish.mp3", b"[MOCK_AUDIO_TANGLISH]", "audio/mp3"),
        ("report_hinglish.m4a", b"[MOCK_AUDIO_HINGLISH]", "audio/m4a"),
    ]

    for fname, data_bytes, mime in audio_samples:
        files = {"audio": (fname, data_bytes, mime)}
        res = client.post("/api/v1/events/extract-audio", files=files, data={"asset_id": "BUS-142"})
        assert res.status_code == 200
        ev = res.json()["extracted_event"]
        assert ev["subsystem"] in valid_subsystems
        assert ev["event_type"] in valid_event_types
        assert ev["subsystem"].isascii()
        assert ev["event_type"].isascii()


# ---------------------------------------------------------------------------
# CASE H: Transcript Passed Directly into Multilingual Extraction
# ---------------------------------------------------------------------------

def test_case_h_transcript_passed_into_existing_multilingual_extraction(client, mock_transcriber):
    """
    CASE H: Verify that the exact transcript emitted by the audio transcriber
    flows directly into EventIngestionService.extract_from_report.
    """
    custom_transcript = "BUS-142 driver reported brake pedal abnormal vibration during wet conditions."
    mock_transcriber.set_mock_transcript(custom_transcript, detected_language="en")

    files = {"audio": ("report.wav", b"[CUSTOM_AUDIO]", "audio/wav")}
    res = client.post("/api/v1/events/extract-audio", files=files, data={"asset_id": "BUS-142"})
    assert res.status_code == 200

    body = res.json()
    assert body["validation_status"] == "valid"
    ev = body["extracted_event"]
    assert ev["subsystem"] == "braking"
    assert ev["raw_metadata"]["transcript"] == custom_transcript


# ---------------------------------------------------------------------------
# CASE I: Missing Audio File -> 422
# ---------------------------------------------------------------------------

def test_case_i_missing_audio_returns_422(client):
    """
    CASE I: Submitting a request without an audio file must return 422 Unprocessable Entity.
    """
    # Empty multipart body
    res = client.post("/api/v1/events/extract-audio", data={"asset_id": "BUS-142"})
    assert res.status_code == 422
    assert "Audio file is required" in res.json()["detail"]


# ---------------------------------------------------------------------------
# CASE J: Unsupported Audio Type -> 422
# ---------------------------------------------------------------------------

def test_case_j_unsupported_audio_type_returns_422(client):
    """
    CASE J: Submitting unsupported non-audio file types must return 422 Unprocessable Entity.
    """
    # Plain text file
    res_txt = client.post(
        "/api/v1/events/extract-audio",
        files={"audio": ("report.txt", b"plain text report content", "text/plain")}
    )
    assert res_txt.status_code == 422
    assert "Unsupported audio type" in res_txt.json()["detail"]

    # Image file
    res_img = client.post(
        "/api/v1/events/extract-audio",
        files={"audio": ("damage_photo.png", b"\x89PNG\r\n\x1a\n\x00\x00", "image/png")}
    )
    assert res_img.status_code == 422

    # Executable / binary
    res_bin = client.post(
        "/api/v1/events/extract-audio",
        files={"audio": ("payload.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/octet-stream")}
    )
    assert res_bin.status_code == 422


# ---------------------------------------------------------------------------
# CASE K: Corrupt / Empty Audio -> 422
# ---------------------------------------------------------------------------

def test_case_k_corrupt_or_empty_audio_returns_422(client):
    """
    CASE K: Submitting empty (0 bytes) or corrupted audio files must return 422.
    """
    # Empty audio file (0 bytes)
    res_empty = client.post(
        "/api/v1/events/extract-audio",
        files={"audio": ("silent.wav", b"", "audio/wav")}
    )
    assert res_empty.status_code == 422
    assert "empty" in res_empty.json()["detail"].lower()

    # Corrupt audio marker
    res_corrupt = client.post(
        "/api/v1/events/extract-audio",
        files={"audio": ("broken.wav", b"CORRUPT_AUDIO_FILE_DATA_CORRUPT", "audio/wav")}
    )
    assert res_corrupt.status_code == 422
    assert "corrupt" in res_corrupt.json()["detail"].lower()


# ---------------------------------------------------------------------------
# CASE L: Preview-Only Guarantee (No Database Mutation)
# ---------------------------------------------------------------------------

def test_case_l_preview_only_no_db_mutation(client, db_session):
    """
    CASE L: Extracting safety events from audio is preview-only and must NEVER mutate
    the Event table or the RiskAssessment table.
    """
    events_before = db_session.query(Event).count()
    assessments_before = db_session.query(RiskAssessment).count()

    # Perform multiple audio extractions
    audio_requests = [
        ("rep1.webm", b"[MOCK_AUDIO_ENGLISH]", "audio/webm", "BUS-142"),
        ("rep2.wav", b"[MOCK_AUDIO_TAMIL]", "audio/wav", "BUS-142"),
        ("rep3.wav", b"[MOCK_AUDIO_HINDI]", "audio/wav", "BUS-091"),
        ("rep4.mp3", b"[MOCK_AUDIO_TANGLISH]", "audio/mp3", "BUS-204"),
    ]

    for fname, content, mime, asset_id in audio_requests:
        res = client.post(
            "/api/v1/events/extract-audio",
            files={"audio": (fname, content, mime)},
            data={"asset_id": asset_id}
        )
        assert res.status_code == 200
        assert res.json()["validation_status"] == "valid"

    events_after = db_session.query(Event).count()
    assessments_after = db_session.query(RiskAssessment).count()

    assert events_after == events_before, "Database Event count mutated during audio extraction!"
    assert assessments_after == assessments_before, "Database RiskAssessment count mutated during audio extraction!"


# ---------------------------------------------------------------------------
# CASE M: Mock Transcription Operates Completely Offline
# ---------------------------------------------------------------------------

def test_case_m_mock_transcription_works_offline():
    """
    CASE M: Verify that MockAudioTranscriber operates 100% offline without network,
    API keys, or speech recognition packages.
    """
    transcriber = MockAudioTranscriber()
    assert transcriber.provider_name == "mock"

    tamil_res = transcriber.transcribe(b"dummy bytes", filename="audio_tamil.wav")
    assert tamil_res["provider"] == "mock"
    assert tamil_res["detected_language"] == "ta"
    assert "பிரேக்" in tamil_res["transcript"]

    hindi_res = transcriber.transcribe(b"dummy bytes", filename="audio_hindi.wav")
    assert hindi_res["provider"] == "mock"
    assert hindi_res["detected_language"] == "hi"
    assert "ब्रेक" in hindi_res["transcript"]

    english_res = transcriber.transcribe(b"dummy bytes", filename="audio_english.webm")
    assert english_res["provider"] == "mock"
    assert english_res["detected_language"] == "en"
    assert "brake" in english_res["transcript"].lower()


# ---------------------------------------------------------------------------
# CASE N: Provider Failure Behavior Does NOT Silently Fabricate an Event
# ---------------------------------------------------------------------------

def test_case_n_provider_failure_does_not_fabricate_event(client, mock_transcriber):
    """
    CASE N: When the transcription provider fails permanently, PREVENT must NOT
    silently fabricate a successful event with dummy fields. It must return invalid
    status with explicit error reporting.
    """
    mock_transcriber.set_mock_error(
        LLMExtractionError("Groq Whisper API upstream transcription failed: 400 Bad Request")
    )

    files = {"audio": ("test.wav", b"[DUMMY_AUDIO]", "audio/wav")}
    res = client.post("/api/v1/events/extract-audio", files=files, data={"asset_id": "BUS-142"})
    assert res.status_code == 200

    body = res.json()
    assert body["validation_status"] == "invalid"
    assert body["extracted_event"] is None
    assert any("Audio transcription failed" in err for err in body["validation_errors"])


# ---------------------------------------------------------------------------
# CASE O: Audio Router Multi-Tier Fallback Behavior
# ---------------------------------------------------------------------------

def test_case_o_audio_router_fallback():
    """
    CASE O: Verify AudioTranscriptionRouter fallbacks:
      1. Primary fails with temporary 503 -> Secondary attempted
      2. Secondary succeeds -> fallback_used=True with descriptive message
      3. Permanent auth error on primary -> does NOT silently fall back
    """
    # 1. Primary temporary 503 -> Secondary succeeds
    mock_primary = MagicMock(spec=GroqAudioTranscriber)
    mock_primary.provider_name = "groq"
    mock_primary.transcribe.side_effect = LLMTemporaryUnavailableError("503 Groq Service Unavailable", status_code=503)

    mock_secondary = MagicMock(spec=GeminiAudioTranscriber)
    mock_secondary.provider_name = "gemini"
    mock_secondary.transcribe.return_value = {
        "transcript": "The brake pedal became very hard during operation.",
        "detected_language": None,
        "provider": "gemini"
    }

    router = AudioTranscriptionRouter(
        primary_transcriber=mock_primary,
        secondary_transcriber=mock_secondary
    )
    result, fallback_used, fallback_msg = router.transcribe_with_fallback(b"sample audio")
    assert fallback_used is True
    assert result["provider"] == "gemini"
    assert "Groq Whisper temporarily unavailable — using Gemini audio transcriber" in fallback_msg

    # 2. Permanent auth error on primary -> must raise and NOT silently fall back
    mock_primary_auth = MagicMock(spec=GroqAudioTranscriber)
    mock_primary_auth.provider_name = "groq"
    mock_primary_auth.transcribe.side_effect = LLMConfigurationError("Groq API key is invalid or not configured.")

    mock_secondary_unused = MagicMock(spec=GeminiAudioTranscriber)
    mock_secondary_unused.provider_name = "gemini"

    auth_router = AudioTranscriptionRouter(
        primary_transcriber=mock_primary_auth,
        secondary_transcriber=mock_secondary_unused
    )
    with pytest.raises(LLMConfigurationError) as exc_info:
        auth_router.transcribe(b"sample audio")
    assert "Groq API key" in str(exc_info.value)
    assert mock_secondary_unused.transcribe.called is False
