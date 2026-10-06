"""
Correlation Engine for PREVENT.
Identifies deterministic relationships across events (same asset, same subsystem,
cross-source corroboration, temporal proximity, and related event types)
and builds structured Evidence Graph representations for frontend visualization.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Set
from pydantic import BaseModel, Field
from backend.app.models.asset import Asset
from backend.app.models.event import Event


class SubsystemCorrelationCluster(BaseModel):
    """Cluster of correlated events centered around a vehicle subsystem."""
    subsystem: str = Field(..., description="Target vehicle subsystem")
    events: List[Dict[str, Any]] = Field(default_factory=list, description="List of event representations")
    event_count: int = Field(default=0)
    distinct_sources: List[str] = Field(default_factory=list, description="Unique source names (e.g. Passenger Feedback App)")
    distinct_roles: List[str] = Field(default_factory=list, description="Unique reporting roles (e.g. passenger, technician)")
    distinct_sources_count: int = Field(default=0)
    has_near_miss_or_incident: bool = Field(default=False)
    earliest_timestamp: Optional[datetime] = None
    latest_timestamp: Optional[datetime] = None
    time_span_days: float = Field(default=0.0)


class EvidenceGraphNode(BaseModel):
    """Node in the Evidence Graph."""
    id: str = Field(..., description="Unique node identifier")
    label: str = Field(..., description="Human-readable display label")
    type: str = Field(..., description="'asset' | 'subsystem' | 'event' | 'risk_factor'")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EvidenceGraphEdge(BaseModel):
    """Directed edge in the Evidence Graph."""
    source: str = Field(..., description="Source node id")
    target: str = Field(..., description="Target node id")
    relation: str = Field(..., description="Relationship predicate (e.g. 'has_subsystem_focus', 'correlates_signal')")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EvidenceGraphData(BaseModel):
    """Complete graph structure suitable for D3 / React Flow rendering."""
    nodes: List[EvidenceGraphNode] = Field(default_factory=list)
    edges: List[EvidenceGraphEdge] = Field(default_factory=list)


def _to_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware UTC for safe comparisons."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class CorrelationEngine:
    """Deterministic correlation and evidence graph generator."""

    def cluster_events_by_subsystem(self, events: Sequence[Event]) -> Dict[str, SubsystemCorrelationCluster]:
        """
        Groups events by subsystem and calculates cross-source metrics.
        """
        clusters: Dict[str, SubsystemCorrelationCluster] = {}

        for event in events:
            sub = event.subsystem or "general"
            if sub not in clusters:
                clusters[sub] = SubsystemCorrelationCluster(
                    subsystem=sub,
                    events=[],
                    event_count=0,
                    distinct_sources=[],
                    distinct_roles=[],
                    distinct_sources_count=0,
                    has_near_miss_or_incident=False,
                    earliest_timestamp=None,
                    latest_timestamp=None,
                    time_span_days=0.0
                )

            cluster = clusters[sub]
            ev_time = _to_utc(event.timestamp)

            # Serialize event snapshot
            cluster.events.append({
                "id": str(event.id),
                "timestamp": ev_time,
                "event_type": event.event_type,
                "severity": event.severity,
                "description": event.description,
                "source": event.source,
                "reporter_role": event.reporter_role,
                "location": event.location
            })
            cluster.event_count += 1

            if event.source and event.source not in cluster.distinct_sources:
                cluster.distinct_sources.append(event.source)
            if event.reporter_role and event.reporter_role not in cluster.distinct_roles:
                cluster.distinct_roles.append(event.reporter_role)

            if event.event_type in ("near_miss", "incident") or event.severity >= 5:
                cluster.has_near_miss_or_incident = True

            # Track time span
            if cluster.earliest_timestamp is None or ev_time < cluster.earliest_timestamp:
                cluster.earliest_timestamp = ev_time
            if cluster.latest_timestamp is None or ev_time > cluster.latest_timestamp:
                cluster.latest_timestamp = ev_time

        # Finalize counts and spans
        for cluster in clusters.values():
            cluster.distinct_sources_count = len(cluster.distinct_roles)
            if cluster.earliest_timestamp and cluster.latest_timestamp:
                delta = cluster.latest_timestamp - cluster.earliest_timestamp
                cluster.time_span_days = round(max(0.0, delta.total_seconds() / 86400.0), 2)

        return clusters

    def build_evidence_graph(
        self,
        asset: Asset,
        events: Sequence[Event],
        active_factors: Optional[Dict[str, float]] = None
    ) -> EvidenceGraphData:
        """
        Constructs an explainable evidence graph connecting:
        Asset -> Subsystem Focus -> Correlated Events -> Risk Factors
        """
        nodes: List[EvidenceGraphNode] = []
        edges: List[EvidenceGraphEdge] = []
        seen_nodes: Set[str] = set()

        # 1. Asset Root Node
        asset_node_id = f"asset-{asset.asset_id}"
        nodes.append(EvidenceGraphNode(
            id=asset_node_id,
            label=f"Asset: {asset.asset_id}",
            type="asset",
            metadata={
                "asset_id": asset.asset_id,
                "make_model": asset.make_model,
                "depot_location": asset.depot_location,
                "criticality": asset.criticality,
                "status": asset.status
            }
        ))
        seen_nodes.add(asset_node_id)

        # 2. Subsystem clusters
        clusters = self.cluster_events_by_subsystem(events)

        for sub_name, cluster in clusters.items():
            sub_node_id = f"subsystem-{sub_name}"
            if sub_node_id not in seen_nodes:
                nodes.append(EvidenceGraphNode(
                    id=sub_node_id,
                    label=f"{sub_name.replace('_', ' ').title()} System",
                    type="subsystem",
                    metadata={
                        "subsystem": sub_name,
                        "event_count": cluster.event_count,
                        "distinct_sources_count": cluster.distinct_sources_count,
                        "time_span_days": cluster.time_span_days
                    }
                ))
                seen_nodes.add(sub_node_id)

            # Edge: Asset -> Subsystem
            edges.append(EvidenceGraphEdge(
                source=asset_node_id,
                target=sub_node_id,
                relation="has_subsystem_focus",
                metadata={"event_count": cluster.event_count}
            ))

            # Sort events chronologically (timezone-safe)
            sorted_events = sorted(cluster.events, key=lambda e: _to_utc(e["timestamp"]))

            # 3. Event Nodes & Edges
            prev_event_node_id = None
            for idx, e in enumerate(sorted_events):
                ev_node_id = f"event-{e['id']}"
                if ev_node_id not in seen_nodes:
                    nodes.append(EvidenceGraphNode(
                        id=ev_node_id,
                        label=f"{e['event_type'].replace('_', ' ').title()} ({e['reporter_role']})",
                        type="event",
                        metadata={
                            "event_id": e["id"],
                            "timestamp": e["timestamp"].isoformat() if hasattr(e["timestamp"], "isoformat") else str(e["timestamp"]),
                            "severity": e["severity"],
                            "source": e["source"],
                            "reporter_role": e["reporter_role"],
                            "description": e["description"],
                            "location": e.get("location")
                        }
                    ))
                    seen_nodes.add(ev_node_id)

                # Edge: Subsystem -> Event
                edges.append(EvidenceGraphEdge(
                    source=sub_node_id,
                    target=ev_node_id,
                    relation="correlates_signal",
                    metadata={"severity": e["severity"]}
                ))

                # Temporal sequence edge: Event_i-1 -> Event_i
                if prev_event_node_id:
                    edges.append(EvidenceGraphEdge(
                        source=prev_event_node_id,
                        target=ev_node_id,
                        relation="temporal_sequence",
                        metadata={"step": idx}
                    ))
                prev_event_node_id = ev_node_id

        # 4. Risk Factor Nodes (if active factors provided)
        if active_factors:
            for factor_key, factor_points in active_factors.items():
                if factor_points > 0:
                    factor_node_id = f"factor-{factor_key}"
                    if factor_node_id not in seen_nodes:
                        nodes.append(EvidenceGraphNode(
                            id=factor_node_id,
                            label=factor_key.replace("_", " ").title(),
                            type="risk_factor",
                            metadata={
                                "factor_key": factor_key,
                                "points": factor_points
                            }
                        ))
                        seen_nodes.add(factor_node_id)

                    # Connect dominant subsystem to triggered risk factors
                    for sub_name in clusters.keys():
                        edges.append(EvidenceGraphEdge(
                            source=f"subsystem-{sub_name}",
                            target=factor_node_id,
                            relation="triggers_risk_factor",
                            metadata={"points": factor_points}
                        ))

        return EvidenceGraphData(nodes=nodes, edges=edges)
