import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Gauge, ShieldAlert } from 'lucide-react';
import type { AssetInfo, RiskLevel } from '../../types/api';
import { RiskBadge } from '../risk/RiskBadge';

interface AssetHeaderProps {
  asset: AssetInfo;
  riskLevel: RiskLevel;
}

export const AssetHeader: React.FC<AssetHeaderProps> = ({ asset, riskLevel }) => {
  const isHigh = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: Back button + Vehicle Identification */}
        <div className="flex items-start gap-4">
          <Link
            to="/"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors mt-0.5"
            title="Return to fleet overview"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                {asset.asset_id}
                {isHigh && <ShieldAlert className="w-5 h-5 text-orange-400" />}
              </h1>
              <RiskBadge level={riskLevel} size="md" />
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              {asset.make_model} • {asset.asset_type.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Right Side: Operational Metadata Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>Depot: <strong className="text-white">{asset.depot_location}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <span>Criticality: <strong className="text-white uppercase">{asset.criticality}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Status: <strong className="text-white uppercase">{asset.status.replace('_', ' ')}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
