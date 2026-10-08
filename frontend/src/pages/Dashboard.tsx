import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { FleetOverviewResponse } from '../types/api';
import { Header } from '../components/layout/Header';
import { FleetKpiCards } from '../components/dashboard/FleetKpiCards';
import { RiskDistributionChart } from '../components/dashboard/RiskDistributionChart';
import { AssetsTable } from '../components/dashboard/AssetsTable';
import { AddSafetyReportModal } from '../components/ingestion/AddSafetyReportModal';
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<FleetOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const fetchFleetData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const data = await api.getFleetOverview();
      setOverview(data);
    } catch (err: any) {
      setError(
        err?.message || 'Unable to connect to PREVENT backend intelligence service.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFleetData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      <Header
        onRefresh={() => fetchFleetData(true)}
        isRefreshing={isRefreshing}
        onAddReport={() => setIsReportModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-5 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-200 uppercase tracking-wide">
                Connection Failure
              </h3>
              <p className="text-xs text-red-300 mt-1">{error}</p>
              <button
                onClick={() => fetchFleetData()}
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded bg-red-900/60 hover:bg-red-800 border border-red-700 text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !overview && (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-slate-900/80 border border-slate-800" />
              ))}
            </div>
            <div className="h-44 rounded-xl bg-slate-900/80 border border-slate-800" />
            <div className="h-80 rounded-xl bg-slate-900/80 border border-slate-800" />
          </div>
        )}

        {/* Main Content */}
        {overview && (
          <>
            {/* Mission Statement Bar */}
            <div className="rounded-xl border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                    Active Surveillance Mode
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                </div>
                <h2 className="text-base font-extrabold text-white mt-0.5">
                  Proactive Multi-Source Early Warning Intelligence
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Correlating maintenance records, inspections, complaints, driver logs, and near-misses across time.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="inline-flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-950/60 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-orange-200" />
                  <span>Add Safety Report</span>
                </button>

                <div className="text-right border-l border-slate-800 pl-4 hidden sm:block">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">
                    Last Evaluated
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    {new Date(overview.evaluated_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Top Grid: KPI Cards + Risk Profile Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <FleetKpiCards overview={overview} />
              </div>
              <div className="lg:col-span-4">
                <RiskDistributionChart distribution={overview.risk_distribution} />
              </div>
            </div>

            {/* Priority Assets Requiring Immediate Attention */}
            {overview.assets_requiring_attention.length > 0 && (
              <AssetsTable
                assets={overview.assets_requiring_attention}
                title="PRIORITY ASSETS REQUIRING ATTENTION"
                subtitle="Assets with confirmed escalating cross-source signals requiring human safety review"
                highlightAttention={true}
              />
            )}

            {/* Complete Fleet Monitored Roster */}
            <AssetsTable
              assets={overview.assets}
              title="ALL MONITORED FLEET ASSETS"
              subtitle="Comprehensive operational status, risk scoring, and evidence confidence across all fleet units"
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-850 py-4 mt-auto text-center text-xs text-slate-500 font-mono">
        PREVENT Decision-Support Platform • Enterprise Safety Intelligence • Not a predictive maintenance system
      </footer>

      {/* AI Safety Report Ingestion Modal */}
      <AddSafetyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onEventIngested={() => fetchFleetData(true)}
        availableAssetIds={overview?.assets.map((a) => a.asset_id) || []}
      />
    </div>
  );
};
