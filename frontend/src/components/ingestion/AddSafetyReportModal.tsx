import React, { useState, useEffect } from 'react';
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
  RotateCcw,
  Clock,
  Mic,
  FileText,
  Globe
} from 'lucide-react';
import { api } from '../../services/api';
import type {
  EventIngestionResponse,
  EventCreateRequest,
  EventExtractResponse,
  EventMetadata
} from '../../types/api';
import type { FieldActionOutcomePayload } from '../../types/actions';
import { AudioRecorder } from './AudioRecorder';
import { RecommendedActionCard } from '../assets/RecommendedActionCard';

interface AddSafetyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventIngested?: (assetId: string) => void;
  availableAssetIds?: string[];
  initialAssetId?: string;
  fieldContext?: FieldActionOutcomePayload | null;
}

const SAMPLE_REPORTS = [
  {
    label: 'BUS-142 Brake Shudder (EN)',
    text: 'Driver reported that BUS-142 required significantly more distance to stop during heavy rain and the brake pedal felt abnormal.'
  },
  {
    label: 'BUS-142 பிரேக் பழுது (Tamil)',
    text: 'BUS-142 கனமழையின் போது பிரேக் பெடல் மிகவும் கடினமாக இருந்தது மற்றும் வாகனம் தாமதமாக நின்றது என ஓட்டுநர் தெரிவித்தார்.'
  },
  {
    label: 'BUS-142 ब्रेक समस्या (Hindi)',
    text: 'ड्राइवर ने सूचना दी कि भारी बारिश में BUS-142 का ब्रेक पेडल बहुत सख्त हो गया था और रुकने में काफी अधिक दूरी लगी।'
  },
  {
    label: 'BUS-142 Tanglish Brake',
    text: 'BUS-142 heavy rain-la brake romba loose-ah irundhuchu, stop panna romba distance aachu endru driver report pannaru.'
  },
  {
    label: 'BUS-204 Steering Pull',
    text: 'Morning driver report: BUS-204 exhibited severe steering pull to the left approaching highway speeds on Route 4.'
  }
];

export const formatLanguageName = (lang?: string): string => {
  if (!lang) return 'Auto-detected';
  const clean = lang.toLowerCase().trim();
  switch (clean) {
    case 'en':
      return 'English';
    case 'ta':
      return 'Tamil (தமிழ்)';
    case 'hi':
      return 'Hindi (हिन्दी)';
    case 'ta-latn':
      return 'Tanglish (Tamil in Latin)';
    case 'hi-latn':
      return 'Hinglish (Hindi in Latin)';
    case 'code-mixed':
      return 'Code-Mixed';
    default:
      return lang.toUpperCase();
  }
};

