import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckSquare,
  Square,
  Play,
  RotateCcw,
  Clock,
  AlertTriangle,
  Globe,
  UserCheck,
  ClipboardList,
  CheckCircle2
} from 'lucide-react';
import type { RiskLevel } from '../../types/api';
import type {
  FieldActionStatus,
  FieldActionChecklist,
  FieldActionState,
  FieldActionOutcomePayload,
  FieldActionOutcomeChoice
} from '../../types/actions';
import {
  getRecommendedAction,
  type ActionLanguage,
  type ActionRole
} from '../../services/actionGuidance';

interface FieldActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  riskLevel: RiskLevel | string;
  riskScore: number;
  primarySubsystem: string;
  whyNowSummary?: string;
  initialLanguage?: ActionLanguage;
  initialRole?: ActionRole;
  onReportOutcome: (payload: FieldActionOutcomePayload) => void;
}

const CHECKLIST_TRANSLATIONS: Record<
  ActionLanguage,
  {
    modalTitle: string;
    subheading: string;
    statusLabels: Record<FieldActionStatus, string>;
    acknowledgeBtn: string;
    acknowledgeDetail: string;
    checklistTitle: string;
    checklistSubtitle: string;
    items: {
      isolationInspection: { title: string; desc: string };
      toleranceVerification: { title: string; desc: string };
      functionalCheck: { title: string; desc: string };
    };
    outcomeOptions: {
      sectionTitle: string;
      sectionSubtitle: string;
      correctiveAction: { label: string; desc: string; badge: string };
      anomalyConfirmed: { label: string; desc: string; badge: string };
    };
    reportOutcomeBtn: string;
    reportOutcomeHelp: string;
    resetBtn: string;
    resetConfirm: string;
    disclaimer: string;
    notesLabel: string;
    notesPlaceholder: string;
  }
