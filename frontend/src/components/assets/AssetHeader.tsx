import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import type { AssetInfo, RiskLevel, TrendDirection } from '../../types/api';

interface AssetHeaderProps {
  asset: AssetInfo;
  riskLevel: RiskLevel;
  riskScore: number;
  trend: TrendDirection;
  primarySubsystem: string;
  confidence: number;
  stage?: number;
}

export const AssetHeader: React.FC<AssetHeaderProps> = ({
  asset,
  riskLevel,
  riskScore,
  trend,
  primarySubsystem,
  confidence,
  stage = 5,
}) => {
  const isHigh = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';
  const isMedium = riskLevel === 'MEDIUM';

  // Smooth count-up when stage reaches 3 (RISK)
  const [displayScore, setDisplayScore] = React.useState<number>(() =>
    stage >= 5 ? Math.round(riskScore) : 0
  );

  React.useEffect(() => {
    if (stage >= 5) {
      setDisplayScore(Math.round(riskScore));
      return;
    }
    if (stage >= 3) {
      let startTime: number | null = null;
      const target = Math.round(riskScore);
      const duration = 350;
      let frameId: number;

      const animate = (time: number) => {
        if (!startTime) startTime = time;
        const progress = Math.min((time - startTime) / duration, 1);
        const current = Math.round(progress * target);
        setDisplayScore(current);
        if (progress < 1) {
          frameId = requestAnimationFrame(animate);
        } else {
          setDisplayScore(target);
        }
      };

      frameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(frameId);
    }
  }, [stage, riskScore]);

  const riskColor = isHigh
    ? 'text-rose-600'
    : isMedium
    ? 'text-amber-600'
    : 'text-emerald-700';

  const formatTrend = (t: string) => t.replace('_', ' ');

  return (
    <div className="border-b border-slate-200 pb-6 bg-white p-6 rounded-lg border">
      {/* Return link */}
      <Link
        to="/app/transportation"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors mb-4 font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Fleet Overview</span>
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        {/* Left: Asset Identity */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
              {asset.asset_id}
            </h1>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 border border-slate-200 px-2 py-0.5 rounded bg-slate-50">
              {asset.status.replace('_', ' ')}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1.5 font-sans">
            {asset.make_model} • {asset.depot_location} • <strong className="font-semibold uppercase text-slate-700">{asset.criticality} Criticality</strong>
          </p>
        </div>

        {/* Right: Key Safety Metrics Bar (Clean, Non-Card Strip) */}
        <div className="flex flex-wrap items-baseline gap-6 sm:gap-8 font-mono border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
          <div>
            <span className="block text-[10px] uppercase font-sans tracking-wider text-slate-500 font-semibold">
              Risk Score
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span
                className={`text-4xl font-extrabold ${riskColor} transition-all duration-300 ${
                  stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-1'
                }`}
              >
                {displayScore}
              </span>
              <span className="text-xs text-slate-500 font-sans">/ 100</span>
            </div>
          </div>

          <div className="border-l border-slate-200 pl-6 sm:pl-8">
            <span className="block text-[10px] uppercase font-sans tracking-wider text-slate-500 font-semibold">
              Assessment
            </span>
            <div
              className={`mt-0.5 transition-all duration-300 ${
                stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-1'
              }`}
            >
              <span className={`text-sm font-bold tracking-tight block ${riskColor}`}>
                {riskLevel} RISK
              </span>
              <span className="text-[11px] text-slate-600 block">
                {formatTrend(trend)}
              </span>
            </div>
          </div>

          <div className="border-l border-slate-200 pl-6 sm:pl-8">
            <span className="block text-[10px] uppercase font-sans tracking-wider text-slate-500 font-semibold">
              Focus Subsystem
            </span>
            <span className="text-sm font-bold text-slate-800 uppercase block mt-0.5">
              {primarySubsystem.replace('_', ' ')}
            </span>
            <span className="text-[11px] text-slate-600 font-sans block">
              Primary Convergence
            </span>
          </div>

          <div
            className="border-l border-slate-200 pl-6 sm:pl-8 group cursor-help"
            title="Based on supporting signal volume and source diversity. Not a probability of failure."
          >
            <div className="flex items-center gap-1">
              <span className="block text-[10px] uppercase font-sans tracking-wider text-slate-500 font-semibold">
                Evidence Sufficiency
              </span>
              <Info className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
            <span className="text-sm font-bold text-slate-900 block mt-0.5">
              {Math.round(confidence)}%
            </span>
            <span className="text-[11px] text-slate-600 font-sans block">
              Source Diversity
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
