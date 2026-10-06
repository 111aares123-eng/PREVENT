import React, { useState } from 'react';
import { GitFork, Layers, Zap, Activity, Info } from 'lucide-react';
import type { EvidenceGraphData, EvidenceGraphNode } from '../../types/api';

interface EvidenceGraphViewProps {
  evidenceGraph: EvidenceGraphData;
}

export const EvidenceGraphView: React.FC<EvidenceGraphViewProps> = ({ evidenceGraph }) => {
  const [selectedNode, setSelectedNode] = useState<EvidenceGraphNode | null>(null);

  // Group nodes by type
  const assetNodes = evidenceGraph.nodes.filter((n) => n.type === 'asset');
  const subsystemNodes = evidenceGraph.nodes.filter((n) => n.type === 'subsystem');
  const eventNodes = evidenceGraph.nodes.filter((n) => n.type === 'event');
  const factorNodes = evidenceGraph.nodes.filter((n) => n.type === 'risk_factor');

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <GitFork className="w-4 h-4 text-orange-400" />
            EVIDENCE RELATIONSHIP GRAPH
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-source signal convergence proving independent reports link to the same risk pattern
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500">
          {evidenceGraph.nodes.length} entities • {evidenceGraph.edges.length} relationships
        </span>
      </div>

      {/* Visual Relationship Flow Columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2">
        {/* Column 1: Monitored Asset */}
        <div className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
            1. Target Asset
          </div>
          {assetNodes.map((node) => (
            <div
              key={node.id}
              onClick={() => setSelectedNode(node)}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                selectedNode?.id === node.id
                  ? 'border-orange-500 bg-orange-950/30'
                  : 'border-slate-700 bg-slate-950/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1 rounded bg-slate-800 text-slate-300">
                  <Activity className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <span className="font-bold text-white text-xs">{node.label}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {node.metadata?.depot_location || 'North Depot'}
              </p>
            </div>
          ))}
        </div>

        {/* Column 2: Correlated Subsystem */}
        <div className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
            2. Common Subsystem
          </div>
          {subsystemNodes.map((node) => (
            <div
              key={node.id}
              onClick={() => setSelectedNode(node)}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                selectedNode?.id === node.id
                  ? 'border-orange-500 bg-orange-950/30'
                  : 'border-slate-700 bg-slate-950/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1 rounded bg-slate-800 text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="font-bold text-white text-xs">{node.label}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {node.metadata?.event_count || 0} signals converged
              </p>
            </div>
          ))}
        </div>

        {/* Column 3: Multi-Source Signals */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
            3. Independent Signals ({eventNodes.length})
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {eventNodes.map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all text-xs ${
                  selectedNode?.id === node.id
                    ? 'border-orange-500 bg-orange-950/30'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-slate-200 text-xs truncate">
                    {node.label}
                  </span>
                  <span className="text-[10px] font-mono text-orange-400 font-bold px-1.5 py-0.2 rounded bg-orange-950/60 border border-orange-900">
                    Sev {node.metadata?.severity}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">
                  {node.metadata?.description || node.metadata?.source}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Column 4: Triggered Risk Factors */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
            4. Activated Factors ({factorNodes.length})
          </div>
          <div className="space-y-2">
            {factorNodes.map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all text-xs ${
                  selectedNode?.id === node.id
                    ? 'border-orange-500 bg-orange-950/30'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-orange-400" />
                    <span className="font-semibold text-slate-200">{node.label}</span>
                  </div>
                  <span className="font-mono text-orange-400 font-bold">
                    +{node.metadata?.points?.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="mt-4 p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-4 text-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-3.5 h-3.5 text-orange-400" />
              <span className="font-bold text-white uppercase">{selectedNode.label}</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                Type: {selectedNode.type}
              </span>
            </div>
            {selectedNode.metadata?.description && (
              <p className="text-slate-300 mt-1">{selectedNode.metadata.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] font-mono text-slate-400">
              {selectedNode.metadata?.source && (
                <span>Source: <strong className="text-slate-200">{selectedNode.metadata.source}</strong></span>
              )}
              {selectedNode.metadata?.reporter_role && (
                <span>Role: <strong className="text-slate-200">{selectedNode.metadata.reporter_role}</strong></span>
              )}
              {selectedNode.metadata?.timestamp && (
                <span>Timestamp: <strong className="text-slate-200">{selectedNode.metadata.timestamp.slice(0, 16).replace('T', ' ')}</strong></span>
              )}
            </div>
          </div>
          <button
            onClick={() => setSelectedNode(null)}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded bg-slate-900 border border-slate-800"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};
