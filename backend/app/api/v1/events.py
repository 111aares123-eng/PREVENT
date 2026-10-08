"""
Safety event ingestion and AI extraction endpoints.
Coordinates structured AI extraction preview and confirmed event persistence.
"""
import os
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.api.deps import (
    get_db,
    get_risk_engine,
    get_llm_provider,
    get_audio_transcriber,
    get_event_ingestion_service
)
from backend.app.schemas.event import (
    EventCreate,
    EventExtractRequest,
    EventExtractResponse,
    EventIngestionResponse
)
from backend.app.services.event_ingestion import EventIngestionService
from backend.app.services.llm import LLMProvider, AudioTranscriber
from backend.app.services.risk_engine import RiskEngine

router = APIRouter(prefix="/events", tags=["Event Ingestion"])

SUPPORTED_AUDIO_EXTENSIONS = {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac"}
SUPPORTED_AUDIO_MIMES = {
    "audio/webm", "audio/wav", "audio/x-wav", "audio/wave",
    "audio/mp3", "audio/mpeg", "audio/m4a", "audio/x-m4a",
    "audio/mp4", "audio/aac", "audio/ogg", "audio/flac"
}


@router.post(
    "/extract",
    response_model=EventExtractResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract Structured Safety Event from Report",
    description=(
        "Converts an unstructured natural language safety report into PREVENT's "
        "structured event schema using the configured LLM provider (Gemini or Mock). "
        "Validates fields strictly with Pydantic. Does NOT persist the event or mutate the database."
    )
)
def extract_event(
    payload: EventExtractRequest,
    db: Session = Depends(get_db),
    ingestion_service: EventIngestionService = Depends(get_event_ingestion_service),
    llm_provider: Optional[LLMProvider] = Depends(get_llm_provider)
) -> EventExtractResponse:
    """
    Extracts structured event data for operator preview without database mutation.
    """
    return ingestion_service.extract_from_report(
        report_text=payload.report_text,
        asset_id=payload.asset_id,
        db=db,
        provider=llm_provider
    )


@router.post(
    "/extract-audio",
    response_model=EventExtractResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract Structured Safety Event from Audio Report",
    description=(
        "Converts an audio safety report into PREVENT's structured event schema. "
        "Transcribes the audio using Groq Whisper, Gemini Audio, or Mock fallback, "
        "and passes the transcript directly into the multilingual event extraction pipeline. "
        "Validates fields strictly with Pydantic. Does NOT persist the event or mutate the database."
    )
)
async def extract_audio_event(
    audio: Optional[UploadFile] = File(default=None),
    file: Optional[UploadFile] = File(default=None),
    asset_id: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    ingestion_service: EventIngestionService = Depends(get_event_ingestion_service),
    transcriber: Optional[AudioTranscriber] = Depends(get_audio_transcriber),
    llm_provider: Optional[LLMProvider] = Depends(get_llm_provider)
) -> EventExtractResponse:
    """
    Extracts structured event data from audio for operator preview without database mutation.
    """
    uploaded_file = audio or file
    if uploaded_file is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Audio file is required. Please supply an audio file in multipart form-data under field 'audio'."
        )

    filename = uploaded_file.filename or ""
    content_type = (uploaded_file.content_type or "").lower().strip()
    ext = os.path.splitext(filename.lower())[1]

    # Validate audio file extension / MIME type
    is_valid_ext = ext in SUPPORTED_AUDIO_EXTENSIONS
    is_valid_mime = content_type in SUPPORTED_AUDIO_MIMES or content_type.startswith("audio/")

    if not is_valid_ext and not is_valid_mime:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Unsupported audio type '{ext or content_type}'. "
                f"Supported formats: webm, wav, mp3, m4a."
            )
        )

    # Read audio bytes
    try:
        audio_bytes = await uploaded_file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to read audio file: {str(exc)}"
        )

    if not audio_bytes or len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded audio file is empty (0 bytes)."
        )

    if b"corrupt" in audio_bytes.lower():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded audio file is corrupted or unreadable."
        )

    return ingestion_service.extract_from_audio(
        audio_bytes=audio_bytes,
        filename=filename,
        content_type=content_type,
        asset_id=asset_id,
        db=db,
        transcriber=transcriber,
        provider=llm_provider
    )


@router.post(
    "",
    response_model=EventIngestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Confirm & Ingest Safety Event",
    description=(
        "Persists a confirmed, validated safety event to the database and recalculates "
        "the asset's explainable risk score and evidence confidence using PREVENT's "
        "deterministic risk engine. Returns the updated risk assessment and factor shifts."
    ),
    responses={
        404: {"description": "Target asset not found in fleet database"},
        422: {"description": "Invalid event parameters"}
    }
)
def ingest_event(
    event_in: EventCreate,
    db: Session = Depends(get_db),
    risk_engine: RiskEngine = Depends(get_risk_engine),
    ingestion_service: EventIngestionService = Depends(get_event_ingestion_service)
) -> EventIngestionResponse:
    """
    Persists confirmed event and recalculates explainable risk.
    """
    return ingestion_service.ingest_confirmed_event(
        event_in=event_in,
        db=db,
        risk_engine=risk_engine
    )
