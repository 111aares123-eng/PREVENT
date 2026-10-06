import React from 'react';
import type { TrendDirection, RiskLevel } from '../../types/api';
import { TrendBadge } from '../risk/TrendBadge';
import { ShieldCheck, Activity } from 'lucide-react';

interface RiskScoreGaugeProps {
  score: number;
  confidence: number;
  riskLevel: RiskLevel;
  trend: TrendDirection;
  primarySubsystem: string;
}

export const RiskScoreGauge: React.FC<RiskScoreGaugeProps> = ({
  score,
  confidence,
  riskLevel,
  trend,
  primarySubsystem,
}) => {
  const isHigh = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';
  const isMedium = riskLevel === 'MEDIUM';

  const riskColor = isHigh
    ? 'text-orange-400'
    : isMedium
    ? 'text-amber-400'
    : 'text-emerald-400';

  const riskBorder = isHigh
    ? 'border-orange-600/40 bg-orange-950/20 shadow-lg shadow-orange-950/30'
    : isMedium
    ? 'border-amber-600/40 bg-amber-950/20'
    : 'border-emerald-600/40 bg-emerald-950/20';

  return (
    <div className={`rounded-xl border p-6 ${riskBorder}`}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
        {/* Metric 1: Explainable Risk Score */}
        <div className="md:border-r border-slate-800/80 pr-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            <Activity className="w-3.5 h-3.5 text-orange-400" />
            <span>EXPLAINABLE RISK SCORE</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-5xl font-black font-mono tracking-tight ${riskColor}`}>
              {Math.round(score)}
            </span>
            <span className="text-slate-400 text-sm font-mono font-medium">/ 100</span>
          </div>
          <div className="mt-2.5">
            <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isHigh ? 'bg-orange-500' : isMedium ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, score)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>0 (Safe)</span>
              <span>40 (Med)</span>
              <span>70 (High)</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Evidence Confidence */}
        <div className="md:border-r border-slate-800/80 pr-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>EVIDENCE CONFIDENCE</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-white">
              {Math.round(confidence)}%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Strength of corroborating evidence, multi-source agreement, and signal volume.
          </p>
        </div>

        {/* Metric 3: Escalation Trend */}
        <div className="md:border-r border-slate-800/80 pr-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            DIRECTIONAL TREND
          </div>
          <TrendBadge trend={trend} size="md" />
          <p className="text-xs text-slate-400 mt-2">
            Temporal interval dynamics and severity progression pattern.
          </p>
        </div>

        {/* Metric 4: Primary Subsystem */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            PRIMARY DRIVING SUBSYSTEM
          </div>
          <div className="inline-block px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-base text-white uppercase tracking-wide">
            {primarySubsystem.replace('_', ' ')}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Dominant vehicle subsystem responsible for core risk concentration.
          </p>
        </div>
      </div>
    </div>
  );
};
