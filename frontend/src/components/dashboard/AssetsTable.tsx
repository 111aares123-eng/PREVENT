import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Filter, ShieldAlert } from 'lucide-react';
import type { FleetAssetSummary } from '../../types/api';
import { RiskBadge } from '../risk/RiskBadge';
import { TrendBadge } from '../risk/TrendBadge';

interface AssetsTableProps {
  assets: FleetAssetSummary[];
  title?: string;
  subtitle?: string;
  highlightAttention?: boolean;
}

export const AssetsTable: React.FC<AssetsTableProps> = ({
  assets,
  title = 'MONITORED FLEET ASSETS',
  subtitle = 'Click any asset row to view complete safety intelligence dossier and factor waterfall',
  highlightAttention = false,
}) => {
  const navigate = useNavigate();
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  const filteredAssets = assets.filter((a) => {
    if (filterLevel === 'ALL') return true;
    return a.risk_level === filterLevel;
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              {title}
            </h2>
            {highlightAttention && (
              <span className="text-xs bg-orange-950/70 border border-orange-700/60 text-orange-400 font-semibold px-2 py-0.5 rounded-full">
                Attention Required
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  filterLevel === level
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800/80">
            <tr>
              <th className="py-3 px-5">Asset</th>
              <th className="py-3 px-4">Risk Score</th>
              <th className="py-3 px-4">Risk Level</th>
              <th className="py-3 px-4">Evidence Confidence</th>
              <th className="py-3 px-4">Trend</th>
              <th className="py-3 px-4">Primary Subsystem</th>
              <th className="py-3 px-4">Recommended Action</th>
              <th className="py-3 px-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No assets match the current filter.
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset) => {
                const isHigh = asset.risk_level === 'HIGH' || asset.risk_level === 'CRITICAL';
                return (
                  <tr
                    key={asset.asset_id}
                    onClick={() => navigate(`/assets/${asset.asset_id}`)}
                    className={`cursor-pointer transition-colors group ${
                      isHigh
                        ? 'hover:bg-orange-950/20 bg-orange-950/5'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Asset ID & Model */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isHigh
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {asset.asset_id.split('-')[0]}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm group-hover:text-orange-400 transition-colors flex items-center gap-1.5">
                            {asset.asset_id}
                            {isHigh && <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />}
                          </div>
                          <div className="text-slate-400 text-xs">
                            {asset.make_model} • {asset.depot_location}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Risk Score */}
                    <td className="py-3.5 px-4 font-mono font-bold text-base">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            isHigh
                              ? 'text-orange-400 text-lg font-extrabold'
                              : asset.risk_level === 'MEDIUM'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }
                        >
                          {Math.round(asset.risk_score)}
                        </span>
                        <span className="text-slate-500 text-xs font-normal">/ 100</span>
                      </div>
                      <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full ${
                            isHigh
                              ? 'bg-orange-500'
                              : asset.risk_level === 'MEDIUM'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, asset.risk_score)}%` }}
                        />
                      </div>
                    </td>

                    {/* Risk Level */}
                    <td className="py-3.5 px-4">
                      <RiskBadge level={asset.risk_level} />
                    </td>

                    {/* Confidence */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="text-slate-200 font-semibold">
                        {Math.round(asset.confidence)}%
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {asset.total_events_count} signals
                      </div>
                    </td>

                    {/* Trend */}
                    <td className="py-3.5 px-4">
                      <TrendBadge trend={asset.trend} size="sm" />
                    </td>

                    {/* Primary Subsystem */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-1 rounded bg-slate-800 border border-slate-700/80 font-mono text-slate-200 uppercase text-xs">
                        {asset.primary_subsystem.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Recommended Action */}
                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-300 text-xs">
                      {asset.recommended_action}
                    </td>

                    {/* Right Chevron */}
                    <td className="py-3.5 px-3 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-orange-400 transition-colors inline" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