> = {
  en: {
    modalTitle: 'Field Action',
    subheading: 'Human-guided inspection and mitigation procedure',
    statusLabels: {
      NOT_STARTED: 'Awaiting Acknowledgment',
      ACKNOWLEDGED: 'Acknowledged',
      IN_PROGRESS: 'Protocol in Progress',
      OUTCOME_PENDING: 'Outcome Ready for Ingestion'
    },
    acknowledgeBtn: 'Acknowledge & Begin',
    acknowledgeDetail: 'Clicking records formal operational acknowledgment and activates the safety checklist.',
    checklistTitle: 'Generic Safety Checklist',
    checklistSubtitle: 'Complete all physical safety verifications prior to reporting the outcome',
    items: {
      isolationInspection: {
        title: 'Subsystem Isolation & Visual Inspection',
        desc: 'Safely secure target subsystem and inspect for visible structural faults, leaks, or loose assemblies.'
      },
      toleranceVerification: {
        title: 'Wear & Operating Tolerance Verification',
        desc: 'Measure component clearance, friction surfaces, and ensure physical parameters meet nominal thresholds.'
      },
      functionalCheck: {
        title: 'Operational Functional Check',
        desc: 'Perform a controlled activation test to verify normal responsiveness without abnormal vibration or resistance.'
      }
    },
    outcomeOptions: {
      sectionTitle: 'Field Action Outcome Protocol',
      sectionSubtitle: 'Select the verified operational outcome of the field protocol',
      correctiveAction: {
        label: 'Corrective Action Completed',
        desc: 'Target subsystem inspected, tolerances verified, and physical corrections or repairs completed.',
        badge: 'corrective_action'
      },
      anomalyConfirmed: {
        label: 'Anomaly Confirmed / Escalation Required',
        desc: 'Persistent defect, abnormal wear, or out-of-tolerance condition confirmed during checks.',
        badge: 'escalate anomaly'
      }
    },
    reportOutcomeBtn: 'Report Action Outcome',
    reportOutcomeHelp: 'Passes verified findings into PREVENT event ingestion to update the deterministic risk score.',
    resetBtn: 'Reset Protocol State',
    resetConfirm: 'Reset local action progress? Existing safety events will remain untouched.',
    disclaimer: 'PREVENT provides decision support. Operational safety decisions rest with the responsible human authority.',
    notesLabel: 'Field Observations & Technician Remarks (Optional)',
    notesPlaceholder: 'Enter brief notes on findings, part condition, or adjustments made...'
  },
  ta: {
    modalTitle: 'கள நடவடிக்கை (Field Action)',
    subheading: 'மனித வழிகாட்டுதல் கொண்ட ஆய்வு மற்றும் தணிப்பு நடைமுறை',
    statusLabels: {
      NOT_STARTED: 'ஏற்புக்காக காத்திருக்கிறது',
      ACKNOWLEDGED: 'ஏற்றுக்கொள்ளப்பட்டது',
      IN_PROGRESS: 'நெறிமுறை செயல்பாட்டில் உள்ளது',
      OUTCOME_PENDING: 'முடிவு பதிவு செய்யத் தயார்'
    },
    acknowledgeBtn: 'ஏற்றுக்கொண்டு தொடங்கவும் (Acknowledge & Begin)',
    acknowledgeDetail: 'கிளிக் செய்வதன் மூலம் முறையான ஒப்புதல் பதிவு செய்யப்பட்டு பாதுகாப்பு சரிபார்ப்புப் பட்டியல் செயல்படுத்தப்படும்.',
    checklistTitle: 'பொதுவான பாதுகாப்பு சரிபார்ப்புப் பட்டியல்',
    checklistSubtitle: 'முடிவை அறிக்கையிடுவதற்கு முன் அனைத்து உடல் பாதுகாப்பு சரிபார்ப்புகளையும் முடிக்கவும்',
    items: {
      isolationInspection: {
        title: 'துணை அமைப்பு தனிமைப்படுத்தல் மற்றும் காட்சி ஆய்வு',
        desc: 'பாதிக்கப்பட்ட துணை அமைப்பைப் பாதுகாத்து, வெளிப்புறக் குறைபாடுகள் அல்லது கசிவுகளை ஆய்வு செய்யவும்.'
      },
      toleranceVerification: {
        title: 'தேய்மானம் மற்றும் இயக்க சகிப்புத்தன்மை சரிபார்ப்பு',
        desc: 'கூறு இடைவெளி, உராய்வு பரப்புகளை அளவிட்டு, அனுமதிக்கப்பட்ட வரம்பிற்குள் உள்ளதா என சரிபார்க்கவும்.'
      },
      functionalCheck: {
        title: 'செயல்பாட்டு பயன்பாட்டு சோதனை',
        desc: 'கட்டுப்படுத்தப்பட்ட செயல்படுத்தல் சோதனை மூலம் அசாதாரண அதிர்வு அல்லது தாமதம் இன்றி இயங்குவதை உறுதிப்படுத்தவும்.'
      }
    },
    outcomeOptions: {
      sectionTitle: 'கள நடவடிக்கை முடிவு (Outcome Protocol)',
      sectionSubtitle: 'கள ஆய்வின் செயல்பாட்டு முடிவைத் தேர்ந்தெடுக்கவும்',
      correctiveAction: {
        label: 'சரிசெய்தல் நடவடிக்கை முடிந்தது (Corrective Action Completed)',
        desc: 'இலக்கு துணை அமைப்பு ஆய்வு செய்யப்பட்டு தேவையான திருத்தங்கள் அல்லது பழுதுகள் முடிக்கப்பட்டன.',
        badge: 'corrective_action'
      },
      anomalyConfirmed: {
        label: 'முரண்பாடு உறுதி செய்யப்பட்டது (Anomaly Confirmed / Escalation)',
        desc: 'தொடர்ச்சியான குறைபாடு அல்லது அசாதாரண தேய்மானம் உறுதி செய்யப்பட்டு உயர் மட்ட ஆய்வு தேவைப்படுகிறது.',
        badge: 'escalate anomaly'
      }
    },
    reportOutcomeBtn: 'Report Action Outcome (முடிவை பதிவு செய்க)',
    reportOutcomeHelp: 'கண்டறியப்பட்ட தகவல்களை PREVENT நிகழ்வு உள்ளீட்டிற்கு அனுப்பி கணக்கிடப்பட்ட அபாய மதிப்பீட்டைப் புதுப்பிக்கவும்.',
    resetBtn: 'நெறிமுறை நிலையை மீட்டமை',
    resetConfirm: 'உள்ளூர் முன்னேற்றத்தை மீட்டமைக்கவா? ஏற்கனவே உள்ள பாதுகாப்பு நிகழ்வுகள் பாதிக்கப்படாது.',
    disclaimer: 'PREVENT முடிவு ஆதரவை மட்டுமே வழங்குகிறது. இறுதி பாதுகாப்பு முடிவு மனித அதிகாரியையே சார்ந்துள்ளது.',
    notesLabel: 'கள அவதானிப்புகள் மற்றும் தொழில்நுட்பக் குறிப்புகள் (விருப்பத்தேர்வு)',
    notesPlaceholder: 'கண்டறியப்பட்ட குறைபாடுகள் அல்லது செய்யப்பட்ட மாற்றங்கள் குறித்த சுருக்கமான குறிப்புகள்...'
  },
  hi: {
    modalTitle: 'फ़ील्ड कार्रवाई (Field Action)',
    subheading: 'मानव-निर्देशित निरीक्षण और शमन प्रक्रिया',
    statusLabels: {
      NOT_STARTED: 'स्वीकृति की प्रतीक्षा',
      ACKNOWLEDGED: 'स्वीकृत',
      IN_PROGRESS: 'प्रोटोकॉल प्रगति पर है',
      OUTCOME_PENDING: 'परिणाम दर्ज करने हेतु तैयार'
    },
    acknowledgeBtn: 'स्वीकार करें और शुरू करें (Acknowledge & Begin)',
    acknowledgeDetail: 'क्लिक करने से औपचारिक स्वीकृति दर्ज होती है और सुरक्षा चेकलिस्ट सक्रिय हो जाती है।',
    checklistTitle: 'सामान्य सुरक्षा चेकलिस्ट',
    checklistSubtitle: 'परिणाम रिपोर्ट करने से पहले सभी भौतिक सुरक्षा सत्यापन पूरे करें',
    items: {
      isolationInspection: {
        title: 'उपप्रणाली अलगाव और दृश्य निरीक्षण',
        desc: 'लक्षित उपप्रणाली को सुरक्षित करें और दृश्यमान दोषों, रिसाव या ढीले घटकों का निरीक्षण करें।'
      },
      toleranceVerification: {
        title: 'घिसाव और परिचालन सहनशीलता सत्यापन',
        desc: 'घटक निकासी, घर्षण सतहों को मापें और सुनिश्चित करें कि पैरामीटर मानक सीमा के भीतर हैं।'
      },
      functionalCheck: {
        title: 'परिचालन कार्यात्मक जाँच',
        desc: 'असामान्य कंपन या प्रतिरोध के बिना सामान्य प्रतिक्रिया को सत्यापित करने के लिए नियंत्रित परीक्षण करें।'
      }
    },
    outcomeOptions: {
      sectionTitle: 'फ़ील्ड कार्रवाई परिणाम प्रोटोकॉल (Outcome Protocol)',
      sectionSubtitle: 'फ़ील्ड निरीक्षण प्रोटोकॉल का सत्यापित परिचालन परिणाम चुनें',
      correctiveAction: {
        label: 'सुधारात्मक कार्रवाई पूर्ण (Corrective Action Completed)',
        desc: 'उपप्रणाली का निरीक्षण, सहनशीलता सत्यापन और भौतिक सुधार पूर्ण किए गए।',
        badge: 'corrective_action'
      },
      anomalyConfirmed: {
        label: 'विसंगति की पुष्टि / वृद्धि आवश्यक (Anomaly Confirmed)',
        desc: 'लगातार दोष या असामान्य टूट-फूट की पुष्टि हुई है जिसके लिए सुरक्षा वृद्धि आवश्यक है।',
        badge: 'escalate anomaly'
      }
    },
    reportOutcomeBtn: 'Report Action Outcome (परिणाम रिपोर्ट करें)',
    reportOutcomeHelp: 'सत्यापित निष्कर्षों को PREVENT में भेजकर निर्धारित जोखिम स्कोर को पुनः आकलित करें।',
    resetBtn: 'प्रोटोकॉल रीसेट करें',
    resetConfirm: 'क्या आप स्थानीय प्रगति रीसेट करना चाहते हैं? मौजूदा सुरक्षा रिकॉर्ड सुरक्षित रहेंगे।',
    disclaimer: 'PREVENT केवल निर्णयात्मक सहायता प्रदान करता है। अंतिम परिचालन सुरक्षा निर्णय जिम्मेदार मानव प्राधिकारी के पास है।',
    notesLabel: 'फील्ड टिप्पणियाँ और तकनीशियन टिप्पणी (वैकल्पिक)',
    notesPlaceholder: 'निष्कर्षों, घटक स्थिति या किए गए सुधारों पर संक्षिप्त टिप्पणी दर्ज करें...'
  }
};

