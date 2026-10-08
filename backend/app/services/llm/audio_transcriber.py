"""
Audio transcription service for PREVENT.
Provides multi-tier transcription with provider fallback:
  1. Primary: Groq Whisper (whisper-large-v3)
  2. Secondary: Google Gemini (gemini-2.5-flash multimodal)
  3. Final Fallback: MockAudioTranscriber for deterministic offline testing
"""
import io
import logging
import os
import re
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple

from backend.app.core.config import settings
from backend.app.services.llm.base import (
    LLMProviderError,
    LLMConfigurationError,
    LLMExtractionError,
    LLMTemporaryUnavailableError,
    is_temporary_availability_error,
)

logger = logging.getLogger(__name__)


class AudioTranscriber(ABC):
    """Abstract base class for audio transcription providers in PREVENT."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Identifier for the transcription provider (e.g. 'groq', 'gemini', 'mock')."""
        pass

    @abstractmethod
    def transcribe(
        self,
        audio_bytes: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribes audio bytes to text.

        Returns:
            Dict containing:
                "transcript": str (the verbatim spoken text)
                "detected_language": Optional[str] (e.g. "en", "ta", "hi", "ta-Latn", "hi-Latn")
                "provider": str (transcription provider name)
        """
        pass


class GroqAudioTranscriber(AudioTranscriber):
    """
    Audio transcription via Groq Whisper API (whisper-large-v3).
    High-accuracy, ultra-fast speech-to-text.
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
                "Groq API key is not configured for audio transcription. "
                "Please set GROQ_API_KEY in backend/.env or configure a different provider."
            )
        self.api_key = raw_key.strip()
        self.model_name = (
            model_name
            or getattr(settings, "GROQ_AUDIO_MODEL", None)
            or "whisper-large-v3"
        )
        import groq
        self._client = groq.Groq(api_key=self.api_key)

    @property
    def provider_name(self) -> str:
        return "groq"

    def transcribe(
        self,
        audio_bytes: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        if not audio_bytes:
            raise LLMExtractionError("Audio file is empty.")

        fn = filename or "audio.webm"
        ct = content_type or "audio/webm"
        file_tuple = (fn, audio_bytes, ct)

        try:
            response = self._client.audio.transcriptions.create(
                model=self.model_name,
                file=file_tuple,
                response_format="verbose_json"
            )

            transcript = getattr(response, "text", "") or ""
            language = getattr(response, "language", None)

            return {
                "transcript": transcript.strip(),
                "detected_language": language,
                "provider": self.provider_name
            }
        except (LLMExtractionError, LLMConfigurationError, LLMTemporaryUnavailableError):
            raise
        except Exception as exc:
            if is_temporary_availability_error(exc):
                code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
                raise LLMTemporaryUnavailableError(
                    f"Groq Whisper temporarily unavailable: {str(exc)}",
                    status_code=code or 503
                ) from exc
            raise LLMExtractionError(f"Groq Whisper transcription failed: {str(exc)}") from exc


class GeminiAudioTranscriber(AudioTranscriber):
    """
    Audio transcription via Google Gemini Multimodal API.
    Used as high-reliability secondary transcriber.
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
                "Gemini API key is not configured for audio transcription. "
                "Please set GEMINI_API_KEY in backend/.env or configure a different provider."
            )
        self.api_key = raw_key.strip()
        self.model_name = (
            model_name
            or getattr(settings, "GEMINI_AUDIO_MODEL", None)
            or getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")
        )
        from google import genai
        self._client = genai.Client(api_key=self.api_key)

    @property
    def provider_name(self) -> str:
        return "gemini"

    def transcribe(
        self,
        audio_bytes: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        if not audio_bytes:
            raise LLMExtractionError("Audio file is empty.")

        from google.genai import types

        ct = content_type or "audio/webm"
        if ct == "audio/x-wav":
            ct = "audio/wav"

        part = types.Part.from_bytes(data=audio_bytes, mime_type=ct)
        prompt = (
            "Transcribe this safety audio report accurately in its original spoken language "
            "(English, Tamil, Hindi, Tanglish, or Hinglish). Output ONLY the verbatim transcript, "
            "without any commentary, preamble, or markdown formatting."
        )

        try:
            response = self._client.models.generate_content(
                model=self.model_name,
                contents=[part, prompt],
                config=types.GenerateContentConfig(
                    temperature=0.1
                )
            )

            raw_text = response.text or ""
            transcript = raw_text.strip()
            # Remove enclosing markdown or quotes if present
            if transcript.startswith('"') and transcript.endswith('"'):
                transcript = transcript[1:-1].strip()

            return {
                "transcript": transcript,
                "detected_language": None,
                "provider": self.provider_name
            }
        except (LLMExtractionError, LLMConfigurationError, LLMTemporaryUnavailableError):
            raise
        except Exception as exc:
            if is_temporary_availability_error(exc):
                code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
                raise LLMTemporaryUnavailableError(
                    f"Gemini Audio temporarily unavailable: {str(exc)}",
                    status_code=code or 503
                ) from exc
            raise LLMExtractionError(f"Gemini Audio transcription failed: {str(exc)}") from exc


class MockAudioTranscriber(AudioTranscriber):
    """
    Deterministic mock audio transcriber for local development, offline mode,
    and automated testing. Requires zero network access or API credentials.
    """

    REPRESENTATIVE_TRANSCRIPTS = {
        "english": "The brake pedal became very hard during operation.",
        "tamil": "பிரேக் பெடல் மிகவும் கடினமாக இருந்தது",
        "hindi": "ब्रेक पेडल बहुत सख्त हो गया था",
        "tanglish": "brake romba hard-ah irundhuchu",
        "hinglish": "brake pedal bohot hard ho gaya tha",
    }

    def __init__(self):
        self._injected_transcript: Optional[str] = None
        self._injected_language: Optional[str] = None
        self._injected_error: Optional[Exception] = None

    @property
    def provider_name(self) -> str:
        return "mock"

    def set_mock_transcript(self, transcript: str, detected_language: Optional[str] = None) -> None:
        """Inject specific transcript for unit tests."""
        self._injected_transcript = transcript
        self._injected_language = detected_language

    def set_mock_error(self, error: Exception) -> None:
        """Simulate transcriber error for testing failure handling."""
        self._injected_error = error

    def reset(self) -> None:
        """Reset mock injection state."""
        self._injected_transcript = None
        self._injected_language = None
        self._injected_error = None

    def transcribe(
        self,
        audio_bytes: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        if self._injected_error is not None:
            raise self._injected_error

        if self._injected_transcript is not None:
            return {
                "transcript": self._injected_transcript,
                "detected_language": self._injected_language,
                "provider": self.provider_name
            }

        if not audio_bytes:
            raise LLMExtractionError("Audio file is empty.")

        # Deterministic identification via filename cues or audio content markers
        combined_ref = ((filename or "") + " ").lower()
        try:
            decoded_text = audio_bytes.decode("utf-8", errors="ignore")
            combined_ref += decoded_text.lower()
        except Exception:
            pass

        if "tamil" in combined_ref or "தமிழ்" in combined_ref or " ta " in f" {combined_ref} ":
            return {
                "transcript": self.REPRESENTATIVE_TRANSCRIPTS["tamil"],
                "detected_language": "ta",
                "provider": self.provider_name
            }
        elif "tanglish" in combined_ref or "ta-latn" in combined_ref:
            return {
                "transcript": self.REPRESENTATIVE_TRANSCRIPTS["tanglish"],
                "detected_language": "ta-Latn",
                "provider": self.provider_name
            }
        elif "hindi" in combined_ref or "हिन्दी" in combined_ref or " hi " in f" {combined_ref} ":
            return {
                "transcript": self.REPRESENTATIVE_TRANSCRIPTS["hindi"],
                "detected_language": "hi",
                "provider": self.provider_name
            }
        elif "hinglish" in combined_ref or "hi-latn" in combined_ref:
            return {
                "transcript": self.REPRESENTATIVE_TRANSCRIPTS["hinglish"],
                "detected_language": "hi-Latn",
                "provider": self.provider_name
            }
        elif "transcript:" in combined_ref or "custom:" in combined_ref:
            match = re.search(r"(?:transcript|custom):\s*(.+)", combined_ref, re.DOTALL)
            custom_text = match.group(1).strip() if match else self.REPRESENTATIVE_TRANSCRIPTS["english"]
            return {
                "transcript": custom_text,
                "detected_language": None,
                "provider": self.provider_name
            }
        else:
            return {
                "transcript": self.REPRESENTATIVE_TRANSCRIPTS["english"],
                "detected_language": "en",
                "provider": self.provider_name
            }


class AudioTranscriptionRouter(AudioTranscriber):
    """
    Multi-tier Audio Transcription Router with graceful controlled fallbacks:
      1. Primary: Groq Whisper
      2. Secondary: Gemini Audio
      3. Final Fallback: MockAudioTranscriber
    """

    def __init__(
        self,
        primary_transcriber: Optional[AudioTranscriber] = None,
        secondary_transcriber: Optional[AudioTranscriber] = None,
        fallback_transcriber: Optional[AudioTranscriber] = None,
    ):
        self._explicit_primary = primary_transcriber
        self._explicit_secondary = secondary_transcriber
        self._explicit_fallback = fallback_transcriber

    @property
    def provider_name(self) -> str:
        return "audio_router"

    def _resolve_transcriber(self, name: str) -> AudioTranscriber:
        name_clean = (name or "").lower().strip()
        if name_clean == "groq":
            return GroqAudioTranscriber()
        elif name_clean == "gemini":
            return GeminiAudioTranscriber()
        elif name_clean == "mock":
            return MockAudioTranscriber()
        else:
            raise LLMConfigurationError(f"Unsupported audio transcriber: '{name}'")

    def get_primary(self) -> AudioTranscriber:
        if self._explicit_primary is not None:
            return self._explicit_primary
        primary_name = getattr(settings, "LLM_PRIMARY", "groq")
        return self._resolve_transcriber(primary_name)

    def get_secondary(self) -> AudioTranscriber:
        if self._explicit_secondary is not None:
            return self._explicit_secondary
        secondary_name = getattr(settings, "LLM_SECONDARY", "gemini")
        return self._resolve_transcriber(secondary_name)

    def get_fallback(self) -> AudioTranscriber:
        if self._explicit_fallback is not None:
            return self._explicit_fallback
        fallback_name = getattr(settings, "LLM_FALLBACK", "mock")
        return self._resolve_transcriber(fallback_name)

    def transcribe_with_fallback(
        self,
        audio_bytes: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> Tuple[Dict[str, Any], bool, Optional[str]]:
        """
        Executes multi-tier transcription following:
          Primary (Groq Whisper) -> Secondary (Gemini Audio) -> Final Fallback (Mock)

        Returns:
          Tuple of (result_dict, fallback_used, fallback_message)
        """
        primary = self.get_primary()
        primary_name = primary.provider_name

        # --- Tier 1: Try Primary Provider (Groq Whisper) ---
        try:
            result = primary.transcribe(audio_bytes, filename=filename, content_type=content_type)
            return result, False, None
        except Exception as primary_exc:
            if not is_temporary_availability_error(primary_exc):
                # Permanent error (auth failure, missing key, bad audio, etc.) -> DO NOT silently fall back
                raise primary_exc

            logger.warning(
                "Primary audio transcriber '%s' failed with temporary availability error: %s. Attempting secondary transcriber.",
                primary_name,
                primary_exc
            )

        # --- Tier 2: Try Secondary Provider (Gemini Audio) ---
        secondary = self.get_secondary()
        secondary_name = secondary.provider_name

        try:
            result = secondary.transcribe(audio_bytes, filename=filename, content_type=content_type)
            fallback_msg = f"{primary_name.title()} Whisper temporarily unavailable — using {secondary_name.title()} audio transcriber."
            return result, True, fallback_msg
        except Exception as secondary_exc:
            if not is_temporary_availability_error(secondary_exc):
                # Permanent error on secondary provider -> DO NOT silently fall back
                raise secondary_exc

            logger.warning(
                "Secondary audio transcriber '%s' failed with temporary availability error: %s. Attempting final fallback.",
                secondary_name,
                secondary_exc
            )

        # --- Tier 3: Try Final Fallback Provider (MockAudioTranscriber) ---
        fallback = self.get_fallback()
        fallback_name = fallback.provider_name

        try:
            result = fallback.transcribe(audio_bytes, filename=filename, content_type=content_type)
            fallback_msg = "Hosted audio transcription temporarily unavailable — using local fallback."
            return result, True, fallback_msg
        except Exception as fallback_exc:
            raise LLMExtractionError(
                f"All audio transcription providers failed including final fallback: {str(fallback_exc)}"
            ) from fallback_exc

    def transcribe(
        self,
        audio_bytes: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        result, _, _ = self.transcribe_with_fallback(audio_bytes, filename=filename, content_type=content_type)
        return result


def get_audio_transcriber(provider_type: Optional[str] = None) -> AudioTranscriber:
    """
    Factory resolving the active audio transcriber from settings or explicit argument.
    Defaults to AudioTranscriptionRouter (Groq Whisper -> Gemini Audio -> Mock) unless overridden.
    """
    selected = (provider_type or settings.LLM_PROVIDER or "router").lower()

    if selected in ("router", "auto"):
        return AudioTranscriptionRouter()
    elif selected == "groq":
        return GroqAudioTranscriber()
    elif selected == "gemini":
        return GeminiAudioTranscriber()
    elif selected == "mock":
        return MockAudioTranscriber()
    else:
        raise LLMConfigurationError(
            f"Unsupported audio transcriber: '{selected}'. Supported: 'router', 'groq', 'gemini', 'mock'"
        )
