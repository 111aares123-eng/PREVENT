import React from 'react';
import { AlertTriangle, CheckSquare, Wrench } from 'lucide-react';
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
    <div
      className={`rounded-xl border p-5 transition-all ${
        isHigh
          ? 'border-orange-600/50 bg-orange-950/20 shadow-lg shadow-orange-950/20'
          : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`p-2 rounded-lg border mt-0.5 ${
            isHigh
              ? 'bg-orange-600/20 border-orange-500/50 text-orange-400'
              : 'bg-blue-600/20 border-blue-500/50 text-blue-400'
          }`}
        >
          {isHigh ? <AlertTriangle className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isHigh ? 'text-orange-400' : 'text-blue-400'
              }`}
            >
              RECOMMENDED PREVENTIVE ACTION
            </span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Prescriptive Decision Support
            </span>
          </div>

          <p className="text-sm font-medium text-white leading-relaxed">
            {recommendedAction}
          </p>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>Requires safety officer dispatch sign-off</span>
            </div>
            <div className="text-[11px] text-slate-500 italic">
              PREVENT decision support does not replace certified mechanical inspection.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