export const AddSafetyReportModal: React.FC<AddSafetyReportModalProps> = ({
  isOpen,
  onClose,
  onEventIngested,
  availableAssetIds = [],
  initialAssetId = '',
  fieldContext = null
}) => {
  const navigate = useNavigate();

  // Wizard steps: 'input' -> 'preview' -> 'confirmed'
  const [step, setStep] = useState<'input' | 'preview' | 'confirmed'>('input');

  // Input method mode: 'text' or 'voice'
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');

  // Step 1: Input state
  const [reportText, setReportText] = useState(fieldContext?.initialReportText || '');
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    fieldContext?.assetId || initialAssetId || availableAssetIds[0] || 'BUS-142'
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>('groq');
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [extractionSource, setExtractionSource] = useState<'text' | 'voice'>('text');
  const [eventMetadata, setEventMetadata] = useState<EventMetadata | null>(null);

  // Synchronize when initialAssetId, availableAssetIds, fieldContext, or modal opens
  useEffect(() => {
    if (fieldContext) {
      if (fieldContext.assetId) {
        setSelectedAssetId(fieldContext.assetId);
        setAssetId(fieldContext.assetId);
      }
      if (fieldContext.primarySubsystem) {
        setSubsystem(fieldContext.primarySubsystem);
      }
      if (fieldContext.suggestedEventType) {
        setEventType(fieldContext.suggestedEventType);
      }
      if (fieldContext.suggestedReporterRole) {
        setReporterRole(fieldContext.suggestedReporterRole);
      }
      setSource('field_action');
      if (fieldContext.initialReportText) {
        setReportText(fieldContext.initialReportText);
      }
    } else if (initialAssetId) {
      setSelectedAssetId(initialAssetId);
    } else if (availableAssetIds.length > 0 && (!selectedAssetId || !availableAssetIds.includes(selectedAssetId))) {
      setSelectedAssetId(availableAssetIds[0]);
    }
  }, [initialAssetId, availableAssetIds, isOpen, fieldContext]);

  // Step 2: Extracted & editable state
  const [isEditing, setIsEditing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionError, setIngestionError] = useState<string | null>(null);

  const getNowLocalDateTime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };

  // Form field state for editing / verification
  const [assetId, setAssetId] = useState(fieldContext?.assetId || '');
  const [eventTimestamp, setEventTimestamp] = useState<string>(getNowLocalDateTime);
  const [eventType, setEventType] = useState(fieldContext?.suggestedEventType || 'operational_report');
  const [subsystem, setSubsystem] = useState(fieldContext?.primarySubsystem || 'braking');
  const [severity, setSeverity] = useState(3);
  const [source, setSource] = useState(fieldContext ? 'field_action' : 'driver');
  const [reporterRole, setReporterRole] = useState(fieldContext?.suggestedReporterRole || 'driver');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [metadataWeather, setMetadataWeather] = useState('');

  // Step 3: Confirmation result state
  const [ingestionResult, setIngestionResult] = useState<EventIngestionResponse | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('input');
    setInputMode('text');
    if (fieldContext) {
      setSelectedAssetId(fieldContext.assetId);
      setAssetId(fieldContext.assetId);
      setSubsystem(fieldContext.primarySubsystem || 'braking');
      setEventType(fieldContext.suggestedEventType || 'corrective_action');
      setReporterRole(fieldContext.suggestedReporterRole || 'technician');
      setSource('field_action');
      setReportText(fieldContext.initialReportText || '');
    } else {
      setReportText('');
      setSelectedAssetId(initialAssetId || availableAssetIds[0] || 'BUS-142');
    }
    setEventTimestamp(getNowLocalDateTime());
    setIsExtracting(false);
    setExtractionError(null);
    setFallbackNotice(null);
    setExtractionSource('text');
    setEventMetadata(null);
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
    if (!initialAssetId) {
      if (text.includes('BUS-142')) setSelectedAssetId('BUS-142');
      else if (text.includes('BUS-204')) setSelectedAssetId('BUS-204');
      else if (text.includes('TRK-089')) setSelectedAssetId('TRK-089');
    }
    setExtractionError(null);
  };

  const populateExtractedEvent = (
    response: EventExtractResponse,
    sourceMode: 'text' | 'voice',
    fallbackDesc = ''
  ) => {
    setActiveProvider(response.provider);
    setExtractionSource(sourceMode);

    if (response.fallback_used || response.fallback_message) {
      setFallbackNotice(
        response.fallback_message || 'Hosted AI providers temporarily unavailable — using local fallback.'
      );
    } else {
      setFallbackNotice(null);
    }

    const ev = response.extracted_event;
    if (ev) {
      setAssetId(selectedAssetId || ev.asset_id || '');

      // If field action context suggested an event type (e.g. corrective_action), prioritize it over generic fallback
      if (fieldContext?.suggestedEventType && (!ev.event_type || ev.event_type === 'operational_report')) {
        setEventType(fieldContext.suggestedEventType);
      } else {
        setEventType(ev.event_type || fieldContext?.suggestedEventType || 'operational_report');
      }

      setSubsystem(ev.subsystem || fieldContext?.primarySubsystem || 'braking');
      setSeverity(ev.severity || 3);
      setSource(ev.source || (fieldContext ? 'field_action' : sourceMode === 'voice' ? 'driver' : 'driver'));
      setReporterRole(fieldContext?.suggestedReporterRole || ev.reporter_role || 'driver');
      setDescription(ev.description || fallbackDesc || reportText);
      setLocation(ev.location || '');
      setMetadataWeather(ev.raw_metadata?.weather || '');
      setEventMetadata((ev.raw_metadata as EventMetadata) || null);

      if (ev.timestamp) {
        try {
          const d = new Date(ev.timestamp);
          if (!isNaN(d.getTime())) {
            const offset = d.getTimezoneOffset() * 60000;
            setEventTimestamp(new Date(d.getTime() - offset).toISOString().slice(0, 16));
          } else {
            setEventTimestamp(getNowLocalDateTime());
          }
        } catch {
          setEventTimestamp(getNowLocalDateTime());
        }
      } else {
        setEventTimestamp(getNowLocalDateTime());
      }

      if (response.validation_status === 'valid') {
        setValidationErrors([]);
        setIsEditing(false);
      } else {
        setValidationErrors(
          response.validation_errors || ['Extraction contains unverified fields. Please review and adjust.']
        );
        setIsEditing(true);
      }
      setStep('preview');
    } else {
      setAssetId(selectedAssetId || availableAssetIds[0] || 'BUS-142');
      setDescription(fallbackDesc || reportText);
      setEventTimestamp(getNowLocalDateTime());
      setValidationErrors(
        response.validation_errors || ['Extraction failed to produce an event. Please review and adjust manually.']
      );
      setIsEditing(true);
      setStep('preview');
    }
  };

  const handleExtract = async () => {
    if (!selectedAssetId.trim()) {
      setExtractionError('Please select or specify a target vehicle asset before extracting.');
      return;
    }
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
      const response = await api.extractEvent(reportText, selectedAssetId);
      populateExtractedEvent(response, 'text', reportText);
    } catch (err: any) {
      setExtractionError(
        err?.message ||
          'AI extraction service is currently unavailable. You can still input event parameters manually.'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleVoiceExtractionSuccess = (response: EventExtractResponse) => {
    const transcript = (response.extracted_event?.raw_metadata as EventMetadata)?.transcript || '';
    populateExtractedEvent(response, 'voice', transcript);
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

    let isoTimestamp: string;
    try {
      isoTimestamp = new Date(eventTimestamp).toISOString();
    } catch {
      isoTimestamp = new Date().toISOString();
    }

    const mergedMetadata: Record<string, any> = {
      ...(eventMetadata || {}),
      ...(metadataWeather.trim() ? { weather: metadataWeather.trim() } : {}),
    };

    const payload: EventCreateRequest = {
      asset_id: assetId.trim().toUpperCase(),
      event_type: eventType,
      subsystem: subsystem,
      severity: Number(severity),
      description: description.trim(),
      source: source.trim() || 'driver',
      reporter_role: reporterRole,
      timestamp: isoTimestamp,
      location: location.trim() ? location.trim() : null,
      raw_metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
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
        return 'bg-red-50 text-red-700 border-red-200';
      case 4:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 3:
        return 'bg-amber-50/50 text-amber-800 border-amber-200';
      case 2:
        return 'bg-slate-50 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-6"
    >
      <div className="relative w-full max-w-2xl rounded-lg bg-white border border-slate-200 shadow-xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 id="modal-title" className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
                  ADD SAFETY REPORT
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                  AI Ingestion
                </span>
                {fallbackNotice ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>Fallback: {activeProvider}</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                    Provider: {activeProvider}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-sans">
                Connecting field reports into PREVENT's explainable intelligence timeline.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* STEP 1: NATURAL LANGUAGE OR VOICE INPUT */}
          {step === 'input' && (
            <div className="space-y-4">
              {/* Linked Field Action Context Banner */}
              {fieldContext && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                      <span className="font-bold text-blue-950 font-mono text-[11px] uppercase tracking-wide">
                        Field Protocol Ingestion
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-200 text-blue-900 font-bold">
                        {fieldContext.assetId}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-blue-800 border border-blue-200 font-medium">
                        Target: {fieldContext.primarySubsystem}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                        {fieldContext.checklistCompletedCount}/{fieldContext.totalChecklistCount} Checks Completed
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold uppercase">
                        Suggested: {fieldContext.suggestedEventType}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-blue-800 font-sans leading-relaxed">
                    Review and verify the field observation below. You may edit text, switch to voice reporting, or adjust canonical parameters prior to explicit human confirmation.
                  </p>
                </div>
              )}

              {/* Target Fleet Asset Selector */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="target-asset-select" className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2 font-mono">
                    <span className="w-2 h-2 rounded-full bg-orange-600" />
                    Target Fleet Asset
                  </label>
                  {initialAssetId ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 uppercase font-semibold">
                      Asset Dossier: {initialAssetId}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-sans">
                  Select the vehicle asset to link with this safety observation. PREVENT enforces this asset ID authoritatively during extraction.
                </p>
                <div className="flex items-center gap-2">
                  <select
                    id="target-asset-select"
                    value={selectedAssetId}
                    onChange={(e) => {
                      setSelectedAssetId(e.target.value.toUpperCase());
                      setExtractionError(null);
                    }}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 font-mono font-bold focus:border-slate-900 focus:outline-none"
                  >
                    <option value="">-- Choose Target Fleet Asset --</option>
                    {(availableAssetIds.length > 0
                      ? availableAssetIds
                      : ['BUS-142', 'BUS-204', 'TRK-089', 'BUS-105', 'VAN-012', 'BUS-301', 'TRK-044', 'BUS-512']
                    ).map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Input Method Switcher: [Type Report] [Voice Report] */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 w-fit">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('text');
                      setExtractionError(null);
                    }}
                    className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-1.5 rounded transition-all cursor-pointer ${
                      inputMode === 'text'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Type Report
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('voice');
                      setExtractionError(null);
                    }}
                    className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-1.5 rounded transition-all cursor-pointer ${
                      inputMode === 'voice'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5 text-orange-600" />
                    Voice Report
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                  <Globe className="w-3 h-3 text-slate-400" />
                  <span>Supports English, தமிழ், हिन्दी, Tanglish, Hinglish</span>
                </div>
              </div>

              {/* Sub-view A: VOICE RECORDER */}
              {inputMode === 'voice' && (
                <AudioRecorder
                  assetId={selectedAssetId}
                  onExtractionSuccess={handleVoiceExtractionSuccess}
                  onSwitchToText={() => setInputMode('text')}
                />
              )}

              {/* Sub-view B: TEXT INPUT */}
              {inputMode === 'text' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="safety-report-textarea" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1 font-mono">
                      Describe Warning, Complaint, Inspection Finding, or Near-Miss
                    </label>
                    <p className="text-xs text-slate-500 mb-2 font-sans">
                      Paste verbatim driver shift log, passenger complaint, or maintenance observation in English, Tamil, Hindi, or code-mixed text. PREVENT will extract normalized fields for verification.
                    </p>
                    <textarea
                      id="safety-report-textarea"
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                      placeholder="Example: Driver reported that BUS-142 required significantly more distance to stop during heavy rain and the brake pedal felt abnormal. / கனமழையில் பிரேக் பெடல் மிகவும் கடினமாக இருந்தது."
                      rows={4}
                      className="w-full rounded border border-slate-200 p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 transition-colors font-sans"
                    />
                    <div className="flex justify-between items-center mt-1 text-[11px] text-slate-400 font-mono">
                      <span>Minimum 5 characters</span>
                      <span>{reportText.length} characters</span>
                    </div>
                  </div>

                  {/* Sample Report Chips */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2 font-mono">
                      Sample multilingual scenarios:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_REPORTS.map((sample, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSample(sample.text)}
                          className="text-xs font-medium px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors text-left cursor-pointer"
                        >
                          {sample.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Extraction Error */}
                  {extractionError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                      <div className="flex-1 text-xs text-red-700">
                        <p className="font-semibold uppercase tracking-wide">Extraction Issue</p>
                        <p className="mt-0.5">{extractionError}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setStep('preview');
                            setIsEditing(true);
                            setDescription(reportText);
                            setAssetId(selectedAssetId || availableAssetIds[0] || 'BUS-142');
                          }}
                          className="mt-2 text-xs font-semibold text-red-800 underline cursor-pointer"
                        >
                          Continue to manual entry instead →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Architecture Safeguard Note */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-start gap-2.5 text-xs text-slate-600 font-sans">
                    <ShieldCheck className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800">Operational Integrity: </span>
                      The AI model only extracts structured fields. Risk scoring and evidence correlation
                      are performed strictly by PREVENT's explainable deterministic engine after human confirmation.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PREVIEW & VERIFY EXTRACTED EVENT */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Fallback Notice Banner */}
              {fallbackNotice && (
                <div
                  id="fallback-notice-banner"
                  className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-3 text-xs text-amber-900"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase tracking-wider text-amber-900 text-xs font-mono">
                        Fallback Extraction Activated
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                        PROVIDER: {activeProvider.toUpperCase()}
                      </span>
                    </div>
                    <p className="font-semibold text-amber-900">
                      {fallbackNotice}
                    </p>
                    <p className="text-[11px] text-amber-800">
                      {activeProvider === 'gemini'
                        ? 'Extracted via Gemini secondary provider. Please review all fields before confirming.'
                        : "Due to temporary hosted capacity limits, this report was extracted using PREVENT's local heuristic parser. Review the fields below before persisting."}
                    </p>
                  </div>
                </div>
              )}

              {/* Voice Observation Audio Evidence Card */}
              {eventMetadata?.transcript && (
                <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center">
                        <Mic className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wide">
                          Voice Observation Evidence
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Spoken report transcribed and normalized for verification
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {eventMetadata.detected_language && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-800 font-medium">
                          <Globe className="w-3 h-3 text-slate-500" />
                          {formatLanguageName(eventMetadata.detected_language)}
                        </span>
                      )}
                      {eventMetadata.transcription_provider && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {eventMetadata.transcription_provider}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-white border border-slate-200">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                      Spoken Transcript
                    </span>
                    <p className="text-xs text-slate-800 italic font-sans leading-relaxed">
                      "{eventMetadata.transcript}"
                    </p>
                  </div>
                </div>
              )}

              {/* Multilingual Text Observation Context Card */}
              {!eventMetadata?.transcript && eventMetadata?.original_text && eventMetadata?.detected_language && eventMetadata.detected_language !== 'en' && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-700" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wide">
                          Multilingual Observation Input
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Normalized to standard safety taxonomy for deterministic scoring
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-800 font-medium">
                      <Globe className="w-3 h-3 text-slate-500" />
                      {formatLanguageName(eventMetadata.detected_language)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-white border border-slate-200">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                      Original Input Text
                    </span>
                    <p className="text-xs text-slate-800 italic font-sans leading-relaxed">
                      "{eventMetadata.original_text}"
                    </p>
                  </div>
                </div>
              )}

              {/* Header Banner */}
              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 p-3">
                <div className="flex items-center gap-2.5">
                  {validationErrors.length > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-slate-700" />
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-900 block font-mono">
                      {validationErrors.length > 0
                        ? 'VERIFICATION REQUIRED'
                        : 'EXTRACTED EVENT PREVIEW'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-sans">
                      {validationErrors.length > 0
                        ? 'Please verify highlighted fields before ingesting.'
                        : extractionSource === 'voice' || eventMetadata?.transcript
                        ? 'Review structured event extracted from voice report.'
                        : 'Review structured event extracted from report text.'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isEditing ? 'Card View' : 'Edit Fields'}
                </button>
              </div>

              {/* Linked Field Protocol Context */}
              {fieldContext && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                    <div>
                      <span className="font-bold text-blue-950 font-mono text-[11px] uppercase block">
                        Linked Field Action Protocol: {fieldContext.assetId}
                      </span>
                      <span className="text-[11px] text-blue-800 font-sans">
                        {fieldContext.checklistCompletedCount}/{fieldContext.totalChecklistCount} Checks Completed • Subsystem: {fieldContext.primarySubsystem}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-200 text-blue-900 font-bold uppercase shrink-0">
                    {eventType}
                  </span>
                </div>
              )}

              {/* Validation Errors Notice */}
              {validationErrors.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold uppercase tracking-wider text-amber-900 font-mono">
                    Validation Attention Items:
                  </p>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-800">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ingestion Error */}
              {ingestionError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2.5 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Persistence Error</p>
                    <p className="mt-0.5">{ingestionError}</p>
                  </div>
                </div>
              )}

              {/* Card View Mode */}
              {!isEditing && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">
                        Target Asset
                      </span>
                      <span className="font-bold text-slate-900 text-sm mt-0.5 block font-mono">
                        {assetId || 'Unknown'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">
                        Event Type
                      </span>
                      <span className="font-semibold text-slate-800 uppercase tracking-wide text-xs mt-0.5 block">
                        {eventType.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">
                        Subsystem
                      </span>
                      <span className="font-semibold text-slate-800 uppercase tracking-wide text-xs mt-0.5 block">
                        {subsystem}
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">
                        Source
                      </span>
                      <span className="text-slate-800 font-medium">{source}</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">
                        Reporter Role
                      </span>
                      <span className="text-slate-800 font-medium capitalize">{reporterRole}</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">
                          Event Time
                        </span>
                        <span className="text-slate-800 font-medium font-mono text-[11px]">
                          {eventTimestamp ? new Date(eventTimestamp).toLocaleString() : 'Current Time'}
                        </span>
                      </div>
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    </div>
                  </div>

                  <div className="p-3 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                      Description Narrative
                    </span>
                    <p className="text-xs text-slate-800 font-sans leading-relaxed">{description}</p>
                  </div>

                  {metadataWeather && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 text-[11px] font-mono">METADATA:</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                        weather: {metadataWeather}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Form Editing Mode */}
              {isEditing && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1 font-mono">
                        Asset ID
                      </label>
                      <input
                        type="text"
                        value={assetId}
                        onChange={(e) => setAssetId(e.target.value.toUpperCase())}
                        placeholder="e.g. BUS-142"
                        className="w-full rounded border border-slate-200 px-3 py-1.5 text-slate-900 font-mono focus:border-slate-900 focus:outline-none"
                      />
                      {availableAssetIds.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {availableAssetIds.slice(0, 4).map((id) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setAssetId(id)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:text-slate-900"
                            >
                              {id}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1 font-mono">
                        Severity (1 - 5)
                      </label>
                      <select
                        value={severity}
                        onChange={(e) => setSeverity(Number(e.target.value))}
                        className="w-full rounded border border-slate-200 px-3 py-1.5 text-slate-900 focus:border-slate-900 focus:outline-none"
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
                      <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1 font-mono">
                        Subsystem
                      </label>
                      <select
                        value={subsystem}
                        onChange={(e) => setSubsystem(e.target.value)}
                        className="w-full rounded border border-slate-200 px-3 py-1.5 text-slate-900 focus:border-slate-900 focus:outline-none"
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
                      <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1 font-mono">
                        Event Type
                      </label>
                      <select
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                        className="w-full rounded border border-slate-200 px-3 py-1.5 text-slate-900 focus:border-slate-900 focus:outline-none"
                      >
                        <option value="corrective_action">corrective_action (hazard mitigation / repair)</option>
                        <option value="operational_report">operational_report (field / driver log)</option>
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
                      <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1 font-mono">
                        Source
                      </label>
                      <input
                        type="text"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        placeholder="e.g. Driver Shift Incident Pad"
                        className="w-full rounded border border-slate-200 px-3 py-1.5 text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1 font-mono">
                        Reporter Role
                      </label>
                      <select
                        value={reporterRole}
                        onChange={(e) => setReporterRole(e.target.value)}
                        className="w-full rounded border border-slate-200 px-3 py-1.5 text-slate-900 focus:border-slate-900 focus:outline-none"
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
                    <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1 font-mono">
                      Narrative Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded border border-slate-200 px-3 py-1.5 text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold uppercase text-slate-600 flex items-center gap-1.5 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          Event Time (Local)
                        </label>
                        <button
                          type="button"
                          onClick={() => setEventTimestamp(getNowLocalDateTime())}
                          className="text-[10px] text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          Set to Now
                        </button>
                      </div>
                      <input
                        type="datetime-local"
                        value={eventTimestamp}
                        onChange={(e) => setEventTimestamp(e.target.value)}
                        className="w-full rounded border border-slate-200 px-3 py-1.5 text-slate-900 font-mono focus:border-slate-900 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Editable for back-dated or historical reports. Evaluated in UTC.
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1 font-mono">
                        Location (Optional)
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Route 4 - 5th Ave"
                        className="w-full rounded border border-slate-200 px-3 py-1.5 text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1 font-mono">
                      Weather Condition (Metadata)
                    </label>
                    <input
                      type="text"
                      value={metadataWeather}
                      onChange={(e) => setMetadataWeather(e.target.value)}
                      placeholder="e.g. heavy rain, snow, wet"
                      className="w-full rounded border border-slate-200 px-3 py-1.5 text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  {eventMetadata?.transcript !== undefined && (
                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1 font-mono">
                        Voice Spoken Transcript
                      </label>
                      <textarea
                        value={eventMetadata.transcript}
                        onChange={(e) =>
                          setEventMetadata((prev) => ({
                            ...prev,
                            transcript: e.target.value
                          }))
                        }
                        rows={2}
                        className="w-full rounded border border-slate-200 px-3 py-1.5 text-slate-900 font-sans italic focus:border-slate-900 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Original voice transcript recorded for audit trail provenance.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: EVENT CONFIRMED & PERSISTED */}
          {step === 'confirmed' && ingestionResult && (
            <div className="space-y-4">
              {/* Success Badge */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wide font-mono">
                    Safety Event Confirmed & Added to Timeline
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Target asset <span className="font-mono font-bold">{ingestionResult.asset_id}</span> has
                    been re-evaluated through PREVENT's deterministic risk engine.
                  </p>
                </div>
              </div>

              {/* Before vs After Risk Comparison Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-sans text-slate-500 font-semibold block mb-1">
                    Previous Risk
                  </span>
                  <span className="text-2xl font-bold text-slate-900 font-mono">
                    {ingestionResult.previous_risk_score.toFixed(1)}
                  </span>
                  <span className="text-[10px] block text-slate-500 mt-1 uppercase font-sans">
                    Level: {ingestionResult.previous_risk_level}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-sans text-slate-500 font-semibold block mb-1">
                    Updated Risk Score
                  </span>
                  <span className="text-2xl font-bold text-slate-900 font-mono">
                    {ingestionResult.updated_risk_score.toFixed(1)}
                  </span>
                  <span className="text-[10px] block text-slate-500 font-sans mt-1 uppercase">
                    Level: {ingestionResult.updated_risk_level}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-sans text-slate-500 font-semibold block mb-1">
                    Risk Shift Delta
                  </span>
                  <span
                    className={`text-2xl font-bold font-mono flex items-center justify-center gap-1 ${
                      ingestionResult.risk_score_delta > 0
                        ? 'text-rose-600'
                        : ingestionResult.risk_score_delta < 0
                        ? 'text-emerald-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {ingestionResult.risk_score_delta > 0 && <TrendingUp className="w-4 h-4 text-rose-600" />}
                    {ingestionResult.risk_score_delta > 0 ? '+' : ''}
                    {ingestionResult.risk_score_delta.toFixed(1)}
                  </span>
                  <span className="text-[10px] block text-slate-500 font-sans mt-1">
                    Confidence: {ingestionResult.updated_confidence.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Why Did the Risk Change? Factor Breakdown */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <h4 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider">
                    Why Did The Risk Change?
                  </h4>
                </div>

                <ul className="space-y-1 text-xs text-slate-700 font-sans">
                  {ingestionResult.why_risk_changed.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>

                {/* Mathematical Factor Waterfall Display */}
                <div className="pt-2 border-t border-slate-200 mt-2">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold block mb-2">
                    Deterministic Factor Waterfall (Current Points):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                    {Object.entries(ingestionResult.factor_breakdown).map(([key, val]) => (
                      <div
                        key={key}
                        className="p-2 rounded bg-slate-50 border border-slate-200 flex justify-between items-center"
                      >
                        <span className="text-slate-500 text-[10px] truncate mr-1">
                          {key.replace('_points', '').replace('_', ' ')}
                        </span>
                        <span className="font-bold text-slate-900">
                          {typeof val === 'number' ? val.toFixed(1) : val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommended Operational Action (Multilingual & Human-Decision Supported) */}
              <RecommendedActionCard
                riskLevel={ingestionResult.updated_risk_level}
                assetId={ingestionResult.asset_id}
                whyNowSummary={ingestionResult.why_risk_changed?.[0]}
              />
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-lg">
          {step === 'input' && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {inputMode === 'text' ? (
                <button
                  type="button"
                  disabled={isExtracting || !reportText.trim() || !selectedAssetId.trim()}
                  onClick={handleExtract}
                  className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isExtracting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                      Extracting Event...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Extract Structured Event
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setInputMode('text')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Switch to Text Input
                </button>
              )}
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={isIngesting}
                className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ← Back to Report
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isIngesting}
                  className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isIngesting || !assetId.trim()}
                  onClick={handleConfirmIngest}
                  className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isIngesting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                      Ingesting & Recalculating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
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
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
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
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Asset Dossier
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-xs font-semibold px-4 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
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
