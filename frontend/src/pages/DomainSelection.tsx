import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bus,
  Factory,
  HardHat,
  Zap,
  Truck,
  Shield,
  Layers,
  Activity,
  CheckCircle2,
  X,
  ChevronRight,
  Info,
  Radio,
  FileCheck2,
} from 'lucide-react';

interface DomainSpec {
  id: string;
  name: string;
  badge: 'LIVE DEMO' | 'ILLUSTRATIVE SCENARIO';
  isLive: boolean;
  icon: React.ReactNode;
  tagline: string;
  description: string;
  subsystems: string[];
  route?: string;
  spec?: {
    sampleAsset: string;
    subsystemsList: string[];
    signalSources: string[];
    convergenceStory: string;
    recommendedAction: string;
    mathInvarianceNote: string;
  };
}

const DOMAINS: DomainSpec[] = [
  {
    id: 'transportation',
    name: 'Transportation',
    badge: 'LIVE DEMO',
    isLive: true,
    route: '/app/transportation',
    icon: <Bus className="w-5 h-5 text-slate-800" />,
    tagline: 'Active Production Demonstration',
    description:
      'Monitor safety signals across vehicles, assets, inspections, driver logs, passenger reports, and near-misses.',
    subsystems: ['Braking', 'Steering', 'Powertrain', 'Electrical', 'Doors & Body'],
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    badge: 'ILLUSTRATIVE SCENARIO',
    isLive: false,
    icon: <Factory className="w-5 h-5 text-slate-700" />,
    tagline: 'Industrial Machinery & Production Lines',
    description:
      'Detect converging warning signals across industrial assets, automated stamping presses, and production cells.',
    subsystems: ['Hydraulic Drive', 'Spindle Bearings', 'Safety Interlocks', 'Coolant Delivery'],
    spec: {
      sampleAsset: 'CNC-MILL-08 (High-Tolerance Milling Cell)',
      subsystemsList: ['Spindle Drive', 'Hydraulic Clamping', 'Coolant Loop', 'Toolhead Feed'],
      signalSources: [
        'Machine Operator shift remark (slight vibration at 4,000 RPM)',
        'Vibrational acoustic audit by maintenance specialist',
        'Coolant low-pressure intermittent warning light',
        'Near-miss emergency stop actuation during rapid traverse',
      ],
      convergenceStory:
        'Three separate operator notes about thermal rise + one acoustic vibration flag + one coolant pressure drop compound into HIGH RISK (78/100) before mechanical toolhead seizure.',
      recommendedAction:
        'Focused hydraulic pressure test and spindle bearing recertification before the next operational shift.',
      mathInvarianceNote:
        'Operates on the identical 6-factor deterministic risk engine and interval-contraction mathematics. Zero custom code required.',
    },
  },
  {
    id: 'construction',
    name: 'Construction',
    badge: 'ILLUSTRATIVE SCENARIO',
    isLive: false,
    icon: <HardHat className="w-5 h-5 text-slate-700" />,
    tagline: 'Heavy Equipment & Site Safety',
    description:
      'Connect site observations, heavy equipment warnings, subcontractor inspections, and near-misses.',
    subsystems: ['Cable Rigging', 'Hydraulic Hoists', 'Slew Rings', 'Load Limiters'],
    spec: {
      sampleAsset: 'TOWER-CRANE-03 (50-Ton Luffing Jib Crane)',
      subsystemsList: ['Hoist Winch', 'Slew Ring Bearing', 'Tension Cables', 'Load Moment Limiter'],
      signalSources: [
        'Subcontractor rigger remark (cable chatter during morning lift)',
        'Crane operator daily pre-shift inspection log (hydraulic lag)',
        'Site safety officer walkaround audit (minor fluid weeping near slew ring)',
        'Near-miss report (load swing overshoot in gusty conditions)',
      ],
      convergenceStory:
        'Dispersed observations across four independent site roles converge on the hoist/slew subsystem over 6 days, escalating from baseline to HIGH prior to catastrophic hoist line failure.',
      recommendedAction:
        'Immediate non-destructive cable inspection and winch hydraulic pressure certification before lifting resumes.',
      mathInvarianceNote:
        'Cross-source role corroboration bonus rewards the convergence of rigger + operator + safety officer reports.',
    },
  },
  {
    id: 'utilities',
    name: 'Utilities',
    badge: 'ILLUSTRATIVE SCENARIO',
    isLive: false,
    icon: <Zap className="w-5 h-5 text-slate-700" />,
    tagline: 'High-Voltage & Distribution Assets',
    description:
      'Correlate infrastructure warnings, thermal inspections, lineman logs, and operational telemetry events.',
    subsystems: ['Dielectric Oil', 'Bushing Insulators', 'Tap Changers', 'Protective Relays'],
    spec: {
      sampleAsset: 'SUBSTATION-TX-04 (138kV Step-Down Transformer)',
      subsystemsList: ['Main Tank Insulation', 'Cooling Radiators', 'High-Side Bushings', 'Tap Changer'],
      signalSources: [
        'Routine Dissolved Gas Analysis (DGA) showing trace combustible gas',
        'Drone infrared thermal scan indicating 12°C localized hotspot on Bushing 2',
        'Lineman visual observation of weeping gasket seal during rainstorm',
        'SCADA momentary ground fault trip that cleared automatically',
      ],
      convergenceStory:
        'A laboratory gas test, a drone thermal anomaly, and a lineman visual check connect over 3 weeks, preventing a catastrophic dielectric flashover and multi-million dollar blackout.',
      recommendedAction:
        'Emergency oil degassing and thermal bushing replacement under scheduled isolation window.',
      mathInvarianceNote:
        'Temporal velocity calculations automatically detect contracting event intervals between routine seasonal inspections.',
    },
  },
  {
    id: 'logistics',
    name: 'Logistics',
    badge: 'ILLUSTRATIVE SCENARIO',
    isLive: false,
    icon: <Truck className="w-5 h-5 text-slate-700" />,
    tagline: 'Material Handling & Automated Fulfillment',
    description:
      'Identify emerging safety risks across sortation equipment, material handling fleets, and high-velocity operations.',
    subsystems: ['Mast Hydraulics', 'Braking System', 'Steering Axle', 'Battery Management'],
    spec: {
      sampleAsset: 'FORKLIFT-FL-07 (High-Reach Narrow Aisle Truck)',
      subsystemsList: ['Lift Mast', 'Regenerative Braking', 'Steering Control', 'Lithium Battery Pack'],
      signalSources: [
        'Warehouse order picker note (soft brake pedal feel in cold storage aisle)',
        'Battery management telemetry flagging cell temperature anomaly',
        'Shift supervisor walkaround noting hydraulic line scuffing',
        'Floor near-miss report (cross-aisle stop line overshoot near pedestrian crossing)',
      ],
      convergenceStory:
        'A soft brake pedal note + battery thermal flag + near-miss stopping overshoot compound into an urgent supervisory quarantine, preventing a fatal pedestrian collision.',
      recommendedAction:
        'Quarantine asset from service; test brake master cylinder and battery thermal isolation circuit.',
      mathInvarianceNote:
        'Prescriptive 4-tier guidance maps automatically to warehouse supervisor and maintenance roles.',
    },
  },
];

