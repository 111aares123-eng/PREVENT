import React from 'react';
import type { RiskLevel } from '../../types/api';

interface RecommendedActionCardProps {
  recommendedAction: string;
  riskLevel: RiskLevel;
}

export const RecommendedActionCard: React.FC<RecommendedActionCardProps> = ({
  recommendedAction,
  riskLevel,
}) => {
  const isHigh = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';

  return (
    <section
      className={`rounded-lg p-5 border transition-all ${
        isHigh
          ? 'bg-rose-50/60 border-rose-300 text-rose-950'
          : 'bg-slate-50 border-slate-200 text-slate-900'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                isHigh ? 'text-rose-700' : 'text-slate-600'
              }`}
            >
              RECOMMENDED OPERATIONAL ACTION
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              · Prescriptive Directive
            </span>
          </div>

          <p className="text-sm font-semibold leading-relaxed">
            {recommendedAction}
          </p>

          <p className="text-[11px] text-slate-500 pt-1 font-mono">
            Direct dispatch guidance based on accumulated multi-source subsystem telemetry.
          </p>
        </div>

        <div className="shrink-0 self-start sm:self-center">
          <button
            type="button"
            className="px-3.5 py-1.5 rounded text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            Review Inspection Protocol
          </button>
        </div>
      </div>
    </section>
  );
};
