"""
Google Gemini LLM Provider for PREVENT event extraction.
Uses official google-genai SDK with structured JSON output mode.
"""
import json
import os
import re
from typing import Any, Dict, Optional
from google import genai
from google.genai import types

from backend.app.core.config import settings
from backend.app.services.llm.base import (
    LLMProvider,
    LLMConfigurationError,
    LLMExtractionError,
    LLMTemporaryUnavailableError,
    is_temporary_availability_error
)
from backend.app.services.llm.prompts import EVENT_EXTRACTION_SYSTEM_PROMPT


class GeminiProvider(LLMProvider):
    """
    Gemini extraction provider using the official Google GenAI SDK.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None
    ):
        raw_key = api_key or settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        if (
            not raw_key
            or not raw_key.strip()
            or raw_key.strip().startswith("<")
            or raw_key.strip() in ("YOUR_KEY_HERE", "your_gemini_api_key_here")
        ):
            raise LLMConfigurationError(
                "Gemini API key is not configured. Please set a valid GEMINI_API_KEY in backend/.env "
                "or switch LLM_PROVIDER to 'mock'."
            )
        self.api_key = raw_key.strip()
        
        self.model_name = model_name or settings.GEMINI_MODEL or "gemini-2.5-flash"
        self._client = genai.Client(api_key=self.api_key)

    @property
    def provider_name(self) -> str:
        return "gemini"

    def extract_event(self, report_text: str) -> Dict[str, Any]:
        """
        Sends the report text to Gemini and extracts structured JSON.
        """
        if not report_text or not report_text.strip():
            raise LLMExtractionError("Safety report text cannot be empty.")

        try:
            response = self._client.models.generate_content(
                model=self.model_name,
                contents=report_text,
                config=types.GenerateContentConfig(
                    system_instruction=EVENT_EXTRACTION_SYSTEM_PROMPT,
                    temperature=0.1,
                    response_mime_type="application/json"
                )
            )

            raw_text = response.text
            if not raw_text:
                raise LLMExtractionError("Empty response received from Gemini model.")

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
            raise LLMExtractionError(f"Failed to parse Gemini output as JSON: {str(jde)}") from jde
        except (LLMExtractionError, LLMConfigurationError, LLMTemporaryUnavailableError):
            raise
        except Exception as exc:
            if is_temporary_availability_error(exc):
                code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
                raise LLMTemporaryUnavailableError(
                    f"Gemini service temporarily unavailable: {str(exc)}",
                    status_code=code or 503
                ) from exc
            raise LLMExtractionError(f"Gemini API request failed: {str(exc)}") from exc
