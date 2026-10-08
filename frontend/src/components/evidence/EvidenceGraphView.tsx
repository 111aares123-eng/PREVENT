import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Layers,
  Zap,
  Activity,
  Info,
  ShieldAlert,
  ArrowRight,
  Clock,
  Wrench,
  MessageSquare,
  ClipboardCheck,
  Radio,
  FileText
} from 'lucide-react';
import type { EvidenceGraphData, EvidenceGraphNode, EvidenceGraphEdge } from '../../types/api';

interface EvidenceGraphViewProps {
  evidenceGraph: EvidenceGraphData;
  riskScore?: number;
  riskLevel?: string;
  highlightedEventIds?: string[];
  onSelectEventId?: (eventId: string) => void;
}

interface NodeLayout {
  node: EvidenceGraphNode;
  x: number; // center x
  y: number; // center y
  left: number;
  top: number;
  width: number;
  height: number;
  tier: number;
}

function getEventRoleIcon(role?: string) {
  switch (role?.toLowerCase()) {
    case 'technician':
      return <Wrench className="w-3.5 h-3.5 text-slate-600" />;
    case 'passenger':
      return <MessageSquare className="w-3.5 h-3.5 text-amber-600" />;
    case 'inspector':
      return <ClipboardCheck className="w-3.5 h-3.5 text-slate-700" />;
    case 'driver':
      return <Radio className="w-3.5 h-3.5 text-slate-700" />;
    case 'safety_officer':
      return <ShieldAlert className="w-3.5 h-3.5 text-red-600" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-slate-400" />;
  }
}

