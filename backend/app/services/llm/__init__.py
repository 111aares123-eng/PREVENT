"""
LLM Provider abstraction package for PREVENT.
Provides clean decoupling from AI backends, supporting Google Gemini
and an offline/deterministic MockProvider for testing.
"""
from typing import Optional
from backend.app.core.config import settings
from backend.app.services.llm.base import (
    LLMProvider,
    LLMProviderError,
    LLMConfigurationError,
    LLMExtractionError,
    LLMTemporaryUnavailableError,
    is_temporary_availability_error
)
from backend.app.services.llm.mock_provider import MockProvider
from backend.app.services.llm.gemini_provider import GeminiProvider
from backend.app.services.llm.groq_provider import GroqProvider
from backend.app.services.llm.provider_router import ProviderRouter
from backend.app.services.llm.audio_transcriber import (
    AudioTranscriber,
    GroqAudioTranscriber,
    GeminiAudioTranscriber,
    MockAudioTranscriber,
    AudioTranscriptionRouter,
    get_audio_transcriber,
)


def get_llm_provider(provider_type: Optional[str] = None) -> LLMProvider:
    """
    Factory resolving the active LLM provider from settings or explicit argument.
    Defaults to ProviderRouter (Groq -> Gemini -> Mock) unless explicitly overridden.
    """
    selected = (provider_type or settings.LLM_PROVIDER or "router").lower()

    if selected in ("router", "auto"):
        return ProviderRouter()
    elif selected == "groq":
        return GroqProvider()
    elif selected == "gemini":
        return GeminiProvider()
    elif selected == "mock":
        return MockProvider()
    else:
        raise LLMConfigurationError(
            f"Unsupported LLM provider: '{selected}'. Supported: 'router', 'groq', 'gemini', 'mock'"
        )


__all__ = [
    "LLMProvider",
    "LLMProviderError",
    "LLMConfigurationError",
    "LLMExtractionError",
    "LLMTemporaryUnavailableError",
    "is_temporary_availability_error",
    "GroqProvider",
    "GeminiProvider",
    "MockProvider",
    "ProviderRouter",
    "get_llm_provider",
    "AudioTranscriber",
    "GroqAudioTranscriber",
    "GeminiAudioTranscriber",
    "MockAudioTranscriber",
    "AudioTranscriptionRouter",
    "get_audio_transcriber",
]
