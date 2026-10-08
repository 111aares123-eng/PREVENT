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
    LLMExtractionError
)
from backend.app.services.llm.mock_provider import MockProvider
from backend.app.services.llm.gemini_provider import GeminiProvider


def get_llm_provider(provider_type: Optional[str] = None) -> LLMProvider:
    """
    Factory resolving the active LLM provider from settings or explicit argument.
    Defaults to MockProvider if no API key is present or provider is 'mock'.
    """
    selected = (provider_type or settings.LLM_PROVIDER or "mock").lower()

    if selected == "gemini":
        return GeminiProvider()
    elif selected == "mock":
        return MockProvider()
    else:
        raise LLMConfigurationError(f"Unsupported LLM provider: '{selected}'. Supported: 'gemini', 'mock'")


__all__ = [
    "LLMProvider",
    "LLMProviderError",
    "LLMConfigurationError",
    "LLMExtractionError",
    "GeminiProvider",
    "MockProvider",
    "get_llm_provider"
]
