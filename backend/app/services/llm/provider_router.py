"""
Multi-tier LLM Provider Router for PREVENT.
Coordinates transparent routing and graceful controlled fallbacks:
  1. Primary: Groq
  2. Secondary: Gemini
  3. Final Fallback: MockProvider
"""
import logging
from typing import Any, Dict, Optional, Tuple

from backend.app.core.config import settings
from backend.app.services.llm.base import (
    LLMProvider,
    LLMConfigurationError,
    LLMExtractionError,
    LLMTemporaryUnavailableError,
    is_temporary_availability_error
)
from backend.app.services.llm.mock_provider import MockProvider
from backend.app.services.llm.gemini_provider import GeminiProvider
from backend.app.services.llm.groq_provider import GroqProvider

logger = logging.getLogger(__name__)


class ProviderRouter(LLMProvider):
    """
    Multi-tier LLM router with graceful controlled fallbacks.
    Tiers:
      1. Primary (default: Groq)
      2. Secondary (default: Gemini)
      3. Final Fallback (MockProvider)
    """

    def __init__(
        self,
        primary_provider: Optional[LLMProvider] = None,
        secondary_provider: Optional[LLMProvider] = None,
        fallback_provider: Optional[LLMProvider] = None,
    ):
        self._explicit_primary = primary_provider
        self._explicit_secondary = secondary_provider
        self._explicit_fallback = fallback_provider

    @property
    def provider_name(self) -> str:
        return "router"

    def _resolve_provider(self, name: str) -> LLMProvider:
        name_clean = (name or "").lower().strip()
        if name_clean == "groq":
            return GroqProvider()
        elif name_clean == "gemini":
            return GeminiProvider()
        elif name_clean == "mock":
            return MockProvider()
        else:
            raise LLMConfigurationError(f"Unsupported provider in router configuration: '{name}'")

    def get_primary(self) -> LLMProvider:
        if self._explicit_primary is not None:
            return self._explicit_primary
        primary_name = getattr(settings, "LLM_PRIMARY", "groq")
        return self._resolve_provider(primary_name)

    def get_secondary(self) -> LLMProvider:
        if self._explicit_secondary is not None:
            return self._explicit_secondary
        secondary_name = getattr(settings, "LLM_SECONDARY", "gemini")
        return self._resolve_provider(secondary_name)

    def get_fallback(self) -> LLMProvider:
        if self._explicit_fallback is not None:
            return self._explicit_fallback
        fallback_name = getattr(settings, "LLM_FALLBACK", "mock")
        return self._resolve_provider(fallback_name)

    def extract_with_fallback(
        self,
        report_text: str
    ) -> Tuple[Dict[str, Any], str, bool, Optional[str]]:
        """
        Executes multi-tier extraction following:
          Primary (Groq) -> Secondary (Gemini) -> Final Fallback (Mock)

        Returns:
          Tuple of (raw_data, actual_provider_name, fallback_used, fallback_message)
        """
        primary = self.get_primary()
        primary_name = primary.provider_name

        # --- Tier 1: Try Primary Provider (Groq) ---
        try:
            raw_data = primary.extract_event(report_text)
            return raw_data, primary_name, False, None
        except Exception as primary_exc:
            if not is_temporary_availability_error(primary_exc):
                # Permanent error (auth failure, missing key, bad request) -> DO NOT silently fall back
                raise primary_exc

            logger.warning(
                "Primary provider '%s' failed with temporary availability error: %s. Attempting secondary provider.",
                primary_name,
                primary_exc
            )

        # --- Tier 2: Try Secondary Provider (Gemini) ---
        secondary = self.get_secondary()
        secondary_name = secondary.provider_name

        try:
            raw_data = secondary.extract_event(report_text)
            fallback_msg = f"{primary_name.title()} temporarily unavailable — using {secondary_name.title()} secondary provider."
            return raw_data, secondary_name, True, fallback_msg
        except Exception as secondary_exc:
            if not is_temporary_availability_error(secondary_exc):
                # Permanent error on secondary provider -> DO NOT silently fall back to mock
                raise secondary_exc

            logger.warning(
                "Secondary provider '%s' failed with temporary availability error: %s. Attempting final fallback.",
                secondary_name,
                secondary_exc
            )

        # --- Tier 3: Try Final Fallback Provider (MockProvider) ---
        fallback = self.get_fallback()
        fallback_name = fallback.provider_name

        try:
            raw_data = fallback.extract_event(report_text)
            fallback_msg = "Hosted AI providers temporarily unavailable — using local fallback."
            return raw_data, fallback_name, True, fallback_msg
        except Exception as fallback_exc:
            raise LLMExtractionError(
                f"All extraction providers failed including final fallback: {str(fallback_exc)}"
            ) from fallback_exc

    def extract_event(self, report_text: str) -> Dict[str, Any]:
        """Implements standard LLMProvider extract_event interface."""
        raw_data, _, _, _ = self.extract_with_fallback(report_text)
        return raw_data
