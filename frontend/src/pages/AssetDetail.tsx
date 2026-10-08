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
import { FieldActionModal } from '../components/assets/FieldActionModal';
import type { FieldActionOutcomePayload } from '../types/actions';
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
  const [isFieldActionModalOpen, setIsFieldActionModalOpen] = useState(false);
  const [activeFieldContext, setActiveFieldContext] = useState<FieldActionOutcomePayload | null>(null);

  // Progressive Enhancement: 5-Stage Intelligence Flow Animation
  const isReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [animStage, setAnimStage] = useState<number>(isReducedMotion ? 5 : 0);
  const animatedAssetsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!dossier || !assetId) return;

    if (isReducedMotion || animatedAssetsRef.current.has(assetId)) {
      setAnimStage(5);
      return;
    }

    animatedAssetsRef.current.add(assetId);

    // Sequence: 1 (Signals: 100ms) -> 2 (Correlate: 550ms) -> 3 (Risk: 950ms) -> 4 (Why Now: 1350ms) -> 5 (Action: 1750ms)
    setAnimStage(0);
    const t1 = setTimeout(() => setAnimStage(1), 100);
    const t2 = setTimeout(() => setAnimStage(2), 550);
    const t3 = setTimeout(() => setAnimStage(3), 950);
    const t4 = setTimeout(() => setAnimStage(4), 1350);
    const t5 = setTimeout(() => setAnimStage(5), 1750);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [dossier?.asset.asset_id, isReducedMotion]);

  const handleReportOutcome = (payload: FieldActionOutcomePayload) => {
    // Phase 5 Step 2: Handoff outcome payload directly into existing AddSafetyReportModal
    setActiveFieldContext(payload);
    setIsFieldActionModalOpen(false);
    setIsReportModalOpen(true);
  };

  const handleEventIngested = (ingestedAssetId: string) => {
    // If report was connected to a field action protocol, update local execution status to OUTCOME_PENDING
    const targetAssetId = ingestedAssetId || assetId;
    if (targetAssetId && activeFieldContext && activeFieldContext.assetId === targetAssetId) {
      try {
        const storageKey = `prevent_action_state_${targetAssetId}`;
        const saved = localStorage.getItem(storageKey);
        const existing = saved ? JSON.parse(saved) : {};
        const updatedState = {
          ...existing,
          assetId: targetAssetId,
          status: 'OUTCOME_PENDING',
          completedAt: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(updatedState));
        window.dispatchEvent(new Event('prevent_action_state_changed'));
      } catch {
        // ignore
      }
      setActiveFieldContext(null);
    }

    // Authoritative refresh of risk, timeline, and trajectory from backend
    fetchAssetData(true);
  };

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
              to="/app/transportation"
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
            {/* Intelligence Sequence Flow Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2 rounded-lg bg-white border border-slate-200 shadow-2xs font-mono text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    animStage >= 5 ? 'bg-emerald-500' : 'bg-slate-900'
                  }`}
                />
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Intelligence Flow
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                <span
                  className={`transition-colors duration-200 ${
                    animStage >= 1 ? 'text-slate-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  01 · SIGNALS
                </span>
                <span className="text-slate-300">→</span>
                <span
                  className={`transition-colors duration-200 ${
                    animStage >= 2 ? 'text-slate-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  02 · CORRELATE
                </span>
                <span className="text-slate-300">→</span>
                <span
                  className={`transition-colors duration-200 ${
                    animStage >= 3 ? 'text-rose-600 font-bold' : 'text-slate-400'
                  }`}
                >
                  03 · RISK
                </span>
                <span className="text-slate-300">→</span>
                <span
                  className={`transition-colors duration-200 ${
                    animStage >= 4 ? 'text-slate-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  04 · WHY NOW
                </span>
                <span className="text-slate-300">→</span>
                <span
                  className={`transition-colors duration-200 ${
                    animStage >= 5 ? 'text-emerald-700 font-bold' : 'text-slate-400'
                  }`}
                >
                  05 · ACTION
                </span>
              </div>
            </div>

            {/* 1. Asset Header & Integrated Risk Strip */}
            <AssetHeader
              asset={dossier.asset}
              riskLevel={dossier.risk_level}
              riskScore={dossier.risk_score}
              trend={dossier.trend}
              primarySubsystem={dossier.primary_subsystem}
              confidence={dossier.confidence}
              stage={animStage}
            />

            {/* 2. WHY NOW? Intelligence Section (Editorial) */}
            {(whyNow || dossier.why_now) && (
              <WhyNowSection
                whyNow={(whyNow || dossier.why_now)!}
                onSelectEventIds={handleSelectSignalEventIds}
                activeEventIds={highlightedEventIds}
                stage={animStage}
              />
            )}

            {/* 3. Prescriptive Recommended Action Banner */}
            <div
              style={{
                transition: animStage < 5 ? 'opacity 350ms ease, transform 350ms ease' : undefined,
                opacity: animStage >= 5 ? 1 : 0.25,
                transform: animStage >= 5 ? 'translateY(0)' : 'translateY(4px)',
              }}
            >
              <RecommendedActionCard
                recommendedAction={dossier.recommended_action}
                riskLevel={dossier.risk_level}
                primarySubsystem={dossier.primary_subsystem}
                assetId={dossier.asset.asset_id}
                whyNowSummary={(whyNow || dossier.why_now)?.summary}
                onExecuteProtocol={() => setIsFieldActionModalOpen(true)}
              />
            </div>

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

      {/* AI Safety Report Ingestion Modal (Asset Context & Field Protocol Handoff) */}
      <AddSafetyReportModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setActiveFieldContext(null);
        }}
        onEventIngested={handleEventIngested}
        initialAssetId={assetId}
        availableAssetIds={assetId ? [assetId] : []}
        fieldContext={activeFieldContext}
      />

      {/* Field Action Workflow Modal (Phase 5 Step 1) */}
      {dossier && (
        <FieldActionModal
          isOpen={isFieldActionModalOpen}
          onClose={() => setIsFieldActionModalOpen(false)}
          assetId={dossier.asset.asset_id}
          riskLevel={dossier.risk_level}
          riskScore={dossier.risk_score}
          primarySubsystem={dossier.primary_subsystem}
          whyNowSummary={(whyNow || dossier.why_now)?.summary}
          onReportOutcome={handleReportOutcome}
        />
      )}
    </div>
  );
};
