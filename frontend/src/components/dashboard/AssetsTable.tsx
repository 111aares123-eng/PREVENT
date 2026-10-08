import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { FleetAssetSummary } from '../../types/api';

interface AssetsTableProps {
  assets: FleetAssetSummary[];
  title?: string;
  subtitle?: string;
  highlightAttention?: boolean;
}

export const AssetsTable: React.FC<AssetsTableProps> = ({
  assets,
  title = 'MONITORED FLEET ASSETS',
  subtitle,
  highlightAttention = false,
}) => {
  const navigate = useNavigate();
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  const filteredAssets = assets.filter((a) => {
    if (highlightAttention && a.risk_level === 'LOW') return false;
    if (filterLevel === 'ALL') return true;
    return a.risk_level === filterLevel;
  });

  const getRiskScoreColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
      case 'HIGH':
        return 'text-rose-600 font-extrabold';
      case 'MEDIUM':
        return 'text-amber-600 font-bold';
      default:
        return 'text-emerald-700 font-medium';
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            {level}
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            {level}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {level}
          </span>
        );
    }
  };

  const formatTrend = (trend: string) => {
    return trend.replace('_', ' ');
  };

  return (
    <div className="space-y-3">
      {/* Section Heading & Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-900">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Minimal filter tabs */}
        <div className="flex items-center gap-1 text-xs">
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setFilterLevel(level)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                filterLevel === level
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Clean Editorial Table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-mono uppercase tracking-wider text-slate-500">
              <th className="py-2.5 px-4 font-semibold">ASSET</th>
              <th className="py-2.5 px-4 font-semibold">RISK</th>
              <th className="py-2.5 px-4 font-semibold">TREND</th>
              <th className="py-2.5 px-4 font-semibold">SUBSYSTEM</th>
              <th className="py-2.5 px-4 font-semibold">LAST SIGNAL</th>
              <th className="py-2.5 px-4 font-semibold text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 font-mono text-xs">
                  No assets found for filter criteria.
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset) => {
                const isHigh = asset.risk_level === 'HIGH' || asset.risk_level === 'CRITICAL';
                const formattedDate = asset.latest_event_timestamp
                  ? new Date(asset.latest_event_timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';

                return (
                  <tr
                    key={asset.asset_id}
                    onClick={() => navigate(`/assets/${asset.asset_id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    {/* ASSET */}
                    <td className="py-3 px-4">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                          {asset.asset_id}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          {asset.make_model}
                        </span>
                      </div>
                    </td>

                    {/* RISK */}
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${getRiskScoreColor(asset.risk_level)}`}>
                          {Math.round(asset.risk_score)}
                        </span>
                        {getRiskBadge(asset.risk_level)}
                      </div>
                    </td>

                    {/* TREND */}
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className={isHigh ? 'text-rose-700 font-semibold' : 'text-slate-600'}>
                        {formatTrend(asset.trend)}
                      </span>
                    </td>

                    {/* SUBSYSTEM */}
                    <td className="py-3 px-4 font-mono text-xs uppercase text-slate-700">
                      {asset.primary_subsystem.replace('_', ' ')}
                    </td>

                    {/* LAST SIGNAL */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {formattedDate}
                    </td>

                    {/* ACTION */}
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 group-hover:text-amber-700 transition-colors">
                        <span>Dossier</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-amber-700" />
                      </span>
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
