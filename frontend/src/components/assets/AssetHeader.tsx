import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { AssetInfo, RiskLevel, TrendDirection } from '../../types/api';

interface AssetHeaderProps {
  asset: AssetInfo;
  riskLevel: RiskLevel;
  riskScore: number;
  trend: TrendDirection;
  primarySubsystem: string;
  confidence: number;
}

export const AssetHeader: React.FC<AssetHeaderProps> = ({
  asset,
  riskLevel,
  riskScore,
  trend,
  primarySubsystem,
  confidence,
}) => {
  const isHigh = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';
  const isMedium = riskLevel === 'MEDIUM';

  const riskColor = isHigh
    ? 'text-rose-600'
    : isMedium
    ? 'text-amber-600'
    : 'text-emerald-700';

  const formatTrend = (t: string) => t.replace('_', ' ');

  return (
    <div className="border-b border-slate-200 pb-6 bg-white p-6 rounded-lg border">
      {/* Return link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors mb-4 font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Fleet Overview</span>
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        {/* Left: Asset Identity */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
              {asset.asset_id}
            </h1>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 border border-slate-200 px-2 py-0.5 rounded bg-slate-50">
              {asset.status.replace('_', ' ')}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1.5 font-sans">
            {asset.make_model} • {asset.depot_location} • <strong className="font-semibold uppercase text-slate-700">{asset.criticality} Criticality</strong>
          </p>
        </div>

        {/* Right: Key Safety Metrics Bar (Clean, Non-Card Strip) */}
        <div className="flex flex-wrap items-baseline gap-6 sm:gap-8 font-mono border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
          <div>
            <span className="block text-[10px] uppercase font-sans tracking-wider text-slate-500 font-semibold">
              Risk Score
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-4xl font-extrabold ${riskColor}`}>
                {Math.round(riskScore)}
              </span>
              <span className="text-xs text-slate-500 font-sans">/ 100</span>
            </div>
          </div>

          <div className="border-l border-slate-200 pl-6 sm:pl-8">
            <span className="block text-[10px] uppercase font-sans tracking-wider text-slate-500 font-semibold">
              Assessment
            </span>
            <div className="mt-0.5">
              <span className={`text-sm font-bold tracking-tight block ${riskColor}`}>
                {riskLevel} RISK
              </span>
              <span className="text-[11px] text-slate-600 block">
                {formatTrend(trend)}
              </span>
            </div>
          </div>

          <div className="border-l border-slate-200 pl-6 sm:pl-8">
            <span className="block text-[10px] uppercase font-sans tracking-wider text-slate-500 font-semibold">
              Focus Subsystem
            </span>
            <span className="text-sm font-bold text-slate-800 uppercase block mt-0.5">
              {primarySubsystem.replace('_', ' ')}
            </span>
            <span className="text-[11px] text-slate-600 font-sans block">
              Primary Convergence
            </span>
          </div>

          <div className="border-l border-slate-200 pl-6 sm:pl-8">
            <span className="block text-[10px] uppercase font-sans tracking-wider text-slate-500 font-semibold">
              Evidence Confidence
            </span>
            <span className="text-sm font-bold text-slate-900 block mt-0.5">
              {Math.round(confidence)}%
            </span>
            <span className="text-[11px] text-slate-600 font-sans block">
              Corroborated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
