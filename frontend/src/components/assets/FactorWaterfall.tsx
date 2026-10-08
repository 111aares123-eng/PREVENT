import React from 'react';

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
      label: 'Severity & Recency',
      description: 'Exponential recency decay weighted by severity (t½ = 10d)',
      points: factorBreakdown.base_severity_points,
      maxPoints: 25.0,
    },
    {
      label: 'Cross-Source Corroboration',
      description: 'Independent reporting perspectives confirming subsystem fault',
      points: factorBreakdown.cross_source_bonus_points,
      maxPoints: 20.0,
    },
    {
      label: 'Event Frequency Penalty',
      description: 'Compounding penalty for repeated warning signals',
      points: factorBreakdown.frequency_penalty_points,
      maxPoints: 16.0,
    },
    {
      label: 'Temporal Escalation',
      description: 'Contracting time intervals between consecutive signals',
      points: factorBreakdown.temporal_acceleration_points,
      maxPoints: 15.0,
    },
    {
      label: 'Near-Miss Anchor',
      description: 'Critical safety event or near-miss classification',
      points: factorBreakdown.near_miss_anchor_points,
      maxPoints: 10.0,
    },
  ];

  if ((factorBreakdown.cross_subsystem_spillover || 0) > 0) {
    factors.push({
      label: 'Cross-Subsystem Spillover',
      description: 'Secondary risk accumulation from adjacent subsystems',
      points: factorBreakdown.cross_subsystem_spillover || 0,
      maxPoints: 10.0,
    });
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
            RISK FACTOR BREAKDOWN
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mathematical point allocation from deterministic evaluation engine
          </p>
        </div>

        <div className="text-right font-mono">
          <span className="text-xs text-slate-400 uppercase mr-2">Total Score:</span>
          <span className="text-lg font-bold text-slate-900">
            {Math.round(factorBreakdown.total_score)}
          </span>
        </div>
      </div>

      {/* Subtle Waterfall Bars */}
      <div className="space-y-3 pt-1">
        {factors.map((f) => {
          const pct = Math.min(100, Math.round((f.points / (f.maxPoints || 1)) * 100));
          return (
            <div key={f.label} className="space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-800">{f.label}</span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline ml-2">
                    · {f.description}
                  </span>
                </div>
                <div className="font-mono text-right pl-3 shrink-0">
                  <span className="font-bold text-slate-900">
                    +{f.points.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">/ {f.maxPoints}</span>
                </div>
              </div>

              {/* Minimal bar */}
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-700 rounded-full transition-all duration-300"
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
