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
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      icon: <AlertOctagon className="w-3.5 h-3.5 text-red-600" />,
    },
    HIGH: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-red-600" />,
    },
    MEDIUM: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: <Info className="w-3.5 h-3.5 text-amber-600" />,
    },
    LOW: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
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