export const DomainSelection: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSpec, setSelectedSpec] = useState<DomainSpec | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSpec(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDomainClick = (domain: DomainSpec) => {
    if (domain.isLive && domain.route) {
      navigate(domain.route);
    } else {
      setSelectedSpec(domain);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* Top Header / Branding */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-baseline gap-2 group">
              <span className="text-base font-bold tracking-tight text-slate-900">
                PREVENT
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Safety Intelligence Platform
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/evidence"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors px-2.5 py-1.5 rounded-md hover:bg-slate-100"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Real-World Evidence (NHTSA)</span>
            </Link>

            <Link
              to="/app/transportation"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-xs"
            >
              <span>Enter Dashboard →</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono uppercase tracking-wider font-semibold">
            <span>Safety Intelligence Platform</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Connecting the warnings <br className="hidden sm:inline" />
            before they become incidents.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Connect scattered safety signals, identify escalating risk, understand why it matters now, and turn intelligence into actionable human intervention.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-slate-500">
            <span className="px-2.5 py-1 rounded bg-white border border-slate-200 shadow-2xs">
              Deterministic Scoring
            </span>
            <span className="text-slate-300">•</span>
            <span className="px-2.5 py-1 rounded bg-white border border-slate-200 shadow-2xs">
              Cross-Role Corroboration
            </span>
            <span className="text-slate-300">•</span>
            <span className="px-2.5 py-1 rounded bg-white border border-slate-200 shadow-2xs">
              Temporal Velocity
            </span>
            <span className="text-slate-300">•</span>
            <span className="px-2.5 py-1 rounded bg-white border border-slate-200 shadow-2xs">
              Closed-Loop Protocols
            </span>
          </div>
        </div>

        {/* Domain Selection Grid Section */}
        <section aria-labelledby="domains-heading" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-3 border-b border-slate-200">
            <div>
              <h2 id="domains-heading" className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                SELECT YOUR SAFETY DOMAIN
              </h2>
              <p className="text-lg font-bold tracking-tight text-slate-900 mt-0.5">
                Operational Environments
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Transportation hosts the live demo; other domains provide illustrative architectural scenarios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DOMAINS.map((domain) => {
              const isPrimary = domain.isLive;

              return (
                <div
                  key={domain.id}
                  onClick={() => handleDomainClick(domain)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleDomainClick(domain);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${domain.name}: ${domain.badge}. ${domain.description}`}
                  className={`group relative rounded-lg border p-5 flex flex-col justify-between transition-colors duration-150 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                    isPrimary
                      ? 'bg-white border-slate-300 border-l-4 border-l-slate-900 shadow-xs hover:border-slate-400'
                      : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Top Row: Icon + Badge */}
                    <div className="flex items-center justify-between">
                      <div
                        className={`p-2 rounded ${
                          isPrimary
                            ? 'bg-slate-100 text-slate-900'
                            : 'bg-slate-50 text-slate-600 border border-slate-100'
                        }`}
                      >
                        {domain.icon}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          isPrimary
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {isPrimary && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                        {domain.badge}
                      </span>
                    </div>

                    {/* Domain Title & Tagline */}
                    <div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-slate-800 transition-colors flex items-center justify-between">
                        <span>{domain.name}</span>
                        {isPrimary && (
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
                        )}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">{domain.tagline}</p>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 leading-relaxed">{domain.description}</p>

                    {/* Subsystem tags */}
                    <div className="pt-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                        Key Subsystems
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {domain.subsystems.map((sub) => (
                          <span
                            key={sub}
                            className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium font-mono border border-slate-200/60"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    {isPrimary ? (
                      <>
                        <span className="font-medium text-slate-600">
                          Active Fleet Surveillance
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors">
                          <span>Enter Dashboard →</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-slate-500">
                          Illustrative Scenario
                        </span>
                        <span className="text-slate-700 group-hover:text-slate-900 font-medium text-xs transition-colors flex items-center gap-0.5">
                          <span>View Example →</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom Section: Pipeline Architecture & Core Thesis */}
        <section
          aria-labelledby="architecture-heading"
          className="rounded-lg border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-3 border-b border-slate-200">
            <div>
              <h2 id="architecture-heading" className="text-base font-bold tracking-tight text-slate-900">
                One intelligence layer. Multiple safety domains.
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                PREVENT adapts to the domain without changing the underlying safety intelligence.
              </p>
            </div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              INVARIANT PIPELINE ARCHITECTURE
            </div>
          </div>

          {/* 5-Stage Pipeline Visualizer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                  01 · DETECT
                </span>
                <Radio className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Signal Ingestion</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Ingest multilingual voice logs, shift notes, inspections, and sensor telemetry with zero friction.
              </p>
            </div>

            <div className="p-3.5 rounded border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                  02 · CORRELATE
                </span>
                <Layers className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Multi-Source Fusion</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Compound risk across independent reporting roles and calculate dynamic temporal interval acceleration.
              </p>
            </div>

            <div className="p-3.5 rounded border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                  03 · EXPLAIN
                </span>
                <Activity className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Why Now? Audit</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Audit every point in the 0–100 score with the Factor Waterfall and deterministic attribution.
              </p>
            </div>

            <div className="p-3.5 rounded border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                  04 · ACT
                </span>
                <Shield className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Prescriptive Protocols</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Provide role-tailored prescriptive protocols translated deterministically for frontline execution.
              </p>
            </div>

            <div className="p-3.5 rounded border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                  05 · VERIFY
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Closed-Loop Recovery</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Confirm mitigation outcomes through closed-loop reporting and apply mathematical recency risk decay.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">PREVENT</span>
            <span>· Decision-Support Safety Intelligence</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/app/transportation" className="hover:text-slate-900 transition-colors">
              Transportation Dashboard
            </Link>
            <Link to="/evidence" className="hover:text-slate-900 transition-colors">
              NHTSA Evidence Track
            </Link>
          </div>
        </div>
      </footer>

      {/* Illustrative Scenario Modal */}
      {selectedSpec && selectedSpec.spec && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white rounded-lg max-w-2xl w-full border border-slate-200 shadow-xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-slate-100 text-slate-700">
                  {selectedSpec.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      ILLUSTRATIVE SCENARIO
                    </span>
                  </div>
                  <h3 id="modal-title" className="text-lg font-bold text-slate-900 mt-0.5">
                    {selectedSpec.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedSpec.tagline}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSpec(null)}
                aria-label="Close specification dialog"
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invariance Framing Banner */}
            <div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Illustrative scenario:</strong> Demonstrating how PREVENT's intelligence layer can apply to {selectedSpec.name.toLowerCase()} without changing the underlying safety intelligence engine.
              </p>
            </div>

            {/* Scenario Breakdown */}
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-white border border-slate-200 space-y-1">
                <span className="font-mono uppercase font-semibold text-[10px] text-slate-500">
                  Sample Asset Entity
                </span>
                <p className="font-semibold text-slate-900 font-mono text-sm">
                  {selectedSpec.spec.sampleAsset}
                </p>
              </div>

              <div className="p-3 rounded bg-white border border-slate-200 space-y-2">
                <span className="font-mono uppercase font-semibold text-[10px] text-slate-500 block">
                  Dispersed Observational Signals (Fragmented Sources)
                </span>
                <ul className="space-y-1.5 text-slate-700">
                  {selectedSpec.spec.signalSources.map((source, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-1.5" />
                      <span>{source}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded bg-amber-50/70 border border-amber-200 space-y-1 text-amber-950">
                <span className="font-mono uppercase font-semibold text-[10px] text-amber-800">
                  Signal Convergence Anomaly
                </span>
                <p className="leading-relaxed">{selectedSpec.spec.convergenceStory}</p>
              </div>

              <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1 text-slate-900">
                <span className="font-mono uppercase font-semibold text-[10px] text-slate-500">
                  Prescriptive Recommended Action
                </span>
                <p className="leading-relaxed font-medium">
                  {selectedSpec.spec.recommendedAction}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 text-xs">
                Transportation is PREVENT's active live demo domain.
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedSpec(null)}
                  className="px-3 py-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors font-medium w-full sm:w-auto cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSpec(null);
                    navigate('/app/transportation');
                  }}
                  className="px-3.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white font-medium flex items-center justify-center gap-1.5 w-full sm:w-auto transition-colors shadow-xs cursor-pointer"
                >
                  <span>Enter Dashboard →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
