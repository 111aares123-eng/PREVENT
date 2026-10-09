"""
Deterministic "Why Now?" Safety Intelligence Analyzer for PREVENT.
Explains why an asset requires immediate human attention based on
traceable evidence, cross-source corroboration, contracting intervals,
and mathematical factor contributions.
DO NOT use an LLM for this - strictly deterministic and evidence-backed.
"""
from typing import Any, Dict, List, Optional, Sequence
from backend.app.models.asset import Asset
from backend.app.models.event import Event
from backend.app.schemas.fleet import (
    WhyNowResponse,
    WhyNowSignalItem,
    FactorContributionItem
)
from backend.app.services.risk_engine import RiskAssessmentOutput


class WhyNowAnalyzer:
    """Deterministic analyzer synthesizing explainable "Why Now?" intelligence."""

    @staticmethod
    def _is_mitigation_record(ev: Event) -> bool:
        from backend.app.services.risk_engine import RiskEngine
        return RiskEngine._analyze_mitigation_event(ev)[0]

    @staticmethod
    def generate_explanation(
        asset: Asset,
        events: Sequence[Event],
        assessment: RiskAssessmentOutput
    ) -> WhyNowResponse:
        """
        Converts risk assessment and event data into structured Why-Now intelligence.
        """
        sorted_events = sorted(events, key=lambda e: e.timestamp)
        k = len(sorted_events)

        primary_sub = assessment.primary_subsystem or "general"
        primary_bd = assessment.subsystems_breakdown.get(primary_sub)

        # Check if asset has active safety escalation
        has_near_miss_or_critical = any(
            e.event_type in ("near_miss", "incident") or e.severity >= 5
            for e in sorted_events
        )
        is_contracting = primary_bd.temporal_analysis.is_contracting if primary_bd else False
        temporal_accel_pts = primary_bd.temporal_acceleration_points if primary_bd else 0.0
        has_active_escalation = (
            assessment.score >= 40.0
            or temporal_accel_pts > 0.0
            or has_near_miss_or_critical
        )

        signals: List[WhyNowSignalItem] = []

        if not has_active_escalation:
            # Quiet asset with stale, low-severity, or isolated baseline observations
            if k > 0:
                last_ev = sorted_events[-1]
                last_dt = last_ev.timestamp
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=assessment.anchor_time.tzinfo)
                days_ago = max(0, int((assessment.anchor_time - last_dt).total_seconds() / 86400.0))
                latest_sev = last_ev.severity

                signals.append(
                    WhyNowSignalItem(
                        label="Active escalation state",
                        value="No active escalation detected",
                        severity="info",
                        evidence_event_ids=[str(last_ev.id)]
                    )
                )
                signals.append(
                    WhyNowSignalItem(
                        label="Observation context",
                        value=f"Last signal recorded {days_ago}d ago (severity {latest_sev}/5)",
                        severity="info",
                        evidence_event_ids=[str(last_ev.id)]
                    )
                )
                signals.append(
                    WhyNowSignalItem(
                        label="Corroboration state",
                        value="Single isolated observation" if k == 1 else "Routine observations without compounding pattern",
                        severity="info",
                        evidence_event_ids=[str(e.id) for e in sorted_events]
                    )
                )
        else:
            # Active, elevated, or accelerating safety pattern (e.g. BUS-142)
            # 1. Total Related Signals Signal
            if k > 0:
                signals.append(
                    WhyNowSignalItem(
                        label="Related signals detected",
                        value=f"{k} related signals detected" if k > 1 else "1 signal detected",
                        severity="positive" if k >= 3 else "info",
                        evidence_event_ids=[str(e.id) for e in sorted_events]
                    )
                )

            # 2. Multiple Independent Sources / Cross-Source Diversity
            distinct_roles = sorted(list({e.reporter_role for e in sorted_events if e.reporter_role}))
            distinct_sources = sorted(list({e.source for e in sorted_events if e.source}))
            source_count = max(len(distinct_roles), len(distinct_sources))
            if source_count > 0:
                signals.append(
                    WhyNowSignalItem(
                        label="Multiple independent sources",
                        value=f"{source_count} sources" if source_count > 1 else "1 source",
                        severity="positive" if source_count >= 2 else "info",
                        evidence_event_ids=[str(e.id) for e in sorted_events]
                    )
                )

            # 3. Severity Escalation Pattern
            if k >= 2:
                min_sev = min(e.severity for e in sorted_events)
                max_sev = max(e.severity for e in sorted_events)
                if max_sev > min_sev:
                    escalation_events = [e for e in sorted_events if e.severity in (min_sev, max_sev)]
                    signals.append(
                        WhyNowSignalItem(
                            label="Severity escalation",
                            value=f"{min_sev} → {max_sev}",
                            severity="positive" if max_sev >= 4 else "warning",
                            evidence_event_ids=[str(e.id) for e in escalation_events]
                        )
                    )

            # 4. Temporal Acceleration / Contracting Intervals
            if is_contracting:
                primary_events = [e for e in sorted_events if e.subsystem == primary_sub]
                signals.append(
                    WhyNowSignalItem(
                        label="Temporal acceleration",
                        value="Intervals are contracting",
                        severity="positive",
                        evidence_event_ids=[str(e.id) for e in primary_events]
                    )
                )

            # 5. Near-Miss / Incident Anchor Detection
            near_misses = [
                e for e in sorted_events
                if e.event_type in ("near_miss", "incident") or e.severity >= 5
            ]
            if near_misses:
                nm_count = len(near_misses)
                signals.append(
                    WhyNowSignalItem(
                        label="Near-miss detected",
                        value=f"{nm_count} near-miss" if nm_count == 1 else f"{nm_count} near-misses",
                        severity="critical",
                        evidence_event_ids=[str(e.id) for e in near_misses]
                    )
                )

            # 6. Subsystem Concentration Focus
            if primary_sub and k > 0:
                sub_events = [e for e in sorted_events if e.subsystem == primary_sub]
                sub_title = primary_sub.replace("_", " ").lower()
                if len(sub_events) == k:
                    val = f"All signals focus on the {sub_title} subsystem"
                else:
                    val = f"{len(sub_events)}/{k} signals focus on {sub_title}"
                signals.append(
                    WhyNowSignalItem(
                        label="Subsystem concentration",
                        value=val,
                        severity="positive",
                        evidence_event_ids=[str(e.id) for e in sub_events]
                    )
                )

            # 7. Mitigation status if corrective action was applied
            if primary_bd and primary_bd.mitigation_discount_points > 0:
                signals.append(
                    WhyNowSignalItem(
                        label="Mitigation discount applied",
                        value=f"Hazard mitigated (-{primary_bd.mitigation_discount_points:.1f} pts)",
                        severity="info",
                        evidence_event_ids=[str(e.id) for e in sorted_events if WhyNowAnalyzer._is_mitigation_record(e)]
                    )
                )

        distinct_roles = sorted(list({e.reporter_role for e in sorted_events if e.reporter_role}))
        distinct_sources = sorted(list({e.source for e in sorted_events if e.source}))
        source_count = max(len(distinct_roles), len(distinct_sources))

        # Factor contributions (strictly from deterministic factor breakdown)
        fb = assessment.factor_breakdown
        factor_contributions: List[FactorContributionItem] = [
            FactorContributionItem(
                factor_key="base_severity_points",
                label="Severity & Recency",
                points=round(fb.get("base_severity_points", 0.0), 1)
            ),
            FactorContributionItem(
                factor_key="frequency_penalty_points",
                label="Frequency",
                points=round(fb.get("frequency_penalty_points", 0.0), 1)
            ),
            FactorContributionItem(
                factor_key="cross_source_bonus_points",
                label="Cross-source",
                points=round(fb.get("cross_source_bonus_points", 0.0), 1)
            ),
            FactorContributionItem(
                factor_key="temporal_acceleration_points",
                label="Temporal Escalation",
                points=round(fb.get("temporal_acceleration_points", 0.0), 1)
            ),
            FactorContributionItem(
                factor_key="near_miss_anchor_points",
                label="Near-miss",
                points=round(fb.get("near_miss_anchor_points", 0.0), 1)
            )
        ]

        if fb.get("mitigation_discount_points", 0.0) > 0.0:
            factor_contributions.append(
                FactorContributionItem(
                    factor_key="mitigation_discount_points",
                    label="Mitigation Credit",
                    points=-round(fb.get("mitigation_discount_points", 0.0), 1)
                )
            )

        if fb.get("cross_subsystem_spillover", 0.0) > 0.0:
            factor_contributions.append(
                FactorContributionItem(
                    factor_key="cross_subsystem_spillover",
                    label="Cross-subsystem Spillover",
                    points=round(fb.get("cross_subsystem_spillover", 0.0), 1)
                )
            )

        # Headline and Summary Synthesis
        sub_display = primary_sub.replace("_", " ")
        near_misses = [
            e for e in sorted_events
            if e.event_type in ("near_miss", "incident") or e.severity >= 5
        ]

        if assessment.risk_level in ("CRITICAL", "HIGH") and near_misses:
            headline = f"{asset.asset_id} has transitioned from isolated maintenance observations to a multi-source safety pattern."
            summary = (
                f"Multiple independent warning signals around the {sub_display} subsystem have "
                f"escalated from maintenance observation to near-miss."
            )
        elif assessment.risk_level in ("CRITICAL", "HIGH"):
            headline = f"{asset.asset_id} shows compounding warning signals across multiple independent sources."
            summary = (
                f"Multiple independent signals around the {sub_display} subsystem are accelerating "
                f"with contracting intervals and compounding severity."
            )
        elif assessment.risk_level == "MEDIUM":
            headline = f"{asset.asset_id} exhibits emerging repeated observations requiring heightened surveillance."
            summary = (
                f"Recurring signals detected on the {sub_display} subsystem without critical near-miss escalation yet."
            )
        else:
            headline = f"NO ACTIVE ESCALATION DETECTED — {asset.asset_id} remains within normal operational baseline."
            if k > 0:
                last_ev = sorted_events[-1]
                last_dt = last_ev.timestamp
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=assessment.anchor_time.tzinfo)
                days_ago = max(0, int((assessment.anchor_time - last_dt).total_seconds() / 86400.0))
                summary = (
                    f"Last relevant signal: {days_ago}d ago (severity {last_ev.severity}/5). "
                    f"No recent recurrence, no corroborating sources, and no current escalation."
                )
            else:
                summary = (
                    f"No systemic multi-source escalation or safety-critical anomalies detected across recent operation."
                )

        return WhyNowResponse(
            asset_id=asset.asset_id,
            headline=headline,
            summary=summary,
            signals=signals,
            factor_contributions=factor_contributions,
            current_risk_score=assessment.score,
            risk_level=assessment.risk_level,
            primary_subsystem=primary_sub,
            total_signals_count=k,
            distinct_sources_count=source_count
        )
