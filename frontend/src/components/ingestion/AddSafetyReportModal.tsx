import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Edit3,
  X,
  RefreshCw,
  Eye,
  Sliders,
  TrendingUp,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { api } from '../../services/api';
import type {
  EventIngestionResponse,
  EventCreateRequest
} from '../../types/api';

interface AddSafetyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventIngested?: (assetId: string) => void;
  availableAssetIds?: string[];
}

const SAMPLE_REPORTS = [
  {
    label: 'BUS-142 Brake Shudder',
    text: 'Driver reported that BUS-142 required significantly more distance to stop during heavy rain and the brake pedal felt abnormal.'
  },
  {
    label: 'BUS-204 Steering Pull',
    text: 'Morning driver report: BUS-204 exhibited severe steering pull to the left approaching highway speeds on Route 4.'
  },
  {
    label: 'TRK-089 Caliper Pressure',
    text: 'State transit safety spot audit on TRK-089: brake caliper air line differential pressure exceeded 12% between axles.'
  }
];

export const AddSafetyReportModal: React.FC<AddSafetyReportModalProps> = ({
  isOpen,
  onClose,
  onEventIngested,
  availableAssetIds = []
}) => {
  const navigate = useNavigate();

  // Wizard steps: 'input' -> 'preview' -> 'confirmed'
  const [step, setStep] = useState<'input' | 'preview' | 'confirmed'>('input');

  // Step 1: Input state
  const [reportText, setReportText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>('groq');
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  // Step 2: Extracted & editable state
  const [isEditing, setIsEditing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionError, setIngestionError] = useState<string | null>(null);

  // Form field state for editing / verification
  const [assetId, setAssetId] = useState('');
  const [eventType, setEventType] = useState('operational_report');
  const [subsystem, setSubsystem] = useState('braking');
  const [severity, setSeverity] = useState(3);
  const [source, setSource] = useState('driver');
  const [reporterRole, setReporterRole] = useState('driver');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [metadataWeather, setMetadataWeather] = useState('');

  // Step 3: Confirmation result state
  const [ingestionResult, setIngestionResult] = useState<EventIngestionResponse | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('input');
    setReportText('');
    setIsExtracting(false);
    setExtractionError(null);
    setFallbackNotice(null);
    setIsEditing(false);
    setValidationErrors([]);
    setIsIngesting(false);
    setIngestionError(null);
    setIngestionResult(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSelectSample = (text: string) => {
    setReportText(text);
    setExtractionError(null);
  };

  const handleExtract = async () => {
    if (!reportText.trim()) {
      setExtractionError('Please provide a safety report narrative before extracting.');
      return;
    }
    if (reportText.trim().length < 5) {
      setExtractionError('Report text is too short. Please provide more descriptive details.');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setValidationErrors([]);

    try {
      const response = await api.extractEvent(reportText);
      setActiveProvider(response.provider);

      if (response.fallback_used || response.fallback_message) {
        setFallbackNotice(
          response.fallback_message || 'Hosted AI providers temporarily unavailable — using local fallback.'
        );
      } else {
        setFallbackNotice(null);
      }

      if (response.validation_status === 'valid' && response.extracted_event) {
        const ev = response.extracted_event;
        setAssetId(ev.asset_id || '');
        setEventType(ev.event_type || 'operational_report');
        setSubsystem(ev.subsystem || 'braking');
        setSeverity(ev.severity || 3);
        setSource(ev.source || 'driver');
        setReporterRole(ev.reporter_role || 'driver');
        setDescription(ev.description || reportText);
        setLocation(ev.location || '');
        setMetadataWeather(ev.raw_metadata?.weather || '');
        setValidationErrors([]);
        setIsEditing(false);
        setStep('preview');
      } else {
        // Validation notice or invalid extraction
        const ev = response.extracted_event;
        if (ev) {
          setAssetId(ev.asset_id || '');
          setEventType(ev.event_type || 'operational_report');
          setSubsystem(ev.subsystem || 'braking');
          setSeverity(ev.severity || 3);
          setSource(ev.source || 'driver');
          setReporterRole(ev.reporter_role || 'driver');
          setDescription(ev.description || reportText);
          setLocation(ev.location || '');
          setMetadataWeather(ev.raw_metadata?.weather || '');
        } else {
          // Fallback to manual form populated from text
          setAssetId(availableAssetIds[0] || 'BUS-142');
          setDescription(reportText);
        }
        setValidationErrors(response.validation_errors || ['Extraction contains unverified fields. Please review and adjust.']);
        setIsEditing(true);
        setStep('preview');
      }
    } catch (err: any) {
      setExtractionError(
        err?.message ||
          'AI extraction service is currently unavailable. You can still input event parameters manually.'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmIngest = async () => {
    if (!assetId.trim()) {
      setIngestionError('A target Asset ID is required.');
      return;
    }
    if (!description.trim()) {
      setIngestionError('Event description cannot be empty.');
      return;
    }

    setIsIngesting(true);
    setIngestionError(null);

    const payload: EventCreateRequest = {
      asset_id: assetId.trim().toUpperCase(),
      event_type: eventType,
      subsystem: subsystem,
      severity: Number(severity),
      description: description.trim(),
      source: source.trim() || 'driver',
      reporter_role: reporterRole,
      location: location.trim() ? location.trim() : null,
      raw_metadata: metadataWeather.trim() ? { weather: metadataWeather.trim() } : undefined,
    };

    try {
      const result = await api.ingestEvent(payload);
      setIngestionResult(result);
      setStep('confirmed');
      if (onEventIngested) {
        onEventIngested(result.asset_id);
      }
    } catch (err: any) {
      setIngestionError(
        err?.message || 'Failed to ingest event into PREVENT. Please check connection and asset ID.'
      );
    } finally {
      setIsIngesting(false);
    }
  };

  const getSeverityBadgeClass = (sev: number) => {
    switch (sev) {
      case 5:
        return 'bg-red-500/20 text-red-300 border-red-500/50';
      case 4:
        return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
      case 3:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      case 2:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/50';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-gradient-to-b from-slate-900 to-[#0c121e] border border-slate-800 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Sparkles className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="modal-title" className="text-base font-bold text-white tracking-tight">
                  ADD SAFETY REPORT
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                  AI Ingestion
                </span>
                {fallbackNotice ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-700/60 uppercase flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Fallback: {activeProvider}</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-950/60 text-orange-400 border border-orange-800/40 uppercase">
                    Provider: {activeProvider}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Connecting human safety reports into PREVENT's explainable intelligence timeline.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* STEP 1: NATURAL LANGUAGE INPUT */}
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="safety-report-textarea" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Describe Warning, Complaint, Inspection Finding, or Near-Miss
                </label>
                <p className="text-xs text-slate-400 mb-2.5">
                  Paste verbatim driver shift log, passenger complaint, or maintenance observation.
                  PREVENT will extract normalized fields for verification.
                </p>
                <textarea
                  id="safety-report-textarea"
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Example: Driver reported that BUS-142 required significantly more distance to stop during heavy rain and the brake pedal felt abnormal."
                  rows={4}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700/80 p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors font-sans"
                />
                <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500 font-mono">
                  <span>Minimum 5 characters</span>
                  <span>{reportText.length} characters</span>
                </div>
              </div>

              {/* Sample Report Chips */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Or load a sample scenario:
                </span>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_REPORTS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSample(sample.text)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition-colors text-left"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extraction Error */}
              {extractionError && (
                <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1 text-xs text-red-200">
                    <p className="font-semibold uppercase tracking-wide">Extraction Issue</p>
                    <p className="mt-0.5 text-red-300">{extractionError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('preview');
                        setIsEditing(true);
                        setDescription(reportText);
                        setAssetId(availableAssetIds[0] || 'BUS-142');
                      }}
                      className="mt-2 text-xs font-semibold text-orange-400 hover:text-orange-300 underline"
                    >
                      Continue to manual entry instead →
                    </button>
                  </div>
                </div>
              )}

              {/* Architecture Safeguard Note */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5 flex items-start gap-3 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-200">Architectural Principle: </span>
                  The AI model only extracts structured fields. Risk scoring and evidence correlation
                  are performed strictly by PREVENT's explainable deterministic engine after human confirmation.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VERIFY EXTRACTED EVENT */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Fallback Notice Banner */}
              {fallbackNotice && (
                <div
                  id="fallback-notice-banner"
                  className="rounded-xl border border-amber-500/50 bg-amber-950/40 p-3.5 flex items-start gap-3 text-xs text-amber-200 shadow-lg shadow-amber-950/20"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase tracking-wider text-amber-300 text-xs">
                        Fallback Extraction Activated
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-200 border border-amber-700/50">
                        PROVIDER: {activeProvider.toUpperCase()}
                      </span>
                    </div>
                    <p className="font-semibold text-amber-200">
                      {fallbackNotice}
                    </p>
                    <p className="text-[11px] text-amber-300/80">
                      {activeProvider === 'gemini'
                        ? 'Extracted via Gemini secondary provider. Please review all fields before confirming.'
                        : "Due to temporary hosted capacity limits, this report was extracted using PREVENT's local heuristic parser. Review the fields below before persisting."}
                    </p>
                  </div>
                </div>
              )}

              {/* Header Banner */}
              <div className="flex items-center justify-between rounded-xl bg-slate-950/70 border border-slate-800 p-3.5">
                <div className="flex items-center gap-2.5">
                  {validationErrors.length > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {validationErrors.length > 0
                        ? 'VERIFICATION REQUIRED'
                        : 'EXTRACTED EVENT PREVIEW'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {validationErrors.length > 0
                        ? 'Please verify highlighted fields before ingesting.'
                        : 'Review structured event extracted from report text.'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isEditing ? 'Card View' : 'Edit Fields'}
                </button>
              </div>

              {/* Validation Errors Notice */}
              {validationErrors.length > 0 && (
                <div className="rounded-xl border border-amber-800/80 bg-amber-950/30 p-3.5 text-xs text-amber-200">
                  <p className="font-semibold uppercase tracking-wider text-amber-300">
                    Validation Attention Items:
                  </p>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-300/90">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ingestion Error */}
              {ingestionError && (
                <div className="rounded-xl border border-red-800 bg-red-950/40 p-3.5 flex items-start gap-2.5 text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Persistence Error</p>
                    <p className="mt-0.5 text-red-300">{ingestionError}</p>
                  </div>
                </div>
              )}

              {/* Card View Mode */}
              {!isEditing && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">
                        Target Asset
                      </span>
                      <span className="font-bold text-white text-sm mt-0.5 block">
                        {assetId || 'Unknown'}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">
                        Event Type
                      </span>
                      <span className="font-semibold text-slate-200 uppercase tracking-wide text-xs mt-0.5 block">
                        {eventType.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">
                        Subsystem
                      </span>
                      <span className="font-semibold text-slate-200 uppercase tracking-wide text-xs mt-0.5 block">
                        {subsystem}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">
                        Severity
                      </span>
                      <span
                        className={`inline-block font-bold text-xs px-2 py-0.5 rounded border mt-0.5 ${getSeverityBadgeClass(
                          severity
                        )}`}
                      >
                        {severity} / 5
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">
                        Source
                      </span>
                      <span className="text-slate-300 font-medium">{source}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">
                        Reporter Role
                      </span>
                      <span className="text-slate-300 font-medium capitalize">{reporterRole}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                      Description Narrative
                    </span>
                    <p className="text-xs text-slate-200 font-sans leading-relaxed">{description}</p>
                  </div>

                  {metadataWeather && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 text-[11px] font-mono">METADATA:</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                        weather: {metadataWeather}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Form Editing Mode */}
              {isEditing && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                        Asset ID
                      </label>
                      <input
                        type="text"
                        value={assetId}
                        onChange={(e) => setAssetId(e.target.value.toUpperCase())}
                        placeholder="e.g. BUS-142"
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 font-mono focus:border-orange-500 focus:outline-none"
                      />
                      {availableAssetIds.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {availableAssetIds.slice(0, 4).map((id) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setAssetId(id)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                            >
                              {id}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                        Severity (1 - 5)
                      </label>
                      <select
                        value={severity}
                        onChange={(e) => setSeverity(Number(e.target.value))}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:border-orange-500 focus:outline-none"
                      >
                        <option value={1}>1 - Negligible</option>
                        <option value={2}>2 - Minor</option>
                        <option value={3}>3 - Moderate</option>
                        <option value={4}>4 - Significant</option>
                        <option value={5}>5 - Critical Near-Miss</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                        Subsystem
                      </label>
                      <select
                        value={subsystem}
                        onChange={(e) => setSubsystem(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:border-orange-500 focus:outline-none"
                      >
                        <option value="braking">braking</option>
                        <option value="steering">steering</option>
                        <option value="electrical">electrical</option>
                        <option value="powertrain">powertrain</option>
                        <option value="suspension">suspension</option>
                        <option value="doors_body">doors_body</option>
                        <option value="hvac">hvac</option>
                        <option value="general">general</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                        Event Type
                      </label>
                      <select
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:border-orange-500 focus:outline-none"
                      >
                        <option value="operational_report">operational_report (driver log)</option>
                        <option value="maintenance">maintenance (workshop repair)</option>
                        <option value="inspection">inspection (safety audit)</option>
                        <option value="complaint">complaint (passenger feedback)</option>
                        <option value="near_miss">near_miss (close call)</option>
                        <option value="incident">incident (collision/breakdown)</option>
                        <option value="violation">violation (policy/speed)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                        Source
                      </label>
                      <input
                        type="text"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        placeholder="e.g. Driver Shift Incident Pad"
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                        Reporter Role
                      </label>
                      <select
                        value={reporterRole}
                        onChange={(e) => setReporterRole(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:border-orange-500 focus:outline-none"
                      >
                        <option value="driver">driver</option>
                        <option value="technician">technician</option>
                        <option value="passenger">passenger</option>
                        <option value="inspector">inspector</option>
                        <option value="safety_officer">safety_officer</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                      Narrative Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                        Location (Optional)
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Route 4 - 5th Ave"
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                        Weather Condition (Metadata)
                      </label>
                      <input
                        type="text"
                        value={metadataWeather}
                        onChange={(e) => setMetadataWeather(e.target.value)}
                        placeholder="e.g. heavy rain, snow, wet"
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: EVENT CONFIRMED & PERSISTED */}
          {step === 'confirmed' && ingestionResult && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Success Badge */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4.5 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-200 uppercase tracking-wide">
                    Safety Event Confirmed & Added to Timeline
                  </h3>
                  <p className="text-xs text-emerald-300/80 mt-0.5">
                    Target asset <span className="font-mono font-bold text-white">{ingestionResult.asset_id}</span> has
                    been re-evaluated through PREVENT's deterministic risk engine.
                  </p>
                </div>
              </div>

              {/* Before vs After Risk Comparison Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                    Previous Risk
                  </span>
                  <span className="text-2xl font-black text-slate-300 font-mono">
                    {ingestionResult.previous_risk_score.toFixed(1)}
                  </span>
                  <span className="text-[10px] block text-slate-400 mt-1 uppercase">
                    Level: {ingestionResult.previous_risk_level}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center relative overflow-hidden">
                  <span className="text-[10px] uppercase font-mono text-orange-400 font-semibold block mb-1">
                    Updated Risk Score
                  </span>
                  <span className="text-3xl font-black text-white font-mono">
                    {ingestionResult.updated_risk_score.toFixed(1)}
                  </span>
                  <span className="text-[10px] block text-slate-300 font-semibold mt-1 uppercase">
                    Level: {ingestionResult.updated_risk_level}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                    Risk Shift Delta
                  </span>
                  <span
                    className={`text-2xl font-black font-mono flex items-center justify-center gap-1 ${
                      ingestionResult.risk_score_delta > 0
                        ? 'text-red-400'
                        : ingestionResult.risk_score_delta < 0
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {ingestionResult.risk_score_delta > 0 && <TrendingUp className="w-5 h-5 text-red-400" />}
                    {ingestionResult.risk_score_delta > 0 ? '+' : ''}
                    {ingestionResult.risk_score_delta.toFixed(1)}
                  </span>
                  <span className="text-[10px] block text-slate-400 mt-1">
                    Confidence: {ingestionResult.updated_confidence.toFixed(0)}% (
                    {ingestionResult.confidence_delta >= 0 ? '+' : ''}
                    {ingestionResult.confidence_delta.toFixed(0)}%)
                  </span>
                </div>
              </div>

              {/* Why Did the Risk Change? Factor Breakdown */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-orange-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Why Did The Risk Change?
                  </h4>
                </div>

                <ul className="space-y-1.5 text-xs text-slate-300 font-sans">
                  {ingestionResult.why_risk_changed.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>

                {/* Mathematical Factor Waterfall Display */}
                <div className="pt-2 border-t border-slate-800/80 mt-2">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block mb-2">
                    Deterministic Factor Waterfall (Current Points):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                    {Object.entries(ingestionResult.factor_breakdown).map(([key, val]) => (
                      <div
                        key={key}
                        className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between items-center"
                      >
                        <span className="text-slate-400 text-[10px] truncate mr-1">
                          {key.replace('_points', '').replace('_', ' ')}
                        </span>
                        <span className="font-bold text-slate-200">
                          {typeof val === 'number' ? val.toFixed(1) : val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between rounded-b-2xl">
          {step === 'input' && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="text-xs text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExtracting || !reportText.trim()}
                onClick={handleExtract}
                className="inline-flex items-center gap-2 text-xs font-bold px-4.5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-950 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    Extracting Event...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Extract Structured Event
                  </>
                )}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={isIngesting}
                className="text-xs text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ← Back to Report
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isIngesting}
                  className="text-xs text-slate-400 hover:text-white px-3.5 py-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isIngesting || !assetId.trim()}
                  onClick={handleConfirmIngest}
                  className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950 transition-all disabled:opacity-50"
                >
                  {isIngesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      Ingesting & Recalculating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm & Add Event
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'confirmed' && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Add Another Report
              </button>
              <div className="flex items-center gap-2">
                {ingestionResult && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      navigate(`/assets/${ingestionResult.asset_id}`);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Asset Dossier
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-xs font-bold px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
