"""
NHTSA Evidence Data Ingestion & Snapshot Loader.

Fetches official public records from the NHTSA Office of Defects Investigation (ODI)
Complaints and Recalls APIs for the 2011 Ford Fusion EPAS (Electric Power Assist Steering)
case study, normalizes the schema, and saves a reproducible offline JSON snapshot.

Source APIs:
- https://api.nhtsa.gov/complaints/complaintsByVehicle?make=ford&model=fusion&modelYear=2011
- https://api.nhtsa.gov/recalls/recallsByVehicle?make=ford&model=fusion&modelYear=2011
"""
import json
import os
import urllib.request
from datetime import datetime
from typing import Dict, Any, List

EVIDENCE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(EVIDENCE_DIR, "nhtsa_evidence.json")

MAKE = "ford"
MODEL = "fusion"
YEAR = 2011
RECALL_CAMPAIGN = "15V340000"
RECALL_ACTION = "PE14030"
RECALL_DATE = "2015-06-02"


def fetch_json(url: str) -> Dict[str, Any]:
    """Fetch JSON from a remote URL with standard User-Agent header."""
    req = urllib.request.Request(url, headers={"User-Agent": "PREVENT-Safety-Intelligence/1.0"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


def parse_nhtsa_date(date_str: str) -> str:
    """Parse NHTSA date string (typically MM/DD/YYYY or DD/MM/YYYY) to ISO YYYY-MM-DD."""
    if not date_str:
        return ""
    date_str = date_str.strip()
    for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
    return date_str


def normalize_complaints(raw_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalize raw NHTSA complaints into a consistent evidence format."""
    normalized = []
    for item in raw_results:
        odi = item.get("odiNumber")
        raw_components = item.get("components", "")
        component_list = [c.strip() for c in raw_components.split(",") if c.strip()]
        
        # Primary subsystem classification
        primary_subsystem = "OTHER"
        if any("STEERING" in c.upper() for c in component_list):
            primary_subsystem = "STEERING"
        elif any("AIR BAG" in c.upper() for c in component_list):
            primary_subsystem = "AIR BAGS"
        elif any("ENGINE" in c.upper() for c in component_list):
            primary_subsystem = "ENGINE"
        elif any("BRAKE" in c.upper() for c in component_list):
            primary_subsystem = "BRAKES"
        elif any("POWER TRAIN" in c.upper() or "TRANSMISSION" in c.upper() for c in component_list):
            primary_subsystem = "POWER TRAIN"
        elif any("ELECTRICAL" in c.upper() for c in component_list):
            primary_subsystem = "ELECTRICAL"
        elif any("SPEED CONTROL" in c.upper() for c in component_list):
            primary_subsystem = "SPEED CONTROL"
            
        crash = bool(item.get("crash", False))
        fire = bool(item.get("fire", False))
        injuries = int(item.get("numberOfInjuries") or 0)
        deaths = int(item.get("numberOfDeaths") or 0)
        
        is_critical = crash or fire or (injuries > 0) or (deaths > 0)
        severity_tier = "CRITICAL" if is_critical else "PRECURSOR"
        
        summary = (item.get("summary") or "").strip()
        summary_excerpt = summary[:240] + ("..." if len(summary) > 240 else "")
        
        filed_date_iso = parse_nhtsa_date(item.get("dateComplaintFiled", ""))
        incident_date_iso = parse_nhtsa_date(item.get("dateOfIncident", ""))
        
        normalized.append({
            "odi_number": odi,
            "filed_date": filed_date_iso,
            "incident_date": incident_date_iso,
            "components": component_list,
            "primary_subsystem": primary_subsystem,
            "severity_tier": severity_tier,
            "crash": crash,
            "fire": fire,
            "injuries": injuries,
            "deaths": deaths,
            "summary_excerpt": summary_excerpt,
            "official_lookup_url": f"https://www.nhtsa.gov/recalls?nhtsaId={odi}"
        })
        
    return normalized


def normalize_recalls(raw_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalize raw NHTSA recalls."""
    normalized = []
    for item in raw_results:
        campaign = item.get("NHTSACampaignNumber")
        action = item.get("NHTSAActionNumber")
        date_iso = parse_nhtsa_date(item.get("ReportReceivedDate", ""))
        component = item.get("Component", "")
        summary = item.get("Summary", "")
        consequence = item.get("Consequence", "")
        remedy = item.get("Remedy", "")
        
        normalized.append({
            "campaign_number": campaign,
            "action_number": action,
            "report_date": date_iso,
            "component": component,
            "summary": summary,
            "consequence": consequence,
            "remedy": remedy
        })
    return normalized


def build_snapshot() -> Dict[str, Any]:
    """Fetch live NHTSA records and create normalized static snapshot."""
    c_url = f"https://api.nhtsa.gov/complaints/complaintsByVehicle?make={MAKE}&model={MODEL}&modelYear={YEAR}"
    r_url = f"https://api.nhtsa.gov/recalls/recallsByVehicle?make={MAKE}&model={MODEL}&modelYear={YEAR}"
    
    print(f"Fetching complaints from: {c_url}")
    c_data = fetch_json(c_url)
    raw_complaints = c_data.get("results", [])
    print(f"Retrieved {len(raw_complaints)} raw complaints.")
    
    print(f"Fetching recalls from: {r_url}")
    r_data = fetch_json(r_url)
    raw_recalls = r_data.get("results", [])
    print(f"Retrieved {len(raw_recalls)} raw recalls.")
    
    normalized_cmpl = normalize_complaints(raw_complaints)
    normalized_rcls = normalize_recalls(raw_recalls)
    
    snapshot = {
        "metadata": {
            "source": "NHTSA Office of Defects Investigation (ODI)",
            "retrieval_date": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "cohort": {
                "make": MAKE.upper(),
                "model": MODEL.upper(),
                "model_year": YEAR
            },
            "case_study": {
                "title": "Electric Power Assist Steering (EPAS) Loss of Assist",
                "target_subsystem": "STEERING",
                "official_recall_campaign": RECALL_CAMPAIGN,
                "official_investigation_action": RECALL_ACTION,
                "recall_effective_date": RECALL_DATE
            },
            "disclaimer": (
                "Consumer complaints submitted to NHTSA are unverified self-reported allegations. "
                "This retrospective empirical analysis is presented as independent supporting evidence "
                "for signal convergence and does not constitute an accident prediction model."
            )
        },
        "recalls": normalized_rcls,
        "complaints": normalized_cmpl
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2)
        
    file_size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"Snapshot written successfully to {OUTPUT_FILE} ({file_size_kb:.1f} KB).")
    return snapshot


if __name__ == "__main__":
    build_snapshot()
