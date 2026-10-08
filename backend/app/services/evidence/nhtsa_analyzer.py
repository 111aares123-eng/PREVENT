"""
Deterministic Evidence Analyzer for NHTSA Real-World Safety Records.

Performs retrospective empirical analysis on official NHTSA ODI public complaint
and recall records to evaluate PREVENT's signal convergence hypothesis:
"Multiple weak safety signals become more meaningful when they converge
around the same asset/subsystem and over time."

This analyzer:
- Operates purely on local normalized evidence snapshots.
- Employs zero predictive ML or black-box risk scoring.
- Has zero coupling to the operational database, RiskEngine, or Event tables.
"""
import json
import os
from collections import Counter, defaultdict
from datetime import datetime
from typing import Dict, Any, List, Optional


DEFAULT_SNAPSHOT_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "..",
        "..",
        "data",
        "evidence",
        "nhtsa_evidence.json",
    )
)


def parse_iso_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse ISO YYYY-MM-DD date string safely."""
    if not date_str or not isinstance(date_str, str):
        return None
    try:
        return datetime.strptime(date_str.strip()[:10], "%Y-%m-%d")
    except ValueError:
        return None


def calculate_lead_time_days(first_date_str: Optional[str], action_date_str: Optional[str]) -> Optional[int]:
    """Calculate elapsed days between first significant signal and regulatory action."""
    dt_first = parse_iso_date(first_date_str)
    dt_action = parse_iso_date(action_date_str)
    if dt_first and dt_action and dt_action >= dt_first:
        return (dt_action - dt_first).days
    return None


def extract_signal_symptoms(narrative: str) -> List[str]:
    """Extract descriptive symptom clusters from driver complaint narratives."""
    text = (narrative or "").lower()
    symptoms = []
    if "chime" in text or "light" in text or "warning" in text or "message" in text or "fault" in text:
        symptoms.append("Warning Indicator / Message")
    if "stiff" in text or "heavy" in text or "hard to turn" in text or "muscle" in text or "strength" in text:
        symptoms.append("Excessive Steering Effort / Stiffness")
    if "loss" in text or "lost" in text or "failed" in text or "shut off" in text or "died" in text:
        symptoms.append("Sudden Loss of Power Assist")
    if "shudder" in text or "vibrat" in text or "shake" in text or "wobble" in text:
        symptoms.append("Shudder / Vibration")
    if "noise" in text or "grind" in text or "pop" in text or "whine" in text:
        symptoms.append("Mechanical Noise / Grinding")
    if not symptoms:
        symptoms.append("General Anomaly Report")
    return symptoms


class NHTSAEvidenceAnalyzer:
    """Pure deterministic analyzer for NHTSA public safety evidence."""

    def __init__(self, snapshot_path: Optional[str] = None):
        self.snapshot_path = snapshot_path or DEFAULT_SNAPSHOT_PATH

    def load_snapshot(self) -> Dict[str, Any]:
        """Load the evidence JSON snapshot from disk."""
        if not os.path.exists(self.snapshot_path):
            return {
                "metadata": {},
                "recalls": [],
                "complaints": []
            }
        try:
            with open(self.snapshot_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {
                "metadata": {},
                "recalls": [],
                "complaints": []
            }

    def analyze(self, raw_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Analyze complaints and recalls into structured, reproducible evidence metrics."""
        data = raw_data if raw_data is not None else self.load_snapshot()
        
        metadata = data.get("metadata", {})
        case_study = metadata.get("case_study", {})
        cohort = metadata.get("cohort", {})
        complaints: List[Dict[str, Any]] = data.get("complaints", [])
        recalls: List[Dict[str, Any]] = data.get("recalls", [])

        target_subsystem = case_study.get("target_subsystem", "STEERING")
        recall_date_str = case_study.get("recall_effective_date", "2015-06-02")
        recall_dt = parse_iso_date(recall_date_str) or datetime(2015, 6, 2)
        recall_campaign = case_study.get("official_recall_campaign", "15V340000")
        recall_action = case_study.get("official_investigation_action", "PE14030")

        total_records = len(complaints)
        if total_records == 0:
            return self._empty_analysis(metadata)

        # 1. Target Subsystem Filtering & Severity Classification
        target_complaints = [
            c for c in complaints if (c.get("primary_subsystem") or "").upper() == target_subsystem.upper()
        ]
        target_count = len(target_complaints)
        target_concentration_pct = round((target_count / total_records) * 100, 1)

        precursor_complaints = [
            c for c in target_complaints if c.get("severity_tier") == "PRECURSOR"
        ]
        critical_complaints = [
            c for c in target_complaints if c.get("severity_tier") == "CRITICAL"
        ]

        precursor_count = len(precursor_complaints)
        critical_count = len(critical_complaints)
        precursor_pct = round((precursor_count / target_count) * 100, 1) if target_count > 0 else 0.0
        critical_pct = round((critical_count / target_count) * 100, 1) if target_count > 0 else 0.0

        # 2. Pre-Action vs Post-Action Temporal Split
        pre_action_complaints = []
        post_action_complaints = []
        first_significant_date = None

        for c in target_complaints:
            filed_dt = parse_iso_date(c.get("filed_date"))
            if filed_dt:
                if first_significant_date is None or filed_dt < first_significant_date:
                    first_significant_date = filed_dt
                if filed_dt < recall_dt:
                    pre_action_complaints.append(c)
                else:
                    post_action_complaints.append(c)

        pre_action_count = len(pre_action_complaints)
        post_action_count = len(post_action_complaints)

        # Lead time calculation from first signal to official recall
        lead_time_days = None
        lead_time_months = None
        if first_significant_date and recall_dt:
            lead_time_days = (recall_dt - first_significant_date).days
            lead_time_months = round(lead_time_days / 30.4375, 1)

        # 3. Subsystem Breakdown across whole vehicle
        subsystem_counts = Counter(c.get("primary_subsystem") or "OTHER" for c in complaints)
        subsystem_breakdown = [
            {
                "subsystem": sub,
                "count": count,
                "percentage": round((count / total_records) * 100, 1),
                "is_target": ((sub or "").upper() == target_subsystem.upper())
            }
            for sub, count in subsystem_counts.most_common()
        ]

        # 4. Yearly Timeline Analysis (Target Subsystem)
        yearly_map = defaultdict(lambda: {"precursor": 0, "critical": 0, "total": 0})
        for c in target_complaints:
            filed_dt = parse_iso_date(c.get("filed_date"))
            year_key = str(filed_dt.year) if filed_dt else "UNKNOWN"
            is_crit = c.get("severity_tier") == "CRITICAL"
            if is_crit:
                yearly_map[year_key]["critical"] += 1
            else:
                yearly_map[year_key]["precursor"] += 1
            yearly_map[year_key]["total"] += 1

        sorted_years = sorted([y for y in yearly_map.keys() if y.isdigit()], key=int)
        yearly_timeline = []
        for y in sorted_years:
            val = yearly_map[y]
            is_recall_year = (y == "2015")
            yearly_timeline.append({
                "period": y,
                "precursor_count": val["precursor"],
                "critical_count": val["critical"],
                "total_count": val["total"],
                "action_marker": is_recall_year,
                "action_label": "NHTSA Recall 15V340000 (PE14030)" if is_recall_year else None
            })

        # 5. Symptom / Signal Diversity
        symptom_counter = Counter()
        for c in target_complaints:
            symptoms = extract_signal_symptoms(c.get("summary_excerpt", ""))
            for sym in symptoms:
                symptom_counter[sym] += 1

        signal_diversity = [
            {"symptom": sym, "count": count, "percentage": round((count / target_count) * 100, 1)}
            for sym, count in symptom_counter.most_common(5)
        ]

        # 6. Primary Safety Action Details
        target_recall = next(
            (r for r in recalls if r.get("campaign_number") == recall_campaign),
            recalls[0] if recalls else {}
        )

        # 7. Traceable Exemplar Records (Curated Real-World Case Logs)
        # Select 6 diverse historical records: early precursors, high-velocity pre-recall, and critical incidents
        traceable_records = []
        
        # Sort complaints by filed_date ascending
        dated_complaints = sorted(
            [c for c in target_complaints if c.get("filed_date")],
            key=lambda x: x["filed_date"]
        )

        # Add 1 early precursor (2011/2012)
        early = next((c for c in dated_complaints if c.get("filed_date", "").startswith(("2011", "2012")) and c.get("severity_tier") == "PRECURSOR"), None)
        if early:
            traceable_records.append(self._format_traceable(early, "Early Precursor (Baseline)"))

        # Add 1 mid-escalation precursor (2013)
        mid = next((c for c in dated_complaints if c.get("filed_date", "").startswith("2013") and c.get("severity_tier") == "PRECURSOR"), None)
        if mid:
            traceable_records.append(self._format_traceable(mid, "Escalating Precursor (Year 2)"))

        # Add 2 peak pre-investigation precursors (2014)
        pre_inv = [c for c in dated_complaints if c.get("filed_date", "").startswith("2014") and c.get("severity_tier") == "PRECURSOR"]
        for p in pre_inv[:2]:
            traceable_records.append(self._format_traceable(p, "High-Velocity Precursor (PE14030 Opened)"))

        # Add 2 critical outcome records (crashes / injury reports)
        critical_samples = [c for c in dated_complaints if c.get("severity_tier") == "CRITICAL"]
        for crit in critical_samples[:2]:
            traceable_records.append(self._format_traceable(crit, "Critical-Outcome Report (Crash / Fire / Injury)"))

        return {
            "metadata": {
                "source": "NHTSA Office of Defects Investigation (ODI)",
                "dataset_name": "NHTSA Consumer Complaints & Safety Recalls",
                "cohort": cohort,
                "case_study": case_study,
                "disclaimer": (
                    "Consumer complaints submitted to NHTSA are unverified self-reported allegations. "
                    "This retrospective empirical analysis is presented as independent supporting evidence "
                    "for PREVENT's signal convergence hypothesis and does NOT constitute an accident prediction model."
                ),
            },
            "summary": {
                "total_cohort_records": total_records,
                "target_subsystem": target_subsystem,
                "target_subsystem_records": target_count,
                "subsystem_concentration_pct": target_concentration_pct,
                "precursor_signals": precursor_count,
                "precursor_pct": precursor_pct,
                "critical_outcomes": critical_count,
                "critical_pct": critical_pct,
                "pre_action_signals": pre_action_count,
                "post_action_signals": post_action_count,
                "lead_time_days": lead_time_days,
                "lead_time_months": lead_time_months,
            },
            "safety_action": {
                "campaign_number": recall_campaign,
                "action_number": recall_action,
                "action_date": recall_date_str,
                "component": target_recall.get("component", "STEERING:ELECTRIC POWER ASSIST SYSTEM"),
                "defect_summary": target_recall.get("summary", ""),
                "consequence": target_recall.get("consequence", ""),
                "remedy": target_recall.get("remedy", "")
            },
            "subsystem_breakdown": subsystem_breakdown,
            "temporal_timeline": yearly_timeline,
            "signal_diversity": signal_diversity,
            "traceable_signals": traceable_records
        }

    def _format_traceable(self, record: Dict[str, Any], context_label: str) -> Dict[str, Any]:
        """Format an exemplar complaint for transparent public traceability."""
        return {
            "odi_number": record.get("odi_number"),
            "filed_date": record.get("filed_date"),
            "incident_date": record.get("incident_date"),
            "context_label": context_label,
            "severity_tier": record.get("severity_tier"),
            "crash": record.get("crash", False),
            "injuries": record.get("injuries", 0),
            "primary_subsystem": record.get("primary_subsystem"),
            "components": record.get("components", []),
            "summary_excerpt": record.get("summary_excerpt", ""),
            "official_lookup_url": record.get("official_lookup_url", "")
        }

    def _empty_analysis(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Return an empty analysis structure when no records exist."""
        return {
            "metadata": metadata,
            "summary": {
                "total_cohort_records": 0,
                "target_subsystem": "UNKNOWN",
                "target_subsystem_records": 0,
                "subsystem_concentration_pct": 0.0,
                "precursor_signals": 0,
                "precursor_pct": 0.0,
                "critical_outcomes": 0,
                "critical_pct": 0.0,
                "pre_action_signals": 0,
                "post_action_signals": 0,
                "lead_time_days": None,
                "lead_time_months": None,
            },
            "safety_action": {},
            "subsystem_breakdown": [],
            "temporal_timeline": [],
            "signal_diversity": [],
            "traceable_signals": []
        }
