"""
Mock LLM Provider for local development, deterministic tests, and offline mode.
Runs without an API key or network access, extracting structured data via heuristics
and allowing precise mock response injection for edge-case unit testing.
"""
import re
from typing import Any, Dict, Optional
from backend.app.services.llm.base import LLMProvider, LLMExtractionError


class MockProvider(LLMProvider):
    """
    Heuristic and configurable mock extractor for PREVENT.
    """

    def __init__(self):
        self._injected_response: Optional[Dict[str, Any]] = None
        self._injected_error: Optional[Exception] = None

    @property
    def provider_name(self) -> str:
        return "mock"

    def set_mock_response(self, response: Dict[str, Any]) -> None:
        """Inject a specific response dictionary for testing."""
        self._injected_response = response

    def set_mock_error(self, error: Exception) -> None:
        """Inject an exception to simulate provider or network failure."""
        self._injected_error = error

    def reset(self) -> None:
        """Reset injected mocks back to default heuristic behavior."""
        self._injected_response = None
        self._injected_error = None

    def extract_event(self, report_text: str) -> Dict[str, Any]:
        """
        Extract structured event fields using injected responses or regex heuristics.
        """
        if self._injected_error is not None:
            raise self._injected_error

        if self._injected_response is not None:
            return dict(self._injected_response)

        text_lower = report_text.lower()

        # 1. Asset ID extraction (e.g. BUS-142, TRK-089)
        asset_match = re.search(r"\b([A-Z]{2,5}-\d{2,5})\b", report_text, re.IGNORECASE)
        asset_id = asset_match.group(1).upper() if asset_match else None

        # 2. Subsystem extraction
        subsystem = "general"
        if any(w in text_lower for w in ["braking", "brake", "brakes", "stopping distance", "distance to stop", "stopping", "stop bar", "caliper", "pedal"]):
            subsystem = "braking"
        elif any(w in text_lower for w in ["steering", "steer", "wheel pull", "alignment", "tie rod"]):
            subsystem = "steering"
        elif any(w in text_lower for w in ["electrical", "battery", "alternator", "wiring", "sensor", "telematics", "voltage"]):
            subsystem = "electrical"
        elif any(w in text_lower for w in ["powertrain", "engine", "transmission", "coolant", "exhaust", "motor"]):
            subsystem = "powertrain"
        elif any(w in text_lower for w in ["suspension", "shock", "strut", "spring", "axle", "bumpy"]):
            subsystem = "suspension"
        elif any(w in text_lower for w in ["doors_body", "door", "doors", "ramp", "wheelchair ramp", "mirror", "body panel"]):
            subsystem = "doors_body"
        elif any(w in text_lower for w in ["hvac", "ac", "air condition", "air-condition", "heat", "heater", "ventilation"]):
            subsystem = "hvac"

        # 3. Event Type normalization
        event_type = "operational_report"
        if any(w in text_lower for w in ["near-miss", "near miss", "close call", "overshot", "overshoot", "avoided collision"]):
            event_type = "near_miss"
        elif any(w in text_lower for w in ["incident", "collision", "crash", "accident", "damage"]):
            event_type = "incident"
        elif any(w in text_lower for w in ["inspection", "audit", "inspector", "spot check", "walkaround"]):
            event_type = "inspection"
        elif any(w in text_lower for w in ["maintenance", "repair", "service", "workshop", "depot inspection"]):
            event_type = "maintenance"
        elif any(w in text_lower for w in ["complaint", "passenger", "transitapp", "rider"]):
            event_type = "complaint"
        elif any(w in text_lower for w in ["violation", "speeding", "red light", "citation"]):
            event_type = "violation"
        elif any(w in text_lower for w in ["driver", "shift", "daily log", "driver report"]):
            event_type = "operational_report"

        # 4. Severity classification (1-5)
        severity = 3
        if any(w in text_lower for w in ["near-miss", "near miss", "failed to stop", "overshot", "emergency", "pedestrian crosswalk"]):
            severity = 5
        elif any(w in text_lower for w in ["significantly more distance", "abnormal", "heavy rain", "severe", "hard depression", "abnormal brake pedal"]):
            severity = 4
        elif any(w in text_lower for w in ["jerky", "unusually", "imbalance", "exceeded", "vibrating"]):
            severity = 3
        elif any(w in text_lower for w in ["minor", "wear threshold", "routine", "slight"]):
            severity = 2

        # 5. Reporter role and source
        reporter_role = "driver"
        source = "driver"
        if any(w in text_lower for w in ["passenger", "rider", "transitapp"]):
            reporter_role = "passenger"
            source = "Passenger Feedback App"
        elif any(w in text_lower for w in ["inspector", "audit", "dot"]):
            reporter_role = "inspector"
            source = "State Transit Safety Inspector"
        elif any(w in text_lower for w in ["technician", "mechanic", "depot", "workshop"]):
            reporter_role = "technician"
            source = "Depot Workshop Log"
        elif any(w in text_lower for w in ["safety officer", "dispatch"]):
            reporter_role = "safety_officer"
            source = "Telematics & Safety Dispatch"
        else:
            reporter_role = "driver"
            source = "driver"

        # 6. Location
        location = None
        location_match = re.search(r"\b(route\s+[A-Za-z0-9\-]+|bay\s+\d+|terminal|staging|crosswalk|[A-Za-z0-9\s\-&]+?(?:ave|street|st|crossing|corridor|depot))\b", report_text, re.IGNORECASE)
        if location_match:
            location = location_match.group(0).strip()
        else:
            prep_match = re.search(r"\b(on|at|near)\s+([A-Za-z0-9\s\-&]{3,35}?)(?=\s+(?:and|during|with|\.|$))", report_text, re.IGNORECASE)
            if prep_match and not any(k in prep_match.group(2).lower() for k in ["bus-", "trk-", "pedal", "distance", "stopping"]):
                location = f"{prep_match.group(1)} {prep_match.group(2)}".strip()


        # 7. Metadata (e.g. weather, road conditions)
        raw_metadata: Dict[str, Any] = {}
        if "heavy rain" in text_lower:
            raw_metadata["weather"] = "heavy rain"
        elif "light rain" in text_lower:
            raw_metadata["weather"] = "light rain"
        elif "rain" in text_lower:
            raw_metadata["weather"] = "rain"
        elif "snow" in text_lower:
            raw_metadata["weather"] = "snow"

        # 8. Description narrative
        # Clean, concise narrative
        description = report_text.strip()
        if "driver reported that" in text_lower:
            clean_desc = re.sub(r"^driver reported that\s*", "", report_text, flags=re.IGNORECASE).strip()
            description = clean_desc[0].upper() + clean_desc[1:] if clean_desc else report_text

        return {
            "asset_id": asset_id,
            "event_type": event_type,
            "subsystem": subsystem,
            "severity": severity,
            "description": description,
            "source": source,
            "reporter_role": reporter_role,
            "location": location,
            "raw_metadata": raw_metadata if raw_metadata else None
        }
