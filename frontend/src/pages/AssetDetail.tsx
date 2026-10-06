import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import type { AssetDetailResponse, TimelineEventItem } from '../types/api';
import { Header } from '../components/layout/Header';
import { AssetHeader } from '../components/assets/AssetHeader';
import { RiskScoreGauge } from '../components/assets/RiskScoreGauge';
import { FactorWaterfall } from '../components/assets/FactorWaterfall';
import { ExplanationCard } from '../components/assets/ExplanationCard';
import { RecommendedActionCard } from '../components/assets/RecommendedActionCard';
import { EventTimeline } from '../components/timeline/EventTimeline';
import { EvidenceGraphView } from '../components/evidence/EvidenceGraphView';
import { WhatIfSimulator } from '../components/simulation/WhatIfSimulator';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

export const AssetDetail: React.FC = () => {
  const { assetId } = useParams<{ assetId: string }>();

  const [dossier, setDossier] = useState<AssetDetailResponse | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [is404, setIs404] = useState(false);

  const fetchAssetData = async (refresh = false) => {
    if (!assetId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    setIs404(false);

    try {
      const [dossierData, timelineData] = await Promise.all([
        api.getAssetDetail(assetId),
        api.getAssetTimeline(assetId),
      ]);

      setDossier(dossierData);
      setTimelineEvents(timelineData.events);
    } catch (err: any) {
      if (err?.status === 404) {
        setIs404(true);
      }
      setError(err?.message || `Failed to load intelligence for asset '${assetId}'.`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAssetData();
  }, [assetId]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      <Header onRefresh={() => fetchAssetData(true)} isRefreshing={isRefreshing} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 404 Not Found State */}
        {is404 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center max-w-md mx-auto my-12">
            <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">
              Asset Not Found
            </h2>
            <p className="text-xs text-slate-400 mt-2 mb-6">
              Asset ID &quot;{assetId}&quot; is not registered in the PREVENT fleet intelligence database.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Fleet Overview
            </Link>
          </div>
        )}

        {/* General Error State */}
        {error && !is404 && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-5 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-200 uppercase tracking-wide">
                Intelligence Retrieval Error
              </h3>
              <p className="text-xs text-red-300 mt-1">{error}</p>
              <button
                onClick={() => fetchAssetData()}
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded bg-red-900/60 hover:bg-red-800 border border-red-700 text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !dossier && !is404 && (
          <div className="space-y-6 animate-pulse">
            <div className="h-24 rounded-xl bg-slate-900/80 border border-slate-800" />
            <div className="h-40 rounded-xl bg-slate-900/80 border border-slate-800" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-72 rounded-xl bg-slate-900/80 border border-slate-800" />
              <div className="h-72 rounded-xl bg-slate-900/80 border border-slate-800" />
            </div>
          </div>
        )}

        {/* Complete Dossier Content */}
        {dossier && (
          <>
            {/* Top Identity Header */}
            <AssetHeader asset={dossier.asset} riskLevel={dossier.risk_level} />

            {/* Core Metrics Dial: Risk Score + Confidence + Trend */}
            <RiskScoreGauge
              score={dossier.risk_score}
              confidence={dossier.confidence}
              riskLevel={dossier.risk_level}
              trend={dossier.trend}
              primarySubsystem={dossier.primary_subsystem}
            />

            {/* Prescriptive Recommended Action Banner */}
            <RecommendedActionCard
              recommendedAction={dossier.recommended_action}
              riskLevel={dossier.risk_level}
            />

            {/* Explanation & Factor Waterfall Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <FactorWaterfall factorBreakdown={dossier.factor_breakdown} />
              </div>
              <div className="lg:col-span-5 flex flex-col gap-6">
                <ExplanationCard narrative={dossier.explanation_narrative} />
              </div>
            </div>

            {/* Evidence Relationship Graph View */}
            <EvidenceGraphView evidenceGraph={dossier.evidence_graph} />

            {/* Chronological Event Timeline */}
            <EventTimeline
              events={timelineEvents}
              primarySubsystem={dossier.primary_subsystem}
            />

            {/* What-If Simulation Sandbox */}
            <WhatIfSimulator
              assetId={dossier.asset.asset_id}
              currentRiskScore={dossier.risk_score}
              currentSubsystem={dossier.primary_subsystem}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-850 py-4 mt-auto text-center text-xs text-slate-500 font-mono">
        PREVENT Decision-Support Platform • Asset Safety Dossier • Evaluated via Deterministic Scoring
      </footer>
    </div>
  );
};
