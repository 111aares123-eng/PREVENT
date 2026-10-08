import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { WhyNowResponse } from '../../types/api';

interface WhyNowSectionProps {
  whyNow: WhyNowResponse;
  onSelectEventIds?: (eventIds: string[]) => void;
  activeEventIds?: string[];
  stage?: number;
}

export const WhyNowSection: React.FC<WhyNowSectionProps> = ({
  whyNow,
  onSelectEventIds,
  activeEventIds = [],
  stage = 5,
}) => {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
      {/* Editorial Section Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
            WHY NOW?
          </h2>
          <span
            className={`text-[11px] font-mono transition-all duration-300 ${
              stage >= 2
                ? 'text-slate-800 font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200'
                : 'text-slate-400'
            }`}
          >
            Pattern Convergence Intelligence
          </span>
        </div>

        <div
          style={{
            transition: stage < 5 ? 'opacity 350ms ease, transform 350ms ease' : undefined,
            opacity: stage >= 4 ? 1 : 0.25,
            transform: stage >= 4 ? 'translateY(0)' : 'translateY(4px)',
          }}
        >
          <p className="text-base sm:text-lg font-semibold text-slate-900 mt-2 leading-snug">
            {whyNow.headline}
          </p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-3xl">
            {whyNow.summary}
          </p>
        </div>
      </div>

      {/* Main Grid: Left Evidence List vs Right Risk Contribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Numbered Evidence Signals List (Thin Dividers, NOT separate cards) */}
        <div className="lg:col-span-7 space-y-1">
          <div
            className={`text-[10px] font-mono uppercase tracking-wider font-semibold mb-2 transition-colors duration-300 ${
              stage >= 2 ? 'text-slate-800' : 'text-slate-400'
            }`}
          >
            Convergent Evidence Pattern ({whyNow.signals.length} Signals)
          </div>

          <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
            {whyNow.signals.map((signal, idx) => {
              const numStr = String(idx + 1).padStart(2, '0');
              const isSelected =
                signal.evidence_event_ids.length > 0 &&
                signal.evidence_event_ids.some((id) => activeEventIds.includes(id));
              const isCritical = signal.severity === 'critical';

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (onSelectEventIds && signal.evidence_event_ids.length > 0) {
                      onSelectEventIds(signal.evidence_event_ids);
                    }
                  }}
                  style={{
                    transition: stage < 5 ? 'opacity 300ms ease, transform 300ms ease' : undefined,
                    transitionDelay: stage < 5 ? `${idx * 80}ms` : '0ms',
                    opacity: stage >= 1 ? 1 : 0.25,
                    transform: stage >= 1 ? 'translateY(0)' : 'translateY(4px)',
                  }}
                  className={`py-3 px-2 flex items-baseline justify-between gap-4 cursor-pointer transition-colors group ${
                    isSelected ? 'bg-amber-50/80 -mx-2 px-4 rounded' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-500 shrink-0">
                      {numStr}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-800 group-hover:text-amber-800 transition-colors block">
                        {signal.label}
                      </span>
                      <span
                        className={`text-[11px] font-mono mt-0.5 block ${
                          isCritical
                            ? 'text-rose-600 font-bold'
                            : 'text-slate-500'
                        }`}
                      >
                        {signal.value}
                      </span>
                    </div>
                  </div>

                  {signal.evidence_event_ids.length > 0 && (
                    <div className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-slate-500 group-hover:text-amber-700 transition-colors">
                      <span className="hidden sm:inline">Highlight</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 pt-2 font-mono">
            Click any pattern to locate corresponding evidence in the map and timeline.
          </p>
        </div>

        {/* Right: Formulaic Risk Contribution Table */}
        <div className="lg:col-span-5 bg-slate-50/70 p-5 rounded-md border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 mb-3 text-xs">
              <span className="font-mono font-bold uppercase tracking-wider text-slate-800">
                Risk Contribution
              </span>
              <span className="font-mono text-[10px] text-slate-500 uppercase">
                Points
              </span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {whyNow.factor_contributions.map((fc, idx) => (
                <div key={idx} className="flex items-center justify-between py-0.5">
                  <span className="text-slate-600 font-sans text-xs">
                    {fc.label}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                      <div
                        className="h-full bg-slate-700 rounded-full"
                        style={{ width: `${Math.min(100, (fc.points / 25) * 100)}%` }}
                      />
                    </div>
                    <span className="font-bold text-slate-800 w-10 text-right">
                      +{Math.round(fc.points)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 mt-4 flex items-center justify-between font-mono">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 font-sans">
              Current Risk
            </span>
            <span className="text-lg font-extrabold text-rose-600">
              {Math.round(whyNow.current_risk_score)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
