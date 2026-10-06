import React from 'react';
import { Layers, ShieldCheck, Zap, Repeat, Clock, AlertOctagon } from 'lucide-react';

interface FactorWaterfallProps {
  factorBreakdown: {
    base_severity_points: number;
    frequency_penalty_points: number;
    cross_source_bonus_points: number;
    temporal_acceleration_points: number;
    near_miss_anchor_points: number;
    cross_subsystem_spillover?: number;
    total_score: number;
  };
}

export const FactorWaterfall: React.FC<FactorWaterfallProps> = ({ factorBreakdown }) => {
  const factors = [
    {
      label: 'Base Severity & Recency',
      description: 'Exponential time-decay weighted by event severities (t½ = 10 days)',
      points: factorBreakdown.base_severity_points,
      maxPoints: 25.0,
      color: 'bg-blue-500',
      textColor: 'text-blue-400',
      icon: <Layers className="w-4 h-4 text-blue-400" />,
    },
    {
      label: 'Event Frequency Penalty',
      description: 'Compounding penalty for repeated warning signals on same subsystem',
      points: factorBreakdown.frequency_penalty_points,
      maxPoints: 16.0,
      color: 'bg-purple-500',
      textColor: 'text-purple-400',
      icon: <Repeat className="w-4 h-4 text-purple-400" />,
    },
    {
      label: 'Cross-Source Corroboration',
      description: 'Multi-source bonus: independent reporting roles confirming the same fault',
      points: factorBreakdown.cross_source_bonus_points,
      maxPoints: 20.0,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-400',
      icon: <ShieldCheck className="w-4 h-4 text-indigo-400" />,
    },
    {
      label: 'Temporal Acceleration',
      description: 'Contracting time intervals between consecutive signals + escalating severity',
      points: factorBreakdown.temporal_acceleration_points,
      maxPoints: 15.0,
      color: 'bg-orange-500',
      textColor: 'text-orange-400',
      icon: <Clock className="w-4 h-4 text-orange-400" />,
    },
    {
      label: 'Near-Miss / Critical Anchor',
      description: 'High-severity safety flag from near-miss or critical hazard classification',
      points: factorBreakdown.near_miss_anchor_points,
      maxPoints: 10.0,
      color: 'bg-red-500',
      textColor: 'text-red-400',
      icon: <AlertOctagon className="w-4 h-4 text-red-400" />,
    },
  ];

  if ((factorBreakdown.cross_subsystem_spillover || 0) > 0) {
    factors.push({
      label: 'Cross-Subsystem Spillover',
      description: 'Secondary risk accumulation from other vehicle subsystems',
      points: factorBreakdown.cross_subsystem_spillover || 0,
      maxPoints: 10.0,
      color: 'bg-slate-500',
      textColor: 'text-slate-400',
      icon: <Zap className="w-4 h-4 text-slate-400" />,
    });
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            MATHEMATICAL FACTOR WATERFALL
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            100% transparent, explainable breakdown showing exactly where points originate
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase font-mono text-slate-400">Total Risk Score</span>
          <div className="text-2xl font-black font-mono text-orange-400">
            {Math.round(factorBreakdown.total_score)}
            <span className="text-sm text-slate-500 font-normal"> / 100</span>
          </div>
        </div>
      </div>

      {/* Factor Bars */}
      <div className="space-y-4">
        {factors.map((f) => {
          const pct = Math.min(100, Math.round((f.points / (f.maxPoints || 1)) * 100));
          return (
            <div key={f.label} className="p-3 rounded-lg bg-slate-950/60 border border-slate-850">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2 font-medium text-slate-200">
                  <div className="p-1 rounded bg-slate-900 border border-slate-800">{f.icon}</div>
                  <div>
                    <span className="font-semibold">{f.label}</span>
                    <span className="text-[11px] text-slate-400 block font-normal">
                      {f.description}
                    </span>
                  </div>
                </div>
                <div className="text-right font-mono flex items-center gap-1.5 pl-4">
                  <span className={`text-sm font-bold ${f.textColor}`}>
                    +{f.points.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-slate-500">/ {f.maxPoints} pts</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full rounded-full ${f.color} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
