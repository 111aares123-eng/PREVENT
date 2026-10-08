import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { FleetOverviewResponse } from '../types/api';
import { Header } from '../components/layout/Header';
import { FleetKpiCards } from '../components/dashboard/FleetKpiCards';
import { RiskDistributionChart } from '../components/dashboard/RiskDistributionChart';
import { AssetsTable } from '../components/dashboard/AssetsTable';
import { AddSafetyReportModal } from '../components/ingestion/AddSafetyReportModal';
import { AlertCircle, RefreshCw } from 'lucide-react';

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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Header
        onRefresh={() => fetchFleetData(true)}
        isRefreshing={isRefreshing}
        onAddReport={() => setIsReportModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Error State */}
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
            <div className="flex-1 text-xs">
              <h3 className="font-bold text-rose-900 uppercase tracking-wide">
                Intelligence Service Unavailable
              </h3>
              <p className="text-rose-700 mt-1">{error}</p>
              <button
                type="button"
                onClick={() => fetchFleetData()}
                className="mt-3 inline-flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !overview && (
          <div className="space-y-6 animate-pulse">
            <div className="h-10 w-48 bg-slate-200 rounded" />
            <div className="h-16 w-full bg-slate-200 rounded-lg" />
            <div className="h-64 w-full bg-slate-200 rounded-lg" />
          </div>
        )}

        {/* Main Content */}
        {overview && (
          <>
            {/* Page Header: Title + Status */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-2 border-b border-slate-200">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Fleet Safety Intelligence
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-source early warning surveillance across maintenance, inspections, telematics, and operator reports
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Monitoring {overview.total_assets} assets</span>
                </div>
                <span className="text-slate-300">|</span>
                <span>
                  Evaluated {new Date(overview.evaluated_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            {/* Compact KPI Strip */}
            <FleetKpiCards overview={overview} />

            {/* Fleet Risk Section */}
            <section className="space-y-3">
              <div className="border-b border-slate-200 pb-1.5">
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-900">
                  Fleet Risk Profile
                </h2>
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-200">
                <RiskDistributionChart distribution={overview.risk_distribution} />
              </div>
            </section>

            {/* Assets Requiring Immediate Attention */}
            {overview.assets_requiring_attention.length > 0 && (
              <section className="space-y-3">
                <AssetsTable
                  assets={overview.assets_requiring_attention}
                  title="Assets Requiring Attention"
                  subtitle="Units with converging warning signals or escalating safety patterns"
                  highlightAttention={true}
                />
              </section>
            )}

            {/* Full Fleet Roster */}
            <section id="fleet-roster" className="space-y-3 pt-2">
              <AssetsTable
                assets={overview.assets}
                title="All Monitored Fleet Units"
                subtitle="Baseline operational status, deterministic risk rating, and primary subsystem"
              />
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 mt-auto text-center text-xs text-slate-400 font-mono">
        PREVENT Decision-Support Platform • Deterministic Multi-Source Early Warning Intelligence
      </footer>

      {/* AI Safety Report Ingestion Modal */}
      <AddSafetyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onEventIngested={() => fetchFleetData(true)}
        availableAssetIds={overview ? overview.assets.map((a) => a.asset_id) : []}
      />
    </div>
  );
};