const DEFAULT_CHECKLIST: FieldActionChecklist = {
  isolationInspection: false,
  toleranceVerification: false,
  functionalCheck: false
};

export const FieldActionModal: React.FC<FieldActionModalProps> = ({
  isOpen,
  onClose,
  assetId,
  riskLevel,
  riskScore,
  primarySubsystem,
  whyNowSummary,
  initialLanguage = 'en',
  initialRole = 'general',
  onReportOutcome
}) => {
  const [language, setLanguage] = useState<ActionLanguage>(initialLanguage);
  const [role, setRole] = useState<ActionRole>(initialRole);
  const [outcomeChoice, setOutcomeChoice] = useState<FieldActionOutcomeChoice>('corrective_action');

  const storageKey = `prevent_action_state_${assetId}`;

  // Local storage backed state
  const [actionState, setActionState] = useState<FieldActionState>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          assetId,
          status: parsed.status || 'NOT_STARTED',
          acknowledgedAt: parsed.acknowledgedAt || null,
          checklist: parsed.checklist || DEFAULT_CHECKLIST,
          notes: parsed.notes || ''
        };
      }
    } catch {
      // fallback
    }
    return {
      assetId,
      status: 'NOT_STARTED',
      acknowledgedAt: null,
      checklist: DEFAULT_CHECKLIST,
      notes: ''
    };
  });

  // Sync state if assetId changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`prevent_action_state_${assetId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setActionState({
          assetId,
          status: parsed.status || 'NOT_STARTED',
          acknowledgedAt: parsed.acknowledgedAt || null,
          checklist: parsed.checklist || DEFAULT_CHECKLIST,
          notes: parsed.notes || ''
        });
        return;
      }
    } catch {
      // ignore
    }
    setActionState({
      assetId,
      status: 'NOT_STARTED',
      acknowledgedAt: null,
      checklist: DEFAULT_CHECKLIST,
      notes: ''
    });
  }, [assetId]);

  // Persist state changes to localStorage
  const saveState = (newState: FieldActionState) => {
    setActionState(newState);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newState));
      window.dispatchEvent(new Event('prevent_action_state_changed'));
    } catch {
      // ignore
    }
  };

  const guidance = getRecommendedAction(riskLevel, language, role);
  const t = CHECKLIST_TRANSLATIONS[language] || CHECKLIST_TRANSLATIONS.en;

  const completedCount = Object.values(actionState.checklist).filter(Boolean).length;
  const totalCount = 3;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const handleAcknowledge = () => {
    const updated: FieldActionState = {
      ...actionState,
      status: 'IN_PROGRESS',
      acknowledgedAt: new Date().toISOString()
    };
    saveState(updated);
  };

  const handleToggleChecklist = (key: keyof FieldActionChecklist) => {
    const updatedChecklist = {
      ...actionState.checklist,
      [key]: !actionState.checklist[key]
    };
    const newCompletedCount = Object.values(updatedChecklist).filter(Boolean).length;
    const newStatus: FieldActionStatus =
      newCompletedCount === 3
        ? 'OUTCOME_PENDING'
        : actionState.status === 'NOT_STARTED'
        ? 'IN_PROGRESS'
        : actionState.status;

    const updated: FieldActionState = {
      ...actionState,
      status: newStatus,
      acknowledgedAt: actionState.acknowledgedAt || new Date().toISOString(),
      checklist: updatedChecklist
    };
    saveState(updated);
  };

  const handleNotesChange = (val: string) => {
    const updated: FieldActionState = {
      ...actionState,
      notes: val
    };
    saveState(updated);
  };

  const handleReset = () => {
    if (window.confirm(t.resetConfirm)) {
      try {
        localStorage.removeItem(storageKey);
        window.dispatchEvent(new Event('prevent_action_state_changed'));
      } catch {
        // ignore
      }
      setActionState({
        assetId,
        status: 'NOT_STARTED',
        acknowledgedAt: null,
        checklist: DEFAULT_CHECKLIST,
        notes: ''
      });
    }
  };

  const handleTriggerOutcome = () => {
    const startingReportText =
      outcomeChoice === 'corrective_action'
        ? `Field action protocol completed for ${primarySubsystem.replace('_', ' ')}. ${completedCount}/${totalCount} safety checks completed. Corrective action outcome: ${actionState.notes?.trim() ? actionState.notes.trim() : 'Subsystem inspection verified and physical adjustments completed.'}`
        : `Field action inspection confirmed operational anomaly on ${primarySubsystem.replace('_', ' ')} during ${completedCount}/${totalCount} safety checks: ${actionState.notes?.trim() ? actionState.notes.trim() : 'Abnormal condition observed during tolerance checks. Escalation required.'}`;

    const payload: FieldActionOutcomePayload = {
      assetId,
      primarySubsystem,
      actionStatus: actionState.status,
      checklistCompletedCount: completedCount,
      totalChecklistCount: totalCount,
      acknowledgedAt: actionState.acknowledgedAt,
      completedAt: new Date().toISOString(),
      notes: actionState.notes,
      outcomeChoice,
      suggestedEventType: outcomeChoice === 'corrective_action' ? 'corrective_action' : 'operational_report',
      suggestedReporterRole: role === 'safety_officer' ? 'safety_officer' : 'technician',
      initialReportText: startingReportText
    };
    onReportOutcome(payload);
    onClose();
  };

  if (!isOpen) return null;

  const isCritical = riskLevel === 'CRITICAL';
  const isHigh = riskLevel === 'HIGH';
  const isMedium = riskLevel === 'MEDIUM';

  const riskBadgeClass = isCritical
    ? 'bg-red-700 text-white border-red-800'
    : isHigh
    ? 'bg-rose-700 text-white border-rose-800'
    : isMedium
    ? 'bg-amber-600 text-white border-amber-700'
    : 'bg-slate-700 text-white border-slate-800';

  const statusBadgeColor =
    actionState.status === 'OUTCOME_PENDING'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : actionState.status === 'IN_PROGRESS'
      ? 'bg-blue-100 text-blue-800 border-blue-300'
      : actionState.status === 'ACKNOWLEDGED'
      ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
      : 'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="field-action-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="field-action-title" className="text-sm font-bold tracking-tight uppercase font-mono">
                  {t.modalTitle}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/20 text-white font-bold">
                  {assetId}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${riskBadgeClass}`}>
                  {riskLevel} ({Math.round(riskScore)})
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans mt-0.5">{t.subheading}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls Bar: Language + Perspective + Status */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${statusBadgeColor}`}>
              {t.statusLabels[actionState.status]}
            </span>
            {actionState.acknowledgedAt && (
              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {new Date(actionState.acknowledgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Action Language Dropdown */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs">
              <Globe className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <label htmlFor="field-action-lang" className="sr-only">
                Language
              </label>
              <select
                id="field-action-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value as ActionLanguage)}
                className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="en">English</option>
                <option value="ta">தமிழ்</option>
                <option value="hi">हिन्दी</option>
              </select>
            </div>

            {/* Role Perspective Dropdown */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <label htmlFor="field-action-role" className="sr-only">
                Role
              </label>
              <select
                id="field-action-role"
                value={role}
                onChange={(e) => setRole(e.target.value as ActionRole)}
                className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="general">Standard</option>
                <option value="field_worker">Field Worker</option>
                <option value="supervisor">Supervisor</option>
                <option value="safety_officer">Safety Officer</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[calc(85vh-160px)] overflow-y-auto">
          {/* Directive Guidance Card */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                {guidance.headerTag}
              </span>
              <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                {guidance.title}
              </span>
            </div>

            <p className="text-sm font-bold text-slate-900 leading-snug">
              {role === 'general' ? guidance.instruction : guidance.roleInstruction}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">{guidance.detail}</p>

            {whyNowSummary && (
              <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-200/80 font-sans mt-2">
                <span className="font-semibold text-slate-900 font-mono text-[10px] uppercase mr-1">
                  Context:
                </span>
                {whyNowSummary}
              </div>
            )}
          </div>

          {/* Step 1: Acknowledge & Activate */}
          {actionState.status === 'NOT_STARTED' ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-950 uppercase font-mono tracking-wide">
                    Protocol Acknowledgment Required
                  </h3>
                  <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">{t.acknowledgeDetail}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAcknowledge}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-amber-400" />
                {t.acknowledgeBtn}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Step 2: Generic Safety Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div>
                    <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-900">
                      {t.checklistTitle}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-sans">{t.checklistSubtitle}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">
                    {completedCount} / {totalCount}
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full bg-slate-900 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Checklist Items */}
                <div className="space-y-2.5 pt-1">
                  {/* Item 1 */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50/80 transition-colors cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={actionState.checklist.isolationInspection}
                      onChange={() => handleToggleChecklist('isolationInspection')}
                      className="sr-only"
                    />
                    <div className="mt-0.5 shrink-0 text-slate-900">
                      {actionState.checklist.isolationInspection ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-900 block leading-snug">
                        {t.items.isolationInspection.title}
                      </span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {t.items.isolationInspection.desc}
                      </p>
                    </div>
                  </label>

                  {/* Item 2 */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50/80 transition-colors cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={actionState.checklist.toleranceVerification}
                      onChange={() => handleToggleChecklist('toleranceVerification')}
                      className="sr-only"
                    />
                    <div className="mt-0.5 shrink-0 text-slate-900">
                      {actionState.checklist.toleranceVerification ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-900 block leading-snug">
                        {t.items.toleranceVerification.title}
                      </span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {t.items.toleranceVerification.desc}
                      </p>
                    </div>
                  </label>

                  {/* Item 3 */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50/80 transition-colors cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={actionState.checklist.functionalCheck}
                      onChange={() => handleToggleChecklist('functionalCheck')}
                      className="sr-only"
                    />
                    <div className="mt-0.5 shrink-0 text-slate-900">
                      {actionState.checklist.functionalCheck ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-900 block leading-snug">
                        {t.items.functionalCheck.title}
                      </span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {t.items.functionalCheck.desc}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Optional Field Notes */}
              <div>
                <label
                  htmlFor="field-action-notes"
                  className="block text-[11px] font-mono font-semibold uppercase text-slate-600 mb-1"
                >
                  {t.notesLabel}
                </label>
                <textarea
                  id="field-action-notes"
                  value={actionState.notes || ''}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 font-sans leading-relaxed"
                />
              </div>

              {/* Step 3: Generic Field Action Outcome Options */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-900">
                    {t.outcomeOptions.sectionTitle}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-sans">
                    {t.outcomeOptions.sectionSubtitle}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {/* Option A: Corrective Action Completed */}
                  <button
                    type="button"
                    onClick={() => setOutcomeChoice('corrective_action')}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      outcomeChoice === 'corrective_action'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            outcomeChoice === 'corrective_action' ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        />
                        {t.outcomeOptions.correctiveAction.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                      {t.outcomeOptions.correctiveAction.desc}
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold uppercase">
                      {t.outcomeOptions.correctiveAction.badge}
                    </span>
                  </button>

                  {/* Option B: Anomaly Confirmed / Escalation Required */}
                  <button
                    type="button"
                    onClick={() => setOutcomeChoice('anomaly_confirmed')}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      outcomeChoice === 'anomaly_confirmed'
                        ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <AlertTriangle
                          className={`w-3.5 h-3.5 shrink-0 ${
                            outcomeChoice === 'anomaly_confirmed' ? 'text-amber-600' : 'text-slate-400'
                          }`}
                        />
                        {t.outcomeOptions.anomalyConfirmed.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                      {t.outcomeOptions.anomalyConfirmed.desc}
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-semibold uppercase">
                      {t.outcomeOptions.anomalyConfirmed.badge}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              {t.resetBtn}
            </button>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={actionState.status === 'NOT_STARTED'}
              onClick={handleTriggerOutcome}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-sm cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {t.reportOutcomeBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
