import React from 'react';
import { TrendingUp, ArrowUpRight, ArrowRight, ArrowDownRight } from 'lucide-react';
import type { TrendDirection } from '../../types/api';

interface TrendBadgeProps {
  trend: TrendDirection;
  size?: 'sm' | 'md';
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({ trend, size = 'md' }) => {
  const configs: Record<TrendDirection, { text: string; color: string; icon: React.ReactNode }> = {
    RAPIDLY_ESCALATING: {
      text: 'RAPIDLY ESCALATING',
      color: 'text-red-700 bg-red-50 border-red-200',
      icon: <TrendingUp className="w-3.5 h-3.5 text-red-600" />,
    },
    ESCALATING: {
      text: 'ESCALATING',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      icon: <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />,
    },
    STABLE: {
      text: 'STABLE',
      color: 'text-slate-700 bg-slate-100 border-slate-200',
      icon: <ArrowRight className="w-3.5 h-3.5 text-slate-500" />,
    },
    IMPROVING: {
      text: 'IMPROVING',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />,
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
