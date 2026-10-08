import React, { useState, useEffect } from 'react';
import {
  Eye,
  Search,
  AlertTriangle,
  OctagonAlert,
  Globe,
  UserCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Sliders,
  ChevronDown,
  ClipboardCheck
} from 'lucide-react';
import type { RiskLevel } from '../../types/api';
import {
  getRecommendedAction,
  getActionUiDictionary,
  type ActionLanguage,
  type ActionRole
} from '../../services/actionGuidance';

export interface RecommendedActionCardProps {
  recommendedAction?: string;
  riskLevel: RiskLevel | string;
  primarySubsystem?: string;
  assetId?: string;
  whyNowSummary?: string;
  initialLanguage?: ActionLanguage;
  className?: string;
  onExecuteProtocol?: () => void;
  onAcknowledgeAction?: () => void;
}

export type HumanDecision =
  | { type: 'NONE' }
  | { type: 'ACCEPTED'; at: string }
  | { type: 'CUSTOM'; actionText: string; at: string }
  | { type: 'DISMISSED'; reason: string; at: string };

export const RecommendedActionCard: React.FC<RecommendedActionCardProps> = ({
  riskLevel,
  primarySubsystem,
  assetId,
  whyNowSummary,
  initialLanguage = 'en',
  className = '',
  onExecuteProtocol,
  onAcknowledgeAction
}) => {
  const handleOpenAction = onExecuteProtocol || onAcknowledgeAction;

  // Multilingual preference (local UI state)
  const [language, setLanguage] = useState<ActionLanguage>(() => {
    // Check localStorage fallback if available
    try {
      const saved = localStorage.getItem('prevent_action_lang');
      if (saved === 'ta' || saved === 'hi' || saved === 'en') return saved;
    } catch {
      // ignore
    }
    return initialLanguage;
  });

  // Role perspective preference
  const [role, setRole] = useState<ActionRole>(() => {
    try {
      const saved = localStorage.getItem('prevent_action_role');
      if (saved === 'general' || saved === 'field_worker' || saved === 'supervisor' || saved === 'safety_officer') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'general';
  });

  // Active Field Action State from localStorage
  const [activeActionState, setActiveActionState] = useState<{
    status: string;
    acknowledgedAt?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!assetId) {
      setActiveActionState(null);
      return;
    }
    const checkState = () => {
      try {
        const saved = localStorage.getItem(`prevent_action_state_${assetId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.status && parsed.status !== 'NOT_STARTED') {
            setActiveActionState({
              status: parsed.status,
              acknowledgedAt: parsed.acknowledgedAt
            });
            return;
          }
        }
      } catch {
        // ignore
      }
      setActiveActionState(null);
    };

    checkState();
    window.addEventListener('storage', checkState);
    window.addEventListener('prevent_action_state_changed', checkState);
    return () => {
      window.removeEventListener('storage', checkState);
      window.removeEventListener('prevent_action_state_changed', checkState);
    };
  }, [assetId]);

  // Human decision / override state (UI-only, no database mutation)
  const [decision, setDecision] = useState<HumanDecision>({ type: 'NONE' });
  const [isCustomSelectOpen, setIsCustomSelectOpen] = useState(false);

  const guidance = getRecommendedAction(riskLevel, language, role);
  const ui = getActionUiDictionary(language);

  const handleRoleChange = (newRole: ActionRole) => {
    setRole(newRole);
    try {
      localStorage.setItem('prevent_action_role', newRole);
    } catch {
      // ignore
    }
  };

  const handleLanguageChange = (newLang: ActionLanguage) => {
    setLanguage(newLang);
    try {
      localStorage.setItem('prevent_action_lang', newLang);
    } catch {
      // ignore
    }
  };

  const handleAccept = () => {
    setDecision({
      type: 'ACCEPTED',
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    setIsCustomSelectOpen(false);
  };

  const handleCustomSelect = (text: string) => {
    setDecision({
      type: 'CUSTOM',
      actionText: text,
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    setIsCustomSelectOpen(false);
  };

  const handleDismiss = () => {
    setDecision({
      type: 'DISMISSED',
      reason: 'Operator review concluded no immediate dispatch change needed',
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    setIsCustomSelectOpen(false);
  };

  const handleResetDecision = () => {
    setDecision({ type: 'NONE' });
    setIsCustomSelectOpen(false);
  };

  // Visual styling based on risk category
  const isCritical = guidance.category === 'ISOLATE_ESCALATE';
  const isHigh = guidance.category === 'INSPECT_ESCALATE';
  const isMedium = guidance.category === 'INSPECT';

  const containerTheme = isCritical
    ? 'border-red-300 bg-red-50/70 text-red-950 shadow-xs'
    : isHigh
    ? 'border-rose-300 bg-rose-50/60 text-rose-950 shadow-xs'
    : isMedium
    ? 'border-amber-200 bg-amber-50/40 text-amber-950 shadow-xs'
    : 'border-slate-200 bg-slate-50 text-slate-900 shadow-xs';

  const badgeTheme = isCritical
    ? 'bg-red-700 text-white border-red-800'
    : isHigh
    ? 'bg-rose-700 text-white border-rose-800'
    : isMedium
    ? 'bg-amber-600 text-white border-amber-700'
    : 'bg-slate-700 text-white border-slate-800';

  const getCategoryIcon = () => {
    switch (guidance.category) {
      case 'ISOLATE_ESCALATE':
        return <OctagonAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />;
      case 'INSPECT_ESCALATE':
        return <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />;
      case 'INSPECT':
        return <Search className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />;
      case 'MONITOR':
      default:
        return <Eye className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" aria-hidden="true" />;
    }
  };

  return (
    <section
      aria-label="Recommended Operational Action"
      className={`rounded-lg p-5 border transition-all space-y-4 ${containerTheme} ${className}`}
    >
      {/* Header bar: Title Tag, Context, and Multilingual Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700">
            {guidance.headerTag}
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span
            className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${badgeTheme}`}
          >
            {guidance.title}
          </span>
          {primarySubsystem && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 border border-black/10 text-slate-700 uppercase">
              Target: {primarySubsystem.replace('_', ' ')}
            </span>
          )}
          {assetId && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 border border-black/10 text-slate-700">
              {assetId}
            </span>
          )}
          {activeActionState && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Action in Progress
            </span>
          )}
        </div>

        {/* Accessibility & Preferences Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Action Language Dropdown */}
          <div className="flex items-center gap-1.5 bg-white/90 px-2 py-1 rounded border border-black/10 shadow-2xs">
            <Globe className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <label htmlFor="action-lang-select" className="sr-only">
              {ui.languageSelectorLabel}
            </label>
            <select
              id="action-lang-select"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as ActionLanguage)}
              className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer pr-1"
            >
              <option value="en">English (EN)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>

          {/* Role Perspective Dropdown */}
          <div className="flex items-center gap-1.5 bg-white/90 px-2 py-1 rounded border border-black/10 shadow-2xs">
            <UserCheck className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <label htmlFor="action-role-select" className="sr-only">
              {ui.roleSelectorLabel}
            </label>
            <select
              id="action-role-select"
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as ActionRole)}
              className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer pr-1"
            >
              <option value="general">{ui.roles.general}</option>
              <option value="field_worker">{ui.roles.field_worker}</option>
              <option value="supervisor">{ui.roles.supervisor}</option>
              <option value="safety_officer">{ui.roles.safety_officer}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Action Content Area */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
        <div className="flex items-start gap-3.5 max-w-3xl">
          {getCategoryIcon()}
          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-950 leading-snug">
              {role === 'general' ? guidance.instruction : guidance.roleInstruction}
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
              {guidance.detail}
            </p>
            {whyNowSummary && (
              <div className="mt-2 text-xs text-slate-600 bg-white/60 p-2.5 rounded border border-black/5 font-sans">
                <span className="font-semibold text-slate-900 font-mono text-[11px] uppercase mr-1">
                  Why Now Evidence:
                </span>
                {whyNowSummary}
              </div>
            )}
          </div>
        </div>

        {/* Human Override Controls & Field Protocol Execution */}
        <div className="shrink-0 flex flex-col gap-2 min-w-[220px]">
          {handleOpenAction && (
            <div className="bg-white/90 p-3 rounded-lg border border-black/10 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
                  Field Protocol
                </span>
                {activeActionState ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    Action in Progress
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">Ready</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleOpenAction}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-amber-400" />
                {activeActionState ? 'Resume Field Protocol' : 'Execute Field Protocol'}
              </button>
            </div>
          )}

          {decision.type === 'NONE' ? (
            <div className="space-y-1.5 bg-white/90 p-3 rounded-lg border border-black/10 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 block">
                {ui.humanDecisionTitle}
              </span>

              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleAccept}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {ui.acceptButton}
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCustomSelectOpen(!isCustomSelectOpen)}
                    className="w-full inline-flex items-center justify-between gap-1 px-3 py-1.5 rounded text-xs font-medium bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 transition-colors cursor-pointer"
                  >
                    <span className="truncate">{ui.chooseDifferentButton}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </button>

                  {isCustomSelectOpen && (
                    <div className="absolute right-0 mt-1 w-64 bg-white rounded-md border border-slate-300 shadow-lg p-1.5 z-20 space-y-1 text-xs">
                      <button
                        type="button"
                        onClick={() => handleCustomSelect(ui.customOptions.scheduleDetailed)}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-100 text-slate-800 transition-colors"
                      >
                        {ui.customOptions.scheduleDetailed}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCustomSelect(ui.customOptions.placeWatchlist)}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-100 text-slate-800 transition-colors"
                      >
                        {ui.customOptions.placeWatchlist}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCustomSelect(ui.customOptions.requestReassessment)}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-100 text-slate-800 transition-colors"
                      >
                        {ui.customOptions.requestReassessment}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCustomSelect(ui.customOptions.verifyContinuedOperation)}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-100 text-slate-800 transition-colors"
                      >
                        {ui.customOptions.verifyContinuedOperation}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full text-center text-[11px] text-slate-500 hover:text-slate-800 py-1 transition-colors cursor-pointer"
                >
                  {ui.dismissButton}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/95 p-3 rounded-lg border border-black/10 shadow-xs space-y-2">
              <div className="flex items-start gap-2">
                {decision.type === 'ACCEPTED' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                {decision.type === 'CUSTOM' && (
                  <Sliders className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                )}
                {decision.type === 'DISMISSED' && (
                  <XCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block leading-tight font-sans">
                    {decision.type === 'ACCEPTED' && ui.decisionAccepted}
                    {decision.type === 'CUSTOM' && ui.decisionCustom}
                    {decision.type === 'DISMISSED' && ui.decisionDismissed}
                  </span>
                  {decision.type === 'CUSTOM' && (
                    <span className="text-[11px] text-slate-700 italic block mt-0.5">
                      "{decision.actionText}"
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 block font-mono mt-1">
                    Recorded at {decision.at}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetDecision}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer pt-1"
              >
                <RotateCcw className="w-3 h-3" />
                {ui.changeDecisionButton}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer Disclaimer: Transparent Decision Support */}
      <div className="flex items-center justify-between pt-2 border-t border-black/5 text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <span>{ui.disclaimer}</span>
        </div>
        <span className="text-[10px] text-slate-400 hidden sm:inline">
          DETERMINISTIC EVALUATION
        </span>
      </div>
    </section>
  );
};
