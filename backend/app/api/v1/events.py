"""
Safety event ingestion and AI extraction endpoints.
Coordinates structured AI extraction preview and confirmed event persistence.
"""
from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.app.api.deps import (
    get_db,
    get_risk_engine,
    get_llm_provider,
    get_event_ingestion_service
)
from backend.app.schemas.event import (
    EventCreate,
    EventExtractRequest,
    EventExtractResponse,
    EventIngestionResponse
)
from backend.app.services.event_ingestion import EventIngestionService
from backend.app.services.llm import LLMProvider
from backend.app.services.llm import LLMProvider
from backend.app.services.risk_engine import RiskEngine

router = APIRouter(prefix="/events", tags=["Event Ingestion"])


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
        db=db,
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
