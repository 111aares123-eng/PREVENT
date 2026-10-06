import React from 'react';
import { ArrowUpRight, ArrowRight, ArrowDownRight, Flame } from 'lucide-react';
import type { TrendDirection } from '../../types/api';

interface TrendBadgeProps {
  trend: TrendDirection;
  size?: 'sm' | 'md';
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({ trend, size = 'md' }) => {
  const configs: Record<TrendDirection, { text: string; color: string; icon: React.ReactNode }> = {
    RAPIDLY_ESCALATING: {
      text: 'RAPIDLY ESCALATING',
      color: 'text-red-400 bg-red-950/40 border-red-700/50',
      icon: <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />,
    },
    ESCALATING: {
      text: 'ESCALATING',
      color: 'text-orange-400 bg-orange-950/40 border-orange-700/50',
      icon: <ArrowUpRight className="w-3.5 h-3.5 text-orange-400" />,
    },
    STABLE: {
      text: 'STABLE',
      color: 'text-slate-300 bg-slate-800/60 border-slate-700/50',
      icon: <ArrowRight className="w-3.5 h-3.5 text-slate-400" />,
    },
    IMPROVING: {
      text: 'IMPROVING',
      color: 'text-emerald-400 bg-emerald-950/40 border-emerald-700/50',
      icon: <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />,
    },
  };

  const current = configs[trend] || configs.STABLE;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1 font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border ${current.color} ${sizeClass}`}
    >
      {current.icon}
      <span>{current.text}</span>
    </span>
  );
};
