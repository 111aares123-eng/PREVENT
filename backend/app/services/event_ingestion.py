"""
Service layer for AI Event Ingestion and Persistence.
Coordinates:
1. LLM-based event extraction (Gemini / Mock)
2. Pydantic schema validation
3. Database persistence of confirmed events
4. Recalculation of asset risk via PREVENT's deterministic RiskEngine
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import ValidationError
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.models.risk_assessment import RiskAssessment
from backend.app.schemas.event import (
    EventCreate,
    EventResponse,
    ExtractedEventData,
    EventExtractResponse,
    EventIngestionResponse
)
from backend.app.core.config import settings
from backend.app.services.llm import (
    LLMProvider,
    MockProvider,
    get_llm_provider,
    is_temporary_availability_error
)
from backend.app.services.risk_engine import RiskEngine


class EventIngestionService:
    """Coordinates structured AI extraction, validation, and confirmed event persistence."""

    def __init__(self, default_provider: Optional[LLMProvider] = None):
        self._default_provider = default_provider

    def get_provider(self) -> LLMProvider:
        """Resolve LLM provider."""
        return self._default_provider or get_llm_provider()

    def extract_from_report(
        self,
        report_text: str,
        asset_id: Optional[str] = None,
        db: Optional[Session] = None,
        provider: Optional[LLMProvider] = None
    ) -> EventExtractResponse:
        """
        Extracts structured safety event data from an unstructured text report.
        Strictly validates output using Pydantic. Does NOT mutate the database.
        If authoritative asset_id is provided by caller, it is injected before validation.
        """
        try:
            active_provider = provider or self.get_provider()
            provider_name = active_provider.provider_name
        except Exception as exc:
            return EventExtractResponse(
                extracted_event=None,
                provider=getattr(settings, "LLM_PRIMARY", getattr(settings, "LLM_PROVIDER", "groq")),
                validation_status="invalid",
                validation_errors=[f"AI extraction unavailable: {str(exc)}"],
                raw_extraction=None,
                fallback_used=False,
                fallback_message=None
            )

        fallback_used = False
        fallback_message: Optional[str] = None

        try:
            if hasattr(active_provider, "extract_with_fallback"):
                raw_data, provider_name, fallback_used, fallback_message = active_provider.extract_with_fallback(report_text)
            else:
                raw_data = active_provider.extract_event(report_text)
        except Exception as exc:
            # Check if temporary provider availability failure (e.g. HTTP 429, 503, 500, UNAVAILABLE) and active provider is not mock
            if provider_name != "mock" and is_temporary_availability_error(exc):
                failed_provider = provider_name
                try:
                    mock_fallback = MockProvider()
                    raw_data = mock_fallback.extract_event(report_text)
                    provider_name = mock_fallback.provider_name  # "mock"
                    fallback_used = True
                    fallback_message = f"{failed_provider.title()} temporarily unavailable — using local fallback."
                except Exception as fallback_exc:
                    return EventExtractResponse(
                        extracted_event=None,
                        provider="mock",
                        validation_status="invalid",
                        validation_errors=[f"AI extraction fallback failed: {str(fallback_exc)}"],
                        raw_extraction=None,
                        fallback_used=True,
                        fallback_message=f"{failed_provider.title()} temporarily unavailable — using local fallback."
                    )
            else:
                return EventExtractResponse(
                    extracted_event=None,
                    provider=provider_name,
                    validation_status="invalid",
                    validation_errors=[f"AI extraction failed: {str(exc)}"],
                    raw_extraction=None,
                    fallback_used=False,
                    fallback_message=None
                )

        if not isinstance(raw_data, dict):
            return EventExtractResponse(
                extracted_event=None,
                provider=provider_name,
                validation_status="invalid",
                validation_errors=["Provider returned non-dictionary output."],
                raw_extraction=None,
                fallback_used=fallback_used,
                fallback_message=fallback_message
            )

        # Inject / override authoritative asset_id before Pydantic validation if provided
        if asset_id and asset_id.strip():
            raw_data["asset_id"] = asset_id.strip().upper()

        # Validate structured fields through Pydantic
        try:
            validated_event = ExtractedEventData.model_validate(raw_data)
        except ValidationError as val_err:
            error_details = []
            for err in val_err.errors():
                loc = " -> ".join(str(p) for p in err.get("loc", []))
                msg = err.get("msg", "Validation error")
                error_details.append(f"{loc}: {msg}" if loc else msg)

            return EventExtractResponse(
                extracted_event=None,
                provider=provider_name,
                validation_status="invalid",
                validation_errors=error_details,
                raw_extraction=raw_data,
                fallback_used=fallback_used,
                fallback_message=fallback_message
            )

        # Optional database asset check if db session provided
        validation_errors: List[str] = []
        if db is not None:
            asset = db.query(Asset).filter(Asset.asset_id == validated_event.asset_id).first()
            if not asset:
                validation_errors.append(
                    f"Asset '{validated_event.asset_id}' is not registered in the fleet database."
                )

        if validation_errors:
            return EventExtractResponse(
                extracted_event=validated_event,
                provider=provider_name,
                validation_status="invalid",
                validation_errors=validation_errors,
                raw_extraction=raw_data,
                fallback_used=fallback_used,
                fallback_message=fallback_message
            )

        return EventExtractResponse(
            extracted_event=validated_event,
            provider=provider_name,
            validation_status="valid",
            validation_errors=None,
            raw_extraction=raw_data,
            fallback_used=fallback_used,
            fallback_message=fallback_message
        )

    def ingest_confirmed_event(
        self,
        event_in: EventCreate,
        db: Session,
        risk_engine: RiskEngine
    ) -> EventIngestionResponse:
        """
        Persists a validated structured event to the database and recalculates
        the asset's explainable risk score using PREVENT's deterministic engine.
        """
        asset = db.query(Asset).filter(Asset.asset_id == event_in.asset_id).first()
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset with ID '{event_in.asset_id}' was not found in the fleet database."
            )

        # 1. Evaluate baseline risk before adding new event
        previous_assessment = risk_engine.evaluate_asset(asset, asset.events)

        # Determine effective event timestamp (if not supplied, the report is stamped with current UTC,
        # the same clock the risk engine evaluates on and the same value the UI form sends)
        if event_in.timestamp is not None:
            effective_timestamp = event_in.timestamp
            if effective_timestamp.tzinfo is None:
                effective_timestamp = effective_timestamp.replace(tzinfo=timezone.utc)
        else:
            effective_timestamp = datetime.now(timezone.utc)

        # 2. Persist new Event to database
        db_event = Event(
            id=str(uuid.uuid4()),
            asset_id=event_in.asset_id,
            timestamp=effective_timestamp,
            event_type=event_in.event_type.value if hasattr(event_in.event_type, "value") else str(event_in.event_type),
            subsystem=event_in.subsystem.value if hasattr(event_in.subsystem, "value") else str(event_in.subsystem),
            severity=event_in.severity,
            description=event_in.description,
            source=event_in.source,
            reporter_role=event_in.reporter_role,
            location=event_in.location,
            is_simulated=False,
            raw_metadata=event_in.raw_metadata
        )
        db.add(db_event)
        db.commit()
        db.refresh(db_event)
        db.refresh(asset)

        # 3. Recalculate risk using PREVENT's existing deterministic risk engine
        updated_assessment = risk_engine.evaluate_asset(asset, asset.events)

        # 4. Persist updated risk snapshot
        db_assessment = RiskAssessment(
            id=str(uuid.uuid4()),
            asset_id=asset.asset_id,
            computed_at=updated_assessment.computed_at,
            score=updated_assessment.score,
            confidence=updated_assessment.confidence,
            risk_level=updated_assessment.risk_level,
            trend=updated_assessment.trend,
            primary_subsystem=updated_assessment.primary_subsystem,
            factor_breakdown=updated_assessment.factor_breakdown,
            confidence_breakdown=updated_assessment.confidence_breakdown,
            contributing_event_ids=updated_assessment.contributing_event_ids,
            recommended_action=updated_assessment.recommended_action,
            explanation_narrative=updated_assessment.explanation_narrative
        )
        db.add(db_assessment)
        db.commit()

        # 5. Compute factor deltas and explanation of change
        risk_score_delta = round(updated_assessment.score - previous_assessment.score, 1)
        confidence_delta = round(updated_assessment.confidence - previous_assessment.confidence, 1)

        factor_deltas: Dict[str, float] = {}
        why_risk_changed: List[str] = []

        for key, updated_val in updated_assessment.factor_breakdown.items():
            prev_val = previous_assessment.factor_breakdown.get(key, 0.0)
            diff = round(updated_val - prev_val, 2)
            factor_deltas[key] = diff
            if abs(diff) > 0.1:
                label = key.replace("_", " ").title()
                sign = "+" if diff > 0 else ""
                why_risk_changed.append(f"{label}: {sign}{diff:.1f} pts ({prev_val:.1f} → {updated_val:.1f})")

        if updated_assessment.trend != previous_assessment.trend:
            why_risk_changed.append(f"Trend vector shifted from {previous_assessment.trend} to {updated_assessment.trend}")

        if not why_risk_changed:
            why_risk_changed.append(f"Event added to timeline with severity {event_in.severity} on {event_in.subsystem.value} subsystem.")

        return EventIngestionResponse(
            event=EventResponse.model_validate(db_event),
            asset_id=asset.asset_id,
            previous_risk_score=previous_assessment.score,
            updated_risk_score=updated_assessment.score,
            risk_score_delta=risk_score_delta,
            previous_risk_level=previous_assessment.risk_level,
            updated_risk_level=updated_assessment.risk_level,
            previous_confidence=previous_assessment.confidence,
            updated_confidence=updated_assessment.confidence,
            confidence_delta=confidence_delta,
            factor_breakdown=updated_assessment.factor_breakdown,
            factor_breakdown_delta=factor_deltas,
            explanation_narrative=updated_assessment.explanation_narrative,
            why_risk_changed=why_risk_changed
        )
