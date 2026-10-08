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
        braking_keywords = [
            # English
            "braking", "brake", "brakes", "stopping distance", "distance to stop", "stopping", "stop bar", "caliper", "pedal",
            "emergency stop", "emergency braking", "failed to stop", "overshot", "overshoot",
            # Tamil script
            "பிரேக்", "பிரேக்கு", "பிரேக்கிங்", "நிறுத்த", "நிறுத்தும் தூரம்", "காலிபர்", "பெடல்",
            # Tanglish
            "brek", "berek", "stop panna",
            # Hindi Devanagari
            "ब्रेक", "ब्रेकिंग", "रुकने", "दूरी", "कैलिपर", "पेडल", "पैडल",
            # Hinglish
            "rukne me", "rukne mein"
        ]
        steering_keywords = [
            "steering", "steer", "wheel pull", "alignment", "tie rod",
            "ஸ்டீயரிங்", "திசைதிருப்பி", "இழுக்கிறது",
            "स्टीयरिंग", "खिंचाव"
        ]
        electrical_keywords = [
            "electrical", "battery", "alternator", "wiring", "sensor", "telematics", "voltage",
            "மின்சாரம்", "பேட்டரி", "बैटरी", "बिजली"
        ]
        powertrain_keywords = [
            "powertrain", "engine", "transmission", "coolant", "exhaust", "motor",
            "என்ஜின்", "இன்ஜின்", "इंजन"
        ]
        suspension_keywords = [
            "suspension", "shock", "strut", "spring", "axle", "bumpy",
            "சஸ்பென்ஷன்", "सस्पेंशन"
        ]
        doors_body_keywords = [
            "doors_body", "door", "doors", "ramp", "wheelchair ramp", "mirror", "body panel",
            "கதவு", "கதவுகள்", "दरवाजा", "दरवाजे"
        ]
        hvac_keywords = [
            "hvac", "ac", "air condition", "air-condition", "heat", "heater", "ventilation",
            "ஏசி", "ஹீட்டர்", "एसी"
        ]

        if any(w in text_lower for w in braking_keywords):
            subsystem = "braking"
        elif any(w in text_lower for w in steering_keywords):
            subsystem = "steering"
        elif any(w in text_lower for w in electrical_keywords):
            subsystem = "electrical"
        elif any(w in text_lower for w in powertrain_keywords):
            subsystem = "powertrain"
        elif any(w in text_lower for w in suspension_keywords):
            subsystem = "suspension"
        elif any(w in text_lower for w in doors_body_keywords):
            subsystem = "doors_body"
        elif any(w in text_lower for w in hvac_keywords):
            subsystem = "hvac"

        # 3. Event Type normalization
        event_type = "operational_report"
        near_miss_keywords = [
            "near-miss", "near miss", "close call", "overshot", "overshoot", "avoided collision",
            "மோதல் தவிர்ப்பு", "நூல் இழையில்", "சிக்னல் தாண்டியது", "தாண்டியது", "signal thandiruchu", "thappichadhu",
            "बाल-बाल बचे", "टक्कर से बचे", "रेड लाइट पार", "सिग्नल पार", "takkar se bache", "takkar hote hote"
        ]
        incident_keywords = [
            "incident", "collision", "crash", "accident", "damage",
            "விபத்து", "மோதல்", "சேதம்",
            "दुर्घटना", "टक्कर", "हादसा", "एक्सीडेंट"
        ]
        inspection_keywords = [
            "inspection", "audit", "inspector", "spot check", "walkaround",
            "ஆய்வு", "தணிக்கை", "ஆய்வாளர்",
            "निरीक्षण", "जांच", "ऑडिट"
        ]
        corrective_action_keywords = [
            "corrective action", "repaired", "pads replaced", "fix completed",
            "பழுது நீக்கப்பட்டது", "சரிசெய்யப்பட்டது",
            "ठीक किया गया", "सुधार किया गया"
        ]
        maintenance_keywords = [
            "maintenance", "repair", "service", "workshop", "depot inspection", "replaced",
            "பராமரிப்பு", "பழுதுபார்ப்பு", "மாற்றப்பட்டது", "ஒர்க்‌ஷாப்",
            "मरम्मत", "सर्विस", "मेंटेनेंस", "बदला गया"
        ]
        complaint_keywords = [
            "complaint", "passenger", "transitapp", "rider",
            "புகார்", "பயணி", "பயணிகள்",
            "शिकायत", "यात्री", "सवारी"
        ]
        violation_keywords = [
            "violation", "speeding", "red light", "citation",
            "விதிமீறல்", "उल्लंघन"
        ]
        operational_report_keywords = [
            "driver", "shift", "daily log", "driver report", "in-service",
            "ஓட்டுநர்", "டிரைவர்", "चालक", "ड्राइवर"
        ]

        if any(w in text_lower for w in near_miss_keywords):
            event_type = "near_miss"
        elif any(w in text_lower for w in incident_keywords):
            event_type = "incident"
        elif any(w in text_lower for w in corrective_action_keywords):
            event_type = "corrective_action"
        elif any(w in text_lower for w in inspection_keywords):
            event_type = "inspection"
        elif any(w in text_lower for w in maintenance_keywords):
            event_type = "maintenance"
        elif any(w in text_lower for w in complaint_keywords):
            event_type = "complaint"
        elif any(w in text_lower for w in violation_keywords):
            event_type = "violation"
        elif any(w in text_lower for w in operational_report_keywords):
            event_type = "operational_report"

        # 4. Severity classification (1-5)
        severity = 3
        sev5_keywords = [
            "near-miss", "near miss", "failed to stop", "overshot", "emergency", "pedestrian crosswalk",
            "மோதல் தவிர்ப்பு", "விபத்து", "நூல் இழையில் தப்பியது", "நிறுத்த முடியவில்லை", "ரெட் சிக்னல் தாண்டியது",
            "signal thandiruchu", "stop panna mudiyala",
            "बाल-बाल बचे", "दुर्घटना", "टक्कर", "गाड़ी नहीं रुकी", "रेड लाइट पार",
            "takkar hote hote", "gaadi nahi ruki"
        ]
        sev4_keywords = [
            "significantly more distance", "abnormal", "heavy rain", "severe", "hard depression", "abnormal brake pedal", "very hard",
            "அதிக தூரம்", "கடுமையான", "மிக கடினம்", "கடினமாக", "மழை", "ரொம்ப லூஸ்", "தாமதமாக நின்றது", "கனமழை",
            "romba distance", "romba loose", "hard-ah",
            "काफी अधिक दूरी", "गंभीर", "भारी बारिश", "बहुत ढीला", "असामान्य", "बहुत सख्त",
            "bohot zyada distance", "bohot hard", "rukne me dikkat", "bohot zyada"
        ]
        sev3_keywords = [
            "jerky", "unusually", "imbalance", "exceeded", "vibrating",
            "அதிர்வு", "சமநிலையின்மை", "झटका", "असंतुलन"
        ]
        sev2_keywords = [
            "minor", "wear threshold", "routine", "slight",
            "சிறு", "வழக்கமான", "லேசான", "मामूली", "नियमित", "हल्का"
        ]

        if any(w in text_lower for w in sev5_keywords):
            severity = 5
        elif any(w in text_lower for w in sev4_keywords):
            severity = 4
        elif any(w in text_lower for w in sev3_keywords):
            severity = 3
        elif any(w in text_lower for w in sev2_keywords):
            severity = 2

        # 5. Reporter role and source
        reporter_role = "driver"
        source = "driver"
        if any(w in text_lower for w in ["passenger", "rider", "transitapp", "பயணி", "புகார்", "यात्री", "शिकायत"]):
            reporter_role = "passenger"
            source = "Passenger Feedback App"
        elif any(w in text_lower for w in ["inspector", "audit", "dot", "ஆய்வாளர்", "தணிக்கை", "निरीक्षक", "जांच"]):
            reporter_role = "inspector"
            source = "State Transit Safety Inspector"
        elif any(w in text_lower for w in ["technician", "mechanic", "depot", "workshop", "பழுதுபார்ப்பவர்", "மெக்கானிக்", "मैकेनिक"]):
            reporter_role = "technician"
            source = "Depot Workshop Log"
        elif any(w in text_lower for w in ["safety officer", "dispatch", "பாதுகாப்பு அதிகாரி", "सुरक्षा अधिकारी"]):
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

        # 7. Metadata (e.g. weather, road conditions, language tracking)
        raw_metadata: Dict[str, Any] = {}
        if any(w in text_lower for w in ["heavy rain", "கனமழை", "भारी बारिश"]):
            raw_metadata["weather"] = "heavy rain"
        elif any(w in text_lower for w in ["light rain", "தூறல்", "हल्की बारिश"]):
            raw_metadata["weather"] = "light rain"
        elif any(w in text_lower for w in ["rain", "மழை", "बारिश"]):
            raw_metadata["weather"] = "rain"
        elif any(w in text_lower for w in ["snow", "பனி", "बर्फ"]):
            raw_metadata["weather"] = "snow"

        # Language detection heuristic
        has_tamil_script = bool(re.search(r"[\u0B80-\u0BFF]", report_text))
        has_hindi_script = bool(re.search(r"[\u0900-\u097F]", report_text))
        tanglish_words = ["romba", "irundhuchu", "irukku", "vandhu", "panna", "pannaru", "mudiyala", "kooda", "kazhandhu", "pathu", "thandiruchu", "illai", "aachu", "aayidichu"]
        hinglish_words = ["bohot", "zyada", "chalate", "rukne", "bachi", "gaya", "gayi", "rahi", "hote", "bache", "bahut", "kharab", "thik", "tha", "thi"]

        is_tanglish = any(re.search(rf"\b{w}\b", text_lower) for w in tanglish_words)
        is_hinglish = any(re.search(rf"\b{w}\b", text_lower) for w in hinglish_words)
        has_english_words = bool(re.search(r"\b(driver|reported|bus|trk|brake|pedal|distance|heavy|rain|shudder|overshot|signal|crosswalk|speed|caliper|abnormal)\b", text_lower))

        detected_language = "en"
        if has_tamil_script and has_english_words:
            detected_language = "code-mixed"
        elif has_hindi_script and has_english_words:
            detected_language = "code-mixed"
        elif has_tamil_script:
            detected_language = "ta"
        elif has_hindi_script:
            detected_language = "hi"
        elif is_tanglish:
            detected_language = "ta-Latn"
        elif is_hinglish:
            detected_language = "hi-Latn"

        # Record language tracking metadata only when multilingual/code-mixed
        if detected_language != "en":
            raw_metadata["detected_language"] = detected_language
            raw_metadata["original_text"] = report_text.strip()

        # 8. Description narrative
        description = report_text.strip()
        if detected_language != "en":
            # Translate and normalize non-English or code-mixed input to an English factual narrative
            if subsystem == "braking" and severity >= 4:
                description = f"Driver reported abnormal braking performance with increased stopping distance on {asset_id or 'vehicle'}."
            elif event_type == "near_miss":
                description = f"Reported critical near-miss event on {asset_id or 'vehicle'}: vehicle overshot stopping mark."
            elif subsystem == "steering":
                description = f"Reported steering pull and abnormal alignment on {asset_id or 'vehicle'}."
            else:
                description = f"Operational {event_type.replace('_', ' ')} logged for {subsystem} on {asset_id or 'vehicle'}."
        else:
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
