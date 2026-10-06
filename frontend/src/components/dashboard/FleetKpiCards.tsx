import React from 'react';
import { Bus, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { FleetOverviewResponse } from '../../types/api';

interface FleetKpiCardsProps {
  overview: FleetOverviewResponse;
}

export const FleetKpiCards: React.FC<FleetKpiCardsProps> = ({ overview }) => {
  const cards = [
    {
      title: 'TOTAL ASSETS',
      value: overview.total_assets,
      subtitle: 'Monitored fleet units',
      icon: <Bus className="w-5 h-5 text-blue-400" />,
      border: 'border-slate-800',
      bg: 'bg-slate-900/60',
      textAccent: 'text-white',
    },
    {
      title: 'HIGH RISK',
      value: overview.high_risk_count + overview.critical_risk_count,
      subtitle: 'Escalating pattern detected',
      icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
      border: overview.high_risk_count > 0 ? 'border-orange-600/60 shadow-lg shadow-orange-950/20' : 'border-slate-800',
      bg: overview.high_risk_count > 0 ? 'bg-orange-950/20' : 'bg-slate-900/60',
      textAccent: 'text-orange-400',
    },
    {
      title: 'MEDIUM RISK',
      value: overview.medium_risk_count,
      subtitle: 'Heightened surveillance',
      icon: <AlertCircle className="w-5 h-5 text-amber-400" />,
      border: 'border-slate-800',
      bg: 'bg-slate-900/60',
      textAccent: 'text-amber-400',
    },
    {
      title: 'LOW RISK',
      value: overview.low_risk_count,
      subtitle: 'Normal operational variance',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      border: 'border-slate-800',
      bg: 'bg-slate-900/60',
      textAccent: 'text-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.title}
          className={`rounded-xl border p-4.5 transition-all ${c.border} ${c.bg}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {c.title}
            </span>
            <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
              {c.icon}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold tracking-tight ${c.textAccent}`}>
              {c.value}
            </span>
            <span className="text-xs text-slate-500">
              ({overview.total_assets > 0 ? Math.round((c.value / overview.total_assets) * 100) : 0}%)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{c.subtitle}</p>
        </div>
      ))}
    </div>
  );
};
