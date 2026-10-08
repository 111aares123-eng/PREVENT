"""
Groq LLM Provider for PREVENT event extraction.
Uses official Groq Python SDK with JSON object response format.
"""
import json
import os
import re
from typing import Any, Dict, Optional
import groq

from backend.app.core.config import settings
from backend.app.services.llm.base import (
    LLMProvider,
    LLMConfigurationError,
    LLMExtractionError,
    LLMTemporaryUnavailableError,
    is_temporary_availability_error
)
from backend.app.services.llm.prompts import EVENT_EXTRACTION_SYSTEM_PROMPT


class GroqProvider(LLMProvider):
    """
    Groq extraction provider using the official Groq Python SDK.
    High-throughput, low-latency extraction with structured JSON mode.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None
    ):
        raw_key = api_key or settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
        if (
            not raw_key
            or not raw_key.strip()
            or raw_key.strip().startswith("<")
            or raw_key.strip() in ("YOUR_KEY_HERE", "your_groq_api_key_here")
        ):
            raise LLMConfigurationError(
                "Groq API key is not configured. Please set a valid GROQ_API_KEY in backend/.env "
                "or configure a different provider."
            )
        self.api_key = raw_key.strip()
        self.model_name = model_name or settings.GROQ_MODEL or "openai/gpt-oss-20b"
        self._client = groq.Groq(api_key=self.api_key)

    @property
    def provider_name(self) -> str:
        return "groq"

    def extract_event(self, report_text: str) -> Dict[str, Any]:
        """
        Sends the report text to Groq and extracts structured JSON.
        """
        if not report_text or not report_text.strip():
            raise LLMExtractionError("Safety report text cannot be empty.")

        try:
            response = self._client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": EVENT_EXTRACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": report_text}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )

            raw_text = response.choices[0].message.content
            if not raw_text:
                raise LLMExtractionError("Empty response received from Groq model.")

            # Clean potential markdown fences (e.g. ```json ... ```)
            clean_text = raw_text.strip()
            if clean_text.startswith("```"):
                clean_text = re.sub(r"^```(?:json)?\s*", "", clean_text, flags=re.IGNORECASE)
                clean_text = re.sub(r"\s*```$", "", clean_text)

            parsed_data = json.loads(clean_text)
            if not isinstance(parsed_data, dict):
                raise LLMExtractionError(f"Expected JSON object from model, received: {type(parsed_data).__name__}")

            return parsed_data

        except json.JSONDecodeError as jde:
            raise LLMExtractionError(f"Failed to parse Groq output as JSON: {str(jde)}") from jde
        except (LLMExtractionError, LLMConfigurationError, LLMTemporaryUnavailableError):
            raise
        except Exception as exc:
            if is_temporary_availability_error(exc):
                code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
                raise LLMTemporaryUnavailableError(
                    f"Groq service temporarily unavailable: {str(exc)}",
                    status_code=code or 503
                ) from exc
            raise LLMExtractionError(f"Groq API request failed: {str(exc)}") from exc
