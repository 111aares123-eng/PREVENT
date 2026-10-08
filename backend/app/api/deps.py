"""
API dependencies and dependency injection providers.
"""
from typing import Generator, Optional
from fastapi import Depends
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.services.risk_engine import RiskEngine
from backend.app.services.llm import (
    LLMProvider,
    get_llm_provider as resolve_llm_provider,
    AudioTranscriber,
    get_audio_transcriber as resolve_audio_transcriber,
)
from backend.app.services.event_ingestion import EventIngestionService

# Re-export get_db for cleaner imports in endpoints
__all__ = [
    "get_db",
    "get_risk_engine",
    "get_llm_provider",
    "get_audio_transcriber",
    "get_event_ingestion_service"
]


def get_risk_engine() -> RiskEngine:
    """Dependency providing a configured RiskEngine singleton or instance."""
    return RiskEngine()


def get_llm_provider() -> Optional[LLMProvider]:
    """Dependency providing the configured LLMProvider (Groq, Gemini, or Mock)."""
    try:
        return resolve_llm_provider()
    except Exception:
        return None


def get_audio_transcriber() -> Optional[AudioTranscriber]:
    """Dependency providing the configured AudioTranscriber (Groq Whisper, Gemini, or Mock)."""
    try:
        return resolve_audio_transcriber()
    except Exception:
        return None


def get_event_ingestion_service() -> EventIngestionService:
    """Dependency providing the EventIngestionService instance."""
    return EventIngestionService()

