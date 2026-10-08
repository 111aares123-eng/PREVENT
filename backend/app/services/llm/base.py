"""
Abstract base class and error definitions for LLM providers.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict


class LLMProviderError(Exception):
    """Base exception for all LLM provider errors."""
    pass


class LLMConfigurationError(LLMProviderError):
    """Raised when an LLM provider is misconfigured (e.g. missing API key)."""
    pass


class LLMExtractionError(LLMProviderError):
    """Raised when an LLM provider fails to extract or parse structured data."""
    pass


class LLMProvider(ABC):
    """
    Abstract interface for LLM extraction providers in PREVENT.
    Decouples the system from specific model APIs (Gemini, Claude, OpenAI, Mock, etc.).
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable identifier for the provider (e.g. 'gemini', 'mock')."""
        pass

    @abstractmethod
    def extract_event(self, report_text: str) -> Dict[str, Any]:
        """
        Extract structured event fields from unstructured natural language text.

        Args:
            report_text: Unstructured human report narrative.

        Returns:
            Dict containing extracted fields matching PREVENT's schema.

        Raises:
            LLMProviderError: On extraction failure or invalid response.
        """
        pass
