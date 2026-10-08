"""
Abstract base class and error definitions for LLM providers.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class LLMProviderError(Exception):
    """Base exception for all LLM provider errors."""
    pass


class LLMConfigurationError(LLMProviderError):
    """Raised when an LLM provider is misconfigured (e.g. missing API key)."""
    pass


class LLMExtractionError(LLMProviderError):
    """Raised when an LLM provider fails to extract or parse structured data."""
    pass


class LLMTemporaryUnavailableError(LLMProviderError):
    """Raised when an LLM provider encounters a temporary/transient availability failure (e.g. HTTP 503, 502, 504, 500)."""
    def __init__(self, message: str, status_code: Optional[int] = 503):
        super().__init__(message)
        self.status_code = status_code


def is_temporary_availability_error(exc: Exception) -> bool:
    """
    Check if an exception represents temporary upstream provider availability failure (e.g. 503, 500, 502, 504, UNAVAILABLE).
    Permanent errors (401, 403, 400, auth, config, schema) MUST return False.
    """
    if isinstance(exc, LLMConfigurationError):
        return False

    if isinstance(exc, LLMTemporaryUnavailableError):
        return True

    # Check HTTP status / code attribute if present
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if isinstance(code, int):
        if code in (500, 502, 503, 504):
            return True
        if 400 <= code < 500:
            return False

    # Check for google.genai.errors.ServerError
    try:
        from google.genai import errors as genai_errors
        if isinstance(exc, genai_errors.ServerError):
            return True
        if isinstance(exc, genai_errors.ClientError):
            return False
    except ImportError:
        pass

    # Check string representation for temporary availability cues
    err_str = str(exc).upper()

    # Disqualify client/auth/config errors immediately
    disqualifiers = [
        "API_KEY",
        "UNAUTHENTICATED",
        "PERMISSION_DENIED",
        "INVALID_ARGUMENT",
        "400",
        "401",
        "403",
        "NOT_FOUND",
        "404"
    ]
    if any(d in err_str for d in disqualifiers):
        return False

    transient_indicators = [
        "503",
        "UNAVAILABLE",
        "SERVICE UNAVAILABLE",
        "HIGH DEMAND",
        "CAPACITY",
        "502",
        "BAD GATEWAY",
        "504",
        "GATEWAY TIMEOUT",
        "500",
        "INTERNAL SERVER ERROR"
    ]
    return any(ind in err_str for ind in transient_indicators)


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