function getSeverityBadge(sev?: number) {
  if (!sev) return null;
  const color =
    sev >= 5
      ? 'bg-red-50 text-red-700 border-red-200'
      : sev >= 4
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : sev >= 3
      ? 'bg-amber-50/50 text-amber-800 border-amber-200'
      : 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${color}`}>
      Sev {sev}
    </span>
  );
}

export const EvidenceGraphView: React.FC<EvidenceGraphViewProps> = ({
  evidenceGraph,
  riskScore,
  riskLevel,
  highlightedEventIds = [],
  onSelectEventId
}) => {
  const [selectedNode, setSelectedNode] = useState<EvidenceGraphNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.min(1160, Math.max(880, window.innerWidth - 64));
    }
    return 1100;
  });

  // Responsive default view mode: on viewports below 1024px, default to Matrix View
  const [viewMode, setViewMode] = useState<'map' | 'matrix'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return 'matrix';
    }
    return 'map';
  });

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const clientWidth = containerRef.current.clientWidth;
        if (clientWidth > 0) {
          setContainerWidth(clientWidth);
        }
      }
    };

    updateWidth();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => {
        updateWidth();
      });
      ro.observe(containerRef.current);
    } else {
      window.addEventListener('resize', updateWidth);
    }

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Filter nodes by type
  const assetNodes = useMemo(
    () => evidenceGraph.nodes.filter((n) => n.type === 'asset'),
    [evidenceGraph.nodes]
  );
  const subsystemNodes = useMemo(
    () => evidenceGraph.nodes.filter((n) => n.type === 'subsystem'),
    [evidenceGraph.nodes]
  );
  const eventNodes = useMemo(
    () => evidenceGraph.nodes.filter((n) => n.type === 'event'),
    [evidenceGraph.nodes]
  );
  const factorNodes = useMemo(
    () => evidenceGraph.nodes.filter((n) => n.type === 'risk_factor'),
    [evidenceGraph.nodes]
  );

  // Calculate total risk factor points
  const totalFactorPoints = useMemo(() => {
    return factorNodes.reduce((sum, f) => sum + (Number(f.metadata?.points) || 0), 0);
  }, [factorNodes]);

  const displayRiskScore = riskScore !== undefined ? riskScore : Math.round(totalFactorPoints);
  const displayRiskLevel =
    riskLevel ||
    (displayRiskScore >= 80
      ? 'CRITICAL'
      : displayRiskScore >= 60
      ? 'HIGH'
      : displayRiskScore >= 40
      ? 'MEDIUM'
      : 'LOW');

  // Compute node layouts and positions
  const { layoutMap, canvasWidth, canvasHeight } = useMemo(() => {
    const map = new Map<string, NodeLayout>();

    // Dynamically scale width to available container width minus padding (32px for p-4)
    // Cleanly adapts between 880px and 1180px
    const availableWidth = Math.max(880, containerWidth - 32);
    const computedWidth = Math.min(1180, availableWidth);
    const computedHeight = 650;

    // Dynamically adjust card widths and horizontal padding based on computed width
    const isCompact = computedWidth < 1050;
    const cardWidthEvent = isCompact ? 152 : 172;
    const cardWidthFactor = isCompact ? 152 : 172;
    const pad = isCompact ? 24 : 40;

    // Tier 0: Asset
    const assetY = 32;
    const assetW = isCompact ? 200 : 230;
    const assetH = 58;
    assetNodes.forEach((node, i) => {
      const cx =
        assetNodes.length === 1
          ? computedWidth / 2
          : (computedWidth / (assetNodes.length + 1)) * (i + 1);
      map.set(node.id, {
        node,
        x: cx,
        y: assetY + assetH / 2,
        left: cx - assetW / 2,
        top: assetY,
        width: assetW,
        height: assetH,
        tier: 0
      });
    });

    // Tier 1: Subsystem
    const subY = 146;
    const subW = isCompact ? 200 : 230;
    const subH = 58;
    subsystemNodes.forEach((node, i) => {
      const cx =
        subsystemNodes.length === 1
          ? computedWidth / 2
          : (computedWidth / (subsystemNodes.length + 1)) * (i + 1);
      map.set(node.id, {
        node,
        x: cx,
        y: subY + subH / 2,
        left: cx - subW / 2,
        top: subY,
        width: subW,
        height: subH,
        tier: 1
      });
    });

    // Tier 2: Events (Distributed horizontally)
    const eventY = 268;
    const eventH = 86;
    eventNodes.forEach((node, i) => {
      let cx: number;
      let left: number;
      if (eventNodes.length === 1) {
        cx = computedWidth / 2;
        left = cx - cardWidthEvent / 2;
      } else {
        const avail = computedWidth - 2 * pad - cardWidthEvent;
        left = pad + (avail / (eventNodes.length - 1)) * i;
        cx = left + cardWidthEvent / 2;
      }
      map.set(node.id, {
        node,
        x: cx,
        y: eventY + eventH / 2,
        left,
        top: eventY,
        width: cardWidthEvent,
        height: eventH,
        tier: 2
      });
    });

    // Tier 3: Risk Factors (Distributed horizontally)
    const factorY = 426;
    const factorH = 68;
    factorNodes.forEach((node, i) => {
      let cx: number;
      let left: number;
      if (factorNodes.length === 1) {
        cx = computedWidth / 2;
        left = cx - cardWidthFactor / 2;
      } else {
        const avail = computedWidth - 2 * pad - cardWidthFactor;
        left = pad + (avail / (factorNodes.length - 1)) * i;
        cx = left + cardWidthFactor / 2;
      }
      map.set(node.id, {
        node,
        x: cx,
        y: factorY + factorH / 2,
        left,
        top: factorY,
        width: cardWidthFactor,
        height: factorH,
        tier: 3
      });
    });

    return { layoutMap: map, canvasWidth: computedWidth, canvasHeight: computedHeight };
  }, [assetNodes, subsystemNodes, eventNodes, factorNodes, containerWidth]);

  // Find connected neighbors and edges for the currently hovered node
  const { connectedEdgeIndices, connectedNeighborNodeIds } = useMemo(() => {
    if (!hoveredNodeId) {
      return { connectedEdgeIndices: new Set<number>(), connectedNeighborNodeIds: new Set<string>() };
    }
    const edgeIndices = new Set<number>();
    const neighborIds = new Set<string>([hoveredNodeId]);

    evidenceGraph.edges.forEach((edge, idx) => {
      if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
        edgeIndices.add(idx);
        neighborIds.add(edge.source);
        neighborIds.add(edge.target);
      }
    });

    return { connectedEdgeIndices: edgeIndices, connectedNeighborNodeIds: neighborIds };
  }, [hoveredNodeId, evidenceGraph.edges]);

  // Connected edges for the selected node drawer
  const selectedNodeRelationships = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };
    const incoming: { edge: EvidenceGraphEdge; node: EvidenceGraphNode }[] = [];
    const outgoing: { edge: EvidenceGraphEdge; node: EvidenceGraphNode }[] = [];

    const nodeDict = new Map(evidenceGraph.nodes.map((n) => [n.id, n]));

    evidenceGraph.edges.forEach((edge) => {
      if (edge.target === selectedNode.id && nodeDict.has(edge.source)) {
        incoming.push({ edge, node: nodeDict.get(edge.source)! });
      }
      if (edge.source === selectedNode.id && nodeDict.has(edge.target)) {
        outgoing.push({ edge, node: nodeDict.get(edge.target)! });
      }
    });

    return { incoming, outgoing };
  }, [selectedNode, evidenceGraph]);

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
            EVIDENCE RELATIONSHIP MAP
          </h2>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            {eventNodes.length} SIGNALS · {subsystemNodes.length} SUBSYSTEM · {factorNodes.length} RISK FACTORS
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtle View mode toggle */}
          <div className="flex items-center gap-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Graph View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Matrix View
            </button>
          </div>
        </div>
      </div>

      {/* Main content based on viewMode */}
      {viewMode === 'map' ? (
        <div className="space-y-3">
          {/* Minimal helper line */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
            <span>Hover node to trace relationships · Click to inspect metadata</span>
            {selectedNode && (
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-slate-600 hover:text-slate-900 underline font-mono cursor-pointer"
              >
                Reset Selection
              </button>
            )}
          </div>

          {/* Canvas container with responsive width measurement */}
          <div
            ref={containerRef}
            className="overflow-x-auto overflow-y-hidden rounded-lg border border-slate-200 bg-slate-50/70 p-4"
          >
            <div
              className="relative mx-auto"
              style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
            >
              {/* SVG Layer: Renders all 15 dynamic edges + convergence paths */}
              <svg
                className="absolute inset-0 pointer-events-none w-full h-full"
                width={canvasWidth}
                height={canvasHeight}
                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              >
                <defs>
                  {/* Arrowhead markers */}
                  <marker
                    id="arrow-subsystem"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" />
                  </marker>
                  <marker
                    id="arrow-correlate"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                  <marker
                    id="arrow-temporal"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                  </marker>
                  <marker
                    id="arrow-factor"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#e11d48" />
                  </marker>
                  <marker
                    id="arrow-active"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="#ea580c" />
                  </marker>

                  {/* Dot grid pattern for background */}
                  <pattern
                    id="graph-grid"
                    width="24"
                    height="24"
                    patternUnits="userSpaceOnUse"
                  >
                    <circle cx="2" cy="2" r="0.75" fill="#cbd5e1" opacity="0.6" />
                  </pattern>
                </defs>

                {/* Tactical grid background */}
                <rect width={canvasWidth} height={canvasHeight} fill="url(#graph-grid)" />

                {/* Subtle Convergence Guide Lines from Factors to Outcome Anchor */}
                {factorNodes.map((factorNode) => {
                  const factorLayout = layoutMap.get(factorNode.id);
                  if (!factorLayout) return null;
                  const outcomeX = canvasWidth / 2;
                  const outcomeY = 560;
                  const isHighlighted =
                    hoveredNodeId === factorNode.id ||
                    (hoveredNodeId && factorLayout.node.id === hoveredNodeId);

                  const pathD = `M ${factorLayout.x} ${factorLayout.top + factorLayout.height} C ${
                    factorLayout.x
                  } 530, ${outcomeX} 530, ${outcomeX} ${outcomeY}`;

                  return (
                    <path
                      key={`convergence-${factorNode.id}`}
                      d={pathD}
                      fill="none"
                      stroke={isHighlighted ? '#ea580c' : '#94a3b8'}
                      strokeWidth={isHighlighted ? 2 : 1.25}
                      strokeDasharray="4 3"
                      strokeOpacity={isHighlighted ? 0.9 : 0.4}
                      className="transition-all duration-200"
                    />
                  );
                })}

                {/* Render the 15 dynamic edges from API */}
                {evidenceGraph.edges.map((edge, idx) => {
                  const source = layoutMap.get(edge.source);
                  const target = layoutMap.get(edge.target);
                  if (!source || !target) return null;

                  const isHighlighted =
                    connectedEdgeIndices.has(idx) ||
                    (selectedNode &&
                      (edge.source === selectedNode.id || edge.target === selectedNode.id));
                  const isDimmed =
                    (hoveredNodeId && !connectedEdgeIndices.has(idx)) ||
                    (selectedNode &&
                      edge.source !== selectedNode.id &&
                      edge.target !== selectedNode.id);

                  let pathD = '';
                  let strokeColor = '#94a3b8';
                  let strokeWidth = 1.25;
                  let strokeDash = 'none';
                  let markerEnd = '';

                  if (edge.relation === 'has_subsystem_focus') {
                    // Vertical link: Asset -> Subsystem
                    pathD = `M ${source.x} ${source.top + source.height} L ${target.x} ${target.top}`;
                    strokeColor = isHighlighted ? '#ea580c' : '#0284c7';
                    strokeWidth = isHighlighted ? 2 : 1.5;
                    markerEnd = isHighlighted ? 'url(#arrow-active)' : 'url(#arrow-subsystem)';
                  } else if (edge.relation === 'correlates_signal') {
                    // Tree branching curve: Subsystem -> Event
                    const midY = (source.top + source.height + target.top) / 2;
                    pathD = `M ${source.x} ${source.top + source.height} C ${source.x} ${midY}, ${
                      target.x
                    } ${midY}, ${target.x} ${target.top}`;
                    strokeColor = isHighlighted ? '#ea580c' : '#0284c7';
                    strokeWidth = isHighlighted ? 2 : 1.25;
                    markerEnd = isHighlighted ? 'url(#arrow-active)' : 'url(#arrow-correlate)';
                  } else if (edge.relation === 'temporal_sequence') {
                    // Horizontal directional sequence link: Event_i -> Event_i+1
                    const startX = source.left + source.width;
                    const startY = source.y;
                    const endX = target.left;
                    const endY = target.y;
                    pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
                    strokeColor = isHighlighted ? '#ea580c' : '#d97706';
                    strokeWidth = isHighlighted ? 2 : 1.5;
                    strokeDash = '5 3';
                    markerEnd = isHighlighted ? 'url(#arrow-active)' : 'url(#arrow-temporal)';
                  } else if (edge.relation === 'triggers_risk_factor') {
                    // Direct conduit curve: Subsystem -> Factor
                    const startX = source.x;
                    const startY = source.top + source.height;
                    const endX = target.x;
                    const endY = target.top;
                    pathD = `M ${startX} ${startY} C ${startX} 320, ${endX} 360, ${endX} ${endY}`;
                    strokeColor = isHighlighted ? '#ea580c' : '#e11d48';
                    strokeWidth = isHighlighted ? 2 : 1.25;
                    strokeDash = '6 3';
                    markerEnd = isHighlighted ? 'url(#arrow-active)' : 'url(#arrow-factor)';
                  }

                  return (
                    <g key={`edge-${idx}-${edge.source}-${edge.target}`}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDash}
                        strokeOpacity={isDimmed ? 0.15 : isHighlighted ? 1 : 0.65}
                        markerEnd={markerEnd}
                        className="transition-all duration-200"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Node Layer: Interactive HTML Cards positioned via computed coordinates */}
              {Array.from(layoutMap.values()).map(({ node, left, top, width, height, tier }) => {
                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isNeighbor = connectedNeighborNodeIds.has(node.id);
                const isDimmed = hoveredNodeId && !isHovered && !isNeighbor;
                const isHighlightedSignal =
                  highlightedEventIds.length > 0 &&
                  (highlightedEventIds.includes(node.id) ||
                    (node.metadata?.event_id && highlightedEventIds.includes(node.metadata.event_id)) ||
                    highlightedEventIds.includes(node.id.replace('event-', '')));

                return (
                  <div
                    key={node.id}
                    onClick={() => {
                      setSelectedNode(node);
                      if (onSelectEventId) {
                        const evId =
                          node.metadata?.event_id ||
                          (node.type === 'event' ? node.id.replace('event-', '') : null);
                        if (evId) onSelectEventId(evId);
                      }
                    }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: `${top}px`,
                      width: `${width}px`,
                      height: `${height}px`
                    }}
                    className={`rounded-lg border cursor-pointer transition-all duration-150 select-none flex flex-col justify-between p-2.5 ${
                      isDimmed
                        ? 'opacity-30 scale-[0.98]'
                        : isSelected
                        ? 'border-orange-600 bg-orange-50/40 ring-1 ring-orange-600 shadow-sm z-30'
                        : isHighlightedSignal
                        ? 'border-orange-500 bg-orange-50/40 ring-1 ring-orange-500 shadow-sm z-30'
                        : isHovered
                        ? 'border-orange-500 bg-white shadow-md z-20'
                        : isNeighbor
                        ? 'border-slate-300 bg-slate-50/80 shadow-xs z-10'
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    {/* Render node content specifically by tier */}
                    {tier === 0 && (
                      // TIER 0: Asset Node
                      <div className="h-full flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-orange-600 font-bold flex items-center gap-1">
                            <Activity className="w-3 h-3 text-orange-600" />
                            Target Asset
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                            {node.metadata?.status || 'Active'}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="font-bold text-slate-900 text-xs tracking-tight">
                            {node.label}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {node.metadata?.depot_location || 'North Depot'}
                          </span>
                        </div>
                      </div>
                    )}

                    {tier === 1 && (
                      // TIER 1: Subsystem Node
                      <div className="h-full flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-sky-700 font-bold flex items-center gap-1">
                            <Layers className="w-3 h-3 text-sky-700" />
                            Common Subsystem
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200">
                            Focus Subsystem
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="font-bold text-slate-900 text-xs tracking-tight">
                            {node.label}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono font-medium">
                            {node.metadata?.event_count || 5} signals converged
                          </span>
                        </div>
                      </div>
                    )}

                    {tier === 2 && (
                      // TIER 2: Signal / Event Node
                      <div className="h-full flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            {getEventRoleIcon(node.metadata?.reporter_role)}
                            <span className="text-[9px] font-mono uppercase text-slate-500 truncate max-w-[85px]">
                              {node.metadata?.reporter_role || 'reporter'}
                            </span>
                          </div>
                          {getSeverityBadge(node.metadata?.severity)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-[11px] truncate">
                            {node.label.split('(')[0].trim()}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                            {node.metadata?.description || node.metadata?.source}
                          </p>
                        </div>
                      </div>
                    )}

                    {tier === 3 && (
                      // TIER 3: Risk Factor Node
                      <div className="h-full flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-rose-700 font-bold flex items-center gap-1">
                            <Zap className="w-3 h-3 text-rose-600" />
                            Factor
                          </span>
                          <span className="text-[10px] font-mono text-orange-700 font-bold bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200">
                            +{Number(node.metadata?.points || 0).toFixed(1)}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-900 text-[11px] leading-tight mt-1">
                          {node.label}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* TIER 4: Terminal Convergence Risk Outcome Anchor */}
              <div
                style={{
                  position: 'absolute',
                  left: `${canvasWidth / 2 - 160}px`,
                  top: '560px',
                  width: '320px',
                  height: '54px'
                }}
                className="rounded-lg border border-slate-200 bg-white flex items-center justify-between px-4 py-2 select-none shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-red-50 text-red-600 border border-red-200">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      Compounded Risk Synthesis
                    </div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Risk {displayRiskScore}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-50 text-red-700 border border-red-200 font-semibold">
                        {displayRiskLevel}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-orange-700 font-bold block">
                    {factorNodes.length} Factors
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono block">
                    Correlated Pattern
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Topology Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-slate-400 uppercase font-semibold text-[10px]">Legend:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                <span className="text-slate-700">Correlated Signal</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500" />
                <span className="text-slate-700">Temporal Sequence</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-rose-500" />
                <span className="text-slate-700">Triggers Factor</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-orange-500" />
                <span className="text-slate-700">Risk Rollup</span>
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              Total Points: <strong className="text-orange-700 font-semibold">+{totalFactorPoints.toFixed(1)} pts</strong>
            </div>
          </div>
        </div>
      ) : (
        /* Matrix View: 4-Column Structured Layout (Preserves previous view) */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2">
          {/* Column 1: Monitored Asset */}
          <div className="space-y-3">
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 px-1">
              1. Target Asset
            </div>
            {assetNodes.map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                  selectedNode?.id === node.id
                    ? 'border-orange-600 bg-orange-50/40 ring-1 ring-orange-600'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1 rounded bg-slate-100 text-slate-700">
                    <Activity className="w-3.5 h-3.5 text-orange-600" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">{node.label}</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  {node.metadata?.depot_location || 'North Depot'}
                </p>
              </div>
            ))}
          </div>

          {/* Column 2: Correlated Subsystem */}
          <div className="space-y-3">
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 px-1">
              2. Common Subsystem
            </div>
            {subsystemNodes.map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                  selectedNode?.id === node.id
                    ? 'border-orange-600 bg-orange-50/40 ring-1 ring-orange-600'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1 rounded bg-slate-100 text-slate-700">
                    <Layers className="w-3.5 h-3.5 text-sky-700" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">{node.label}</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  {node.metadata?.event_count || 0} signals converged
                </p>
              </div>
            ))}
          </div>

          {/* Column 3: Multi-Source Signals */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 px-1">
              3. Independent Signals ({eventNodes.length})
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {eventNodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all text-xs ${
                    selectedNode?.id === node.id
                      ? 'border-orange-600 bg-orange-50/40 ring-1 ring-orange-600'
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-slate-900 text-xs truncate">
                      {node.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-700 font-bold px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200">
                      Sev {node.metadata?.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1">
                    {node.metadata?.description || node.metadata?.source}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Column 4: Triggered Risk Factors */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 px-1">
              4. Activated Factors ({factorNodes.length})
            </div>
            <div className="space-y-2">
              {factorNodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all text-xs ${
                    selectedNode?.id === node.id
                      ? 'border-orange-600 bg-orange-50/40 ring-1 ring-orange-600'
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-rose-600" />
                      <span className="font-semibold text-slate-900">{node.label}</span>
                    </div>
                    <span className="font-mono text-orange-700 font-bold">
                      +{Number(node.metadata?.points || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 shadow-xs transition-all text-xs">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded bg-white text-orange-600 border border-slate-200 shadow-xs">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm uppercase">
                    {selectedNode.label}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-semibold">
                    Type: {selectedNode.type}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Node ID: {selectedNode.id}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>

          {/* Node Metadata & Description */}
          {selectedNode.metadata?.description && (
            <div className="mb-3 p-2.5 rounded bg-white border border-slate-200 text-slate-700 leading-relaxed">
              <span className="text-slate-500 font-semibold block mb-0.5 font-mono text-[10px] uppercase">
                Incident Summary:
              </span>
              {selectedNode.metadata.description}
            </div>
          )}

          {/* Metadata Attribute Badges */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-600 mb-3">
            {selectedNode.metadata?.source && (
              <span className="p-1 px-2 rounded bg-white border border-slate-200">
                Source: <strong className="text-slate-900">{selectedNode.metadata.source}</strong>
              </span>
            )}
            {selectedNode.metadata?.reporter_role && (
              <span className="p-1 px-2 rounded bg-white border border-slate-200">
                Role: <strong className="text-slate-900">{selectedNode.metadata.reporter_role}</strong>
              </span>
            )}
            {selectedNode.metadata?.severity && (
              <span className="p-1 px-2 rounded bg-white border border-slate-200">
                Severity: <strong className="text-orange-700">Level {selectedNode.metadata.severity}</strong>
              </span>
            )}
            {selectedNode.metadata?.points !== undefined && (
              <span className="p-1 px-2 rounded bg-white border border-slate-200">
                Factor Contribution: <strong className="text-orange-700">+{Number(selectedNode.metadata.points).toFixed(1)} pts</strong>
              </span>
            )}
            {selectedNode.metadata?.timestamp && (
              <span className="p-1 px-2 rounded bg-white border border-slate-200 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Timestamp: </span>
                <strong className="text-slate-900">
                  {selectedNode.metadata.timestamp.slice(0, 19).replace('T', ' ')}
                </strong>
              </span>
            )}
          </div>

          {/* Connected Graph Relationships */}
          <div className="border-t border-slate-200 pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="text-slate-400 uppercase text-[10px]">Relationships:</span>
              <span className="text-slate-700">
                {selectedNodeRelationships.incoming.length} incoming, {selectedNodeRelationships.outgoing.length} outgoing
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedNodeRelationships.outgoing.map(({ edge, node }) => (
                <button
                  key={`out-${edge.target}`}
                  onClick={() => setSelectedNode(node)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 cursor-pointer"
                >
                  <ArrowRight className="w-3 h-3 text-orange-600" />
                  <span className="truncate max-w-[120px]">{node.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
