import React, { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header';
import { api } from '../services/api';
import type { NHTSAEvidenceResponse } from '../types/api';
import {
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  Clock,
  ExternalLink,
  Layers,
  FileCheck2,
  AlertCircle,
  Activity,
  Calendar,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';


export const RealWorldEvidence: React.FC = () => {
  const [evidence, setEvidence] = useState<NHTSAEvidenceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvidence = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getNhtsaEvidence();
      setEvidence(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load NHTSA real-world evidence.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Track Isolation & Context Banner */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-blue-900 uppercase tracking-wider text-[11px]">
                  Independent Empirical Track · Zero Operational Coupling
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-blue-200/70 text-blue-800">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  Isolated From RiskEngine
                </span>
              </div>
              <p className="text-blue-900/90 leading-relaxed">
                PREVENT's operational demonstration uses controlled scenarios for deterministic evaluation.
                This research panel independently examines official <strong>U.S. National Highway Traffic Safety Administration (NHTSA)</strong> public
                safety records to retrospectively test whether weak safety signals clustered around specific subsystems prior to major regulatory safety action.
              </p>
              <div className="text-[11px] text-blue-700/80 pt-1 font-mono">
                Source: NHTSA Office of Defects Investigation (ODI) · Consumer Complaints & Official Safety Recalls
              </div>
            </div>
          </div>
        </div>

        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                Case Study
              </span>
              <span className="text-xs font-mono text-slate-500">
                NHTSA-ODI · {evidence?.metadata.cohort.model_year} {evidence?.metadata.cohort.make} {evidence?.metadata.cohort.model}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Observed Signal Convergence in Real-World Safety Records
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-3xl">
              Retrospective empirical investigation of Electric Power Assist Steering (EPAS) failure precursors leading up to NHTSA Recall 15V340000.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadEvidence}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Reload Evidence</span>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-center gap-3 text-xs text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Unable to load evidence snapshot</p>
              <p className="text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !evidence && (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">Analyzing NHTSA public safety records...</p>
          </div>
        )}

        {evidence && (
          <>
            {/* 1. Core Evidence Summary Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Card 1: Total Cohort Records */}
              <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Cohort Records</span>
                  <FileCheck2 className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-900">
                  {evidence.summary.total_cohort_records.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Total owner reports across all subsystems
                </p>
              </div>

              {/* Card 2: Subsystem Convergence */}
              <div className="bg-white rounded-xl border border-indigo-200 p-4.5 shadow-xs bg-indigo-50/20">
                <div className="flex items-center justify-between text-indigo-700 mb-2">
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Subsystem Concentration</span>
                  <Layers className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-indigo-950 flex items-baseline gap-1.5">
                  <span>{evidence.summary.subsystem_concentration_pct}%</span>
                  <span className="text-xs font-normal text-indigo-600 font-mono">
                    ({evidence.summary.target_subsystem_records.toLocaleString()} reports)
                  </span>
                </div>
                <p className="text-[11px] text-indigo-700/80 mt-1">
                  Clustered in {evidence.summary.target_subsystem}
                </p>
              </div>

              {/* Card 3: Precursor Signals */}
              <div className="bg-white rounded-xl border border-amber-200 p-4.5 shadow-xs bg-amber-50/20">
                <div className="flex items-center justify-between text-amber-700 mb-2">
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Precursor Warnings</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-amber-950 flex items-baseline gap-1.5">
                  <span>{evidence.summary.precursor_signals.toLocaleString()}</span>
                  <span className="text-xs font-normal text-amber-600 font-mono">
                    ({evidence.summary.precursor_pct}%)
                  </span>
                </div>
                <p className="text-[11px] text-amber-700/80 mt-1">
                  Non-crash, non-injury warnings
                </p>
              </div>

              {/* Card 4: Critical Outcomes */}
              <div className="bg-white rounded-xl border border-rose-200 p-4.5 shadow-xs bg-rose-50/20">
                <div className="flex items-center justify-between text-rose-700 mb-2">
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Critical-Outcome Reports</span>
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-rose-950 flex items-baseline gap-1.5">
                  <span>{evidence.summary.critical_outcomes.toLocaleString()}</span>
                  <span className="text-xs font-normal text-rose-600 font-mono">
                    ({evidence.summary.critical_pct}%)
                  </span>
                </div>
                <p className="text-[11px] text-rose-700/80 mt-1">
                  Reports documenting crashes, fires, or physical injuries
                </p>
              </div>

              {/* Card 5: Lead Time */}
              <div className="bg-white rounded-xl border border-emerald-200 p-4.5 shadow-xs bg-emerald-50/20">
                <div className="flex items-center justify-between text-emerald-700 mb-2">
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Empirical Lead Time</span>
                  <Clock className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-emerald-950 flex items-baseline gap-1.5">
                  <span>~{evidence.summary.lead_time_months} mo</span>
                  <span className="text-xs font-normal text-emerald-600 font-mono">
                    ({evidence.summary.lead_time_days} days)
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700/80 mt-1">
                  First signal cluster to official recall
                </p>
              </div>
            </div>

            {/* 2. Temporal Trend & Action Marker Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-slate-600" />
                    Temporal Escalation: Precursors vs Regulatory Action
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Annual complaint volume in {evidence.summary.target_subsystem}. Notice the steep acceleration in 2013–2014 before official recall intervention in 2015.
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-amber-400" />
                    <span className="text-slate-600">Precursor Warning</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-rose-500" />
                    <span className="text-slate-600">Critical-Outcome Report</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-indigo-600" />
                    <span className="text-slate-600">Official Safety Action</span>
                  </div>
                </div>
              </div>


              {/* Bar visualization */}
              <div className="space-y-4">
                {evidence.temporal_timeline.map((item) => {
                  const maxTotal = 250; // visual scaling ceiling
                  const precursorWidth = Math.min(100, (item.precursor_count / maxTotal) * 100);
                  const criticalWidth = Math.min(100, (item.critical_count / maxTotal) * 100);

                  return (
                    <div key={item.period} className="flex items-center gap-3 text-xs">
                      {/* Year Label */}
                      <div className="w-14 font-mono font-bold text-slate-700 shrink-0 text-right">
                        {item.period}
                      </div>

                      {/* Bar Stack */}
                      <div className="flex-1 bg-slate-100 h-6 rounded-md overflow-hidden flex items-center relative">
                        <div
                          className="bg-amber-400 h-full transition-all"
                          style={{ width: `${precursorWidth}%` }}
                          title={`Precursor: ${item.precursor_count}`}
                        />
                        <div
                          className="bg-rose-500 h-full transition-all"
                          style={{ width: `${criticalWidth}%` }}
                          title={`Critical: ${item.critical_count}`}
                        />

                        {/* Total Count Label inside or outside bar */}
                        <span className="text-[11px] font-mono text-slate-700 ml-2 font-semibold">
                          {item.total_count} reports
                        </span>

                        {/* Action Marker Pin */}
                        {item.action_marker && (
                          <div className="absolute right-2 flex items-center gap-1.5 bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-xs">
                            <ShieldAlert className="w-3 h-3 text-indigo-200" />
                            <span>{item.action_label}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pre-Action vs Post-Action Finding Callout */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-900">Pre-Recall Signal Accumulation:</span>{' '}
                  <span className="text-slate-600">
                    <strong>{evidence.summary.pre_action_signals} steering complaints</strong> were submitted to NHTSA prior to the recall date ({evidence.safety_action.action_date}), establishing that strong precursor convergence existed years before regulatory intervention.
                  </span>
                </div>
                <div className="shrink-0 font-mono font-semibold text-slate-700">
                  Investigation: {evidence.safety_action.action_number}
                </div>
              </div>
            </div>

            {/* 3. Subsystem Concentration & Signal Diversity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Component Recurrence */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-600" />
                    Subsystem Concentration Across Cohort
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Distribution of all {evidence.summary.total_cohort_records.toLocaleString()} complaint records across primary vehicle subsystems.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  {evidence.subsystem_breakdown.slice(0, 6).map((item) => (
                    <div key={item.subsystem} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${item.is_target ? 'font-bold text-indigo-900' : 'text-slate-700'}`}>
                          {item.subsystem} {item.is_target && '(Target Safety Concern)'}
                        </span>
                        <span className="font-mono text-slate-500 text-[11px]">
                          {item.count} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.is_target ? 'bg-indigo-600' : 'bg-slate-300'
                          }`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Signal Diversity */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-600" />
                    Signal Diversity: Precursor Symptoms Described
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    How independent drivers described the emerging anomaly before the recall was initiated.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  {evidence.signal_diversity.map((sym) => (
                    <div key={sym.symptom} className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span className="font-medium text-slate-800">{sym.symptom}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-600 text-[11px]">
                        {sym.count} reports ({sym.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Official Regulatory Action Details */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-indigo-600" />
                    Official Regulatory Safety Action: NHTSA Recall {evidence.safety_action.campaign_number}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Engineering finding and recall remedy confirmed by NHTSA and the manufacturer.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    Investigation: {evidence.safety_action.action_number}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                    Recall Date: {evidence.safety_action.action_date}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                    Defect Summary & Failure Mechanism
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {evidence.safety_action.defect_summary}
                  </p>
                </div>
                <div className="space-y-1.5 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                    Safety Consequence & Remedy
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    <strong>Hazard:</strong> {evidence.safety_action.consequence}
                  </p>
                  <p className="text-slate-600 pt-1">
                    <strong>Remedy:</strong> {evidence.safety_action.remedy}
                  </p>
                </div>
              </div>
            </div>

            {/* 5. Traceable Signal Log (Real Government Records) */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-slate-600" />
                    Traceable Signal Log: Actual Government Records
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Exemplar historical records from the NHTSA database showing how drivers experienced and reported the issue across different stages.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Verifiable via NHTSA ODI Identifiers
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {evidence.traceable_signals.map((sig) => (
                  <div
                    key={sig.odi_number}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-2xs space-y-2.5 text-xs flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          ODI #{sig.odi_number}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sig.severity_tier === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {sig.severity_tier}
                          </span>
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {sig.context_label}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Filed: {sig.filed_date}
                        </span>
                        {sig.crash && (
                          <span className="font-bold text-rose-600">Crash: Yes</span>
                        )}
                        {sig.injuries > 0 && (
                          <span className="font-bold text-rose-600">Injuries: {sig.injuries}</span>
                        )}
                      </div>

                      <p className="text-slate-700 italic leading-relaxed pt-1">
                        "{sig.summary_excerpt}"
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">
                        Component: {sig.components.join(', ')}
                      </span>
                      <a
                        href={sig.official_lookup_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <span>Inspect NHTSA Record</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer & Academic Rigor Footer */}
            <div className="text-center p-4 text-xs text-slate-500 border border-slate-200 rounded-xl bg-slate-50/50 space-y-1 font-mono">
              <p className="font-semibold text-slate-700">Methodology & Research Integrity Notice</p>
              <p className="max-w-2xl mx-auto text-[11px] leading-relaxed">
                {evidence.metadata.disclaimer}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
