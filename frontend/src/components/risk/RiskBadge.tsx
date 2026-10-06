import React from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle2, Info } from 'lucide-react';
import type { RiskLevel } from '../../types/api';

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  size = 'md',
  showIcon = true,
}) => {
  const styles: Record<RiskLevel, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    CRITICAL: {
      bg: 'bg-red-950/60',
      text: 'text-red-400',
      border: 'border-red-600/50',
      icon: <AlertOctagon className="w-3.5 h-3.5 text-red-400" />,
    },
    HIGH: {
      bg: 'bg-orange-950/60',
      text: 'text-orange-400',
      border: 'border-orange-500/50',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />,
    },
    MEDIUM: {
      bg: 'bg-amber-950/60',
      text: 'text-amber-400',
      border: 'border-amber-500/50',
      icon: <Info className="w-3.5 h-3.5 text-amber-400" />,
    },
    LOW: {
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-400',
      border: 'border-emerald-500/50',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    },
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-semibold',
  };

  const current = styles[level] || styles.LOW;

  return (
    <span
      className={`inline-flex items-center rounded-md border ${current.bg} ${current.text} ${current.border} ${sizeClasses[size]}`}
    >
      {showIcon && current.icon}
      <span>{level} RISK</span>
    </span>
  );
};
