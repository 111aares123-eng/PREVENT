import React from 'react';
import type { FleetOverviewResponse } from '../../types/api';

interface FleetKpiCardsProps {
  overview: FleetOverviewResponse;
}

export const FleetKpiCards: React.FC<FleetKpiCardsProps> = ({ overview }) => {
  const highRisk = overview.high_risk_count + overview.critical_risk_count;

  return (
    <div className="flex flex-wrap items-center divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-y border-slate-200 py-3 text-xs bg-white rounded-lg px-2">
      <div className="px-5 py-1.5 flex items-baseline gap-2.5">
        <span className="text-2xl font-bold font-mono text-slate-900">
          {overview.total_assets}
        </span>
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Total Assets
        </span>
      </div>

      <div className="px-5 py-1.5 flex items-baseline gap-2.5">
        <span className="text-2xl font-bold font-mono text-rose-600">
          {highRisk}
        </span>
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          High Risk
        </span>
      </div>

      <div className="px-5 py-1.5 flex items-baseline gap-2.5">
        <span className="text-2xl font-bold font-mono text-amber-600">
          {overview.medium_risk_count}
        </span>
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Medium Risk
        </span>
      </div>

      <div className="px-5 py-1.5 flex items-baseline gap-2.5">
        <span className="text-2xl font-bold font-mono text-emerald-600">
          {overview.low_risk_count}
        </span>
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          Low Risk
        </span>
      </div>
    </div>
  );
};
