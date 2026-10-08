import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import type {
  AssetDetailResponse,
  TimelineEventItem,
  WhyNowResponse,
  RiskHistoryResponse
} from '../types/api';
import { Header } from '../components/layout/Header';
import { AssetHeader } from '../components/assets/AssetHeader';
import { WhyNowSection } from '../components/intelligence/WhyNowSection';
import { RiskTrajectoryChart } from '../components/trajectory/RiskTrajectoryChart';
import { FactorWaterfall } from '../components/assets/FactorWaterfall';
import { ExplanationCard } from '../components/assets/ExplanationCard';
import { RecommendedActionCard } from '../components/assets/RecommendedActionCard';
import { EventTimeline } from '../components/timeline/EventTimeline';
import { EvidenceGraphView } from '../components/evidence/EvidenceGraphView';
import { WhatIfSimulator } from '../components/simulation/WhatIfSimulator';
import { AddSafetyReportModal } from '../components/ingestion/AddSafetyReportModal';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

export const AssetDetail: React.FC = () => {
  const { assetId } = useParams<{ assetId: string }>();

  const [dossier, setDossier] = useState<AssetDetailResponse | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEventItem[]>([]);
  const [whyNow, setWhyNow] = useState<WhyNowResponse | null>(null);
  const [riskHistory, setRiskHistory] = useState<RiskHistoryResponse | null>(null);
  const [highlightedEventIds, setHighlightedEventIds] = useState<string[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [is404, setIs404] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const scrollToEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    const el = document.getElementById(`event-item-${eventId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSelectSignalEventIds = (eventIds: string[]) => {
    setHighlightedEventIds(eventIds);
    if (eventIds.length > 0) {
      scrollToEvent(eventIds[0]);
    }
  };

  const fetchAssetData = async (refresh = false) => {
    if (!assetId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    setIs404(false);

    try {
      const [dossierData, timelineData, whyNowData, riskHistoryData] = await Promise.all([
        api.getAssetDetail(assetId),
        api.getAssetTimeline(assetId),
        api.getAssetWhyNow(assetId).catch(() => null),
        api.getAssetRiskHistory(assetId).catch(() => null),
      ]);

      setDossier(dossierData);
      setTimelineEvents(timelineData.events);
      setWhyNow(whyNowData || dossierData.why_now || null);
      setRiskHistory(riskHistoryData || dossierData.risk_history || null);
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Header
        onRefresh={() => fetchAssetData(true)}
        isRefreshing={isRefreshing}
        onAddReport={() => setIsReportModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 404 Not Found State */}
        {is404 && (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center max-w-md mx-auto my-12 shadow-xs">
            <AlertCircle className="w-10 h-10 text-orange-600 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-900 uppercase font-mono tracking-wider">
              Asset Not Found
            </h2>
            <p className="text-xs text-slate-500 mt-2 mb-6 font-sans">
              Asset ID &quot;{assetId}&quot; is not registered in the PREVENT fleet intelligence database.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Fleet Overview
            </Link>
          </div>
        )}

        {/* General Error State */}
        {error && !is404 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="text-xs font-mono font-bold text-red-800 uppercase tracking-wide">
                Intelligence Retrieval Error
              </h3>
              <p className="text-xs text-red-700 mt-1">{error}</p>
              <button
                onClick={() => fetchAssetData()}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-white hover:bg-red-50 border border-red-200 text-red-700 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !dossier && !is404 && (
          <div className="space-y-6 animate-pulse">
            <div className="h-28 rounded-lg bg-slate-100 border border-slate-200" />
            <div className="h-44 rounded-lg bg-slate-100 border border-slate-200" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-72 rounded-lg bg-slate-100 border border-slate-200" />
              <div className="h-72 rounded-lg bg-slate-100 border border-slate-200" />
            </div>
          </div>
        )}

        {/* Complete Dossier Content */}
        {dossier && (
          <>
            {/* 1. Asset Header & Integrated Risk Strip */}
            <AssetHeader
              asset={dossier.asset}
              riskLevel={dossier.risk_level}
              riskScore={dossier.risk_score}
              trend={dossier.trend}
              primarySubsystem={dossier.primary_subsystem}
              confidence={dossier.confidence}
            />

            {/* 2. WHY NOW? Intelligence Section (Editorial) */}
            {(whyNow || dossier.why_now) && (
              <WhyNowSection
                whyNow={(whyNow || dossier.why_now)!}
                onSelectEventIds={handleSelectSignalEventIds}
                activeEventIds={highlightedEventIds}
              />
            )}

            {/* 3. Prescriptive Recommended Action Banner */}
            <RecommendedActionCard
              recommendedAction={dossier.recommended_action}
              riskLevel={dossier.risk_level}
            />

            {/* 4. Risk Trajectory Chart */}
            {(riskHistory || dossier.risk_history) && (
              <RiskTrajectoryChart
                history={(riskHistory || dossier.risk_history)!}
                onSelectEventId={scrollToEvent}
                selectedEventId={selectedEventId}
              />
            )}

            {/* 5. Factor Waterfall & Explanation Narrative */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <FactorWaterfall factorBreakdown={dossier.factor_breakdown} />
              </div>
              <div className="lg:col-span-5 flex flex-col gap-6">
                <ExplanationCard narrative={dossier.explanation_narrative} />
              </div>
            </div>

            {/* 6. Chronological Event Timeline */}
            <EventTimeline
              events={timelineEvents}
              primarySubsystem={dossier.primary_subsystem}
              highlightedEventIds={highlightedEventIds}
            />

            {/* 7. Evidence Relationship Map View */}
            <EvidenceGraphView
              evidenceGraph={dossier.evidence_graph}
              riskScore={dossier.risk_score}
              riskLevel={dossier.risk_level}
              highlightedEventIds={highlightedEventIds}
              onSelectEventId={scrollToEvent}
            />

            {/* 8. What-If Simulation Sandbox */}
            <WhatIfSimulator
              assetId={dossier.asset.asset_id}
              currentRiskScore={dossier.risk_score}
              currentSubsystem={dossier.primary_subsystem}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 mt-auto text-center text-xs text-slate-500 font-mono">
        PREVENT Decision-Support Platform • Asset Safety Dossier • Evaluated via Deterministic Scoring
      </footer>

      {/* AI Safety Report Ingestion Modal (Asset Context) */}
      <AddSafetyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onEventIngested={() => fetchAssetData(true)}
        initialAssetId={assetId}
        availableAssetIds={assetId ? [assetId] : []}
      />
    </div>
  );
};
