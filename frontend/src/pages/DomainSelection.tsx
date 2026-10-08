import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bus,
  Factory,
  HardHat,
  Zap,
  Truck,
  ArrowRight,
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
  badge: 'Live Demo' | 'Example Scenario';
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
    name: 'Transportation & Transit',
    badge: 'Live Demo',
    isLive: true,
    route: '/app/transportation',
    icon: <Bus className="w-6 h-6 text-indigo-600" />,
    tagline: 'Active Production Demonstration',
    description:
      'Monitor safety signals across vehicles, assets, inspections, driver logs, passenger reports, and near-misses.',
    subsystems: ['Braking', 'Steering', 'Powertrain', 'Electrical', 'Doors & Body'],
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing & Heavy Industry',
    badge: 'Example Scenario',
    isLive: false,
    icon: <Factory className="w-6 h-6 text-slate-700" />,
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
    name: 'Construction & Job Sites',
    badge: 'Example Scenario',
    isLive: false,
    icon: <HardHat className="w-6 h-6 text-slate-700" />,
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
    name: 'Utilities & Grid Infrastructure',
    badge: 'Example Scenario',
    isLive: false,
    icon: <Zap className="w-6 h-6 text-slate-700" />,
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
    name: 'Logistics & Warehousing',
    badge: 'Example Scenario',
    isLive: false,
    icon: <Truck className="w-6 h-6 text-slate-700" />,
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Header / Branding */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-baseline gap-2.5 group">
              <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                PREVENT
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                Safety Intelligence Platform
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/evidence"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-md hover:bg-slate-100"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Real-World Evidence (NHTSA)</span>
            </Link>

            <Link
              to="/app/transportation"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs shadow-indigo-600/20"
            >
              <span>Launch Live Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>DOMAIN-AGNOSTIC SAFETY INTELLIGENCE LAYER</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
            Connecting the warnings <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">
              before they become incidents.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Connect scattered safety signals, identify escalating risk, understand why it matters now, and turn intelligence into actionable human intervention.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-slate-500">
            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-2xs">
              Deterministic Math
            </span>
            <span className="text-slate-300">•</span>
            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-2xs">
              Multi-Source Corroboration
            </span>
            <span className="text-slate-300">•</span>
            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-2xs">
              Multilingual Voice Intake
            </span>
            <span className="text-slate-300">•</span>
            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-2xs">
              Closed-Loop Protocols
            </span>
          </div>
        </div>

        {/* Domain Selection Grid Section */}
        <section aria-labelledby="domains-heading" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h2 id="domains-heading" className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                Select Your Safety Domain
              </h2>
              <p className="text-xl font-bold tracking-tight text-slate-900 mt-1">
                Operational Environments
              </p>
            </div>
            <p className="text-xs text-slate-500 max-w-md">
              Choose an environment below. Transportation hosts the fully interactive live system; additional domains provide architectural specifications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                  className={`group relative rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    isPrimary
                      ? 'bg-gradient-to-b from-white to-indigo-50/30 border-indigo-300 shadow-md hover:shadow-lg hover:border-indigo-400 ring-1 ring-indigo-500/20'
                      : 'bg-white border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Top Row: Icon + Badge */}
                    <div className="flex items-center justify-between">
                      <div
                        className={`p-3 rounded-xl ${
                          isPrimary
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                        } transition-colors`}
                      >
                        {domain.icon}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide ${
                          isPrimary
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {isPrimary && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                        {domain.badge}
                      </span>
                    </div>

                    {/* Domain Title & Tagline */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                        <span>{domain.name}</span>
                        {isPrimary && (
                          <ChevronRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
                        )}
                      </h3>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{domain.tagline}</p>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 leading-relaxed">{domain.description}</p>

                    {/* Subsystem tags */}
                    <div className="pt-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
                        Key Subsystems
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {domain.subsystems.map((sub) => (
                          <span
                            key={sub}
                            className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium font-mono"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="pt-6 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    {isPrimary ? (
                      <>
                        <span className="font-semibold text-indigo-600 group-hover:text-indigo-700 flex items-center gap-1">
                          Enter Operational Dashboard
                        </span>
                        <span className="p-1 rounded-full bg-indigo-600 text-white group-hover:translate-x-1 transition-transform">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-slate-500 group-hover:text-slate-800">
                          View Scenario Specification
                        </span>
                        <span className="text-slate-400 group-hover:text-slate-600 font-mono text-[11px]">
                          Specification →
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
          className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 shadow-xs space-y-8"
        >
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 id="architecture-heading" className="text-2xl font-bold tracking-tight text-slate-900">
              One intelligence layer. Multiple safety domains.
            </h2>
            <p className="text-xs font-mono uppercase tracking-wider text-indigo-600 font-semibold">
              The domain changes. The safety intelligence doesn't.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              PREVENT separates domain entities from the invariant physics of failure escalation. Regardless of whether the asset is a transit vehicle, wind turbine, or hospital system, the safety workflow remains strictly uniform:
            </p>
          </div>

          {/* 5-Stage Pipeline Visualizer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  Step 01
                </span>
                <Radio className="w-4 h-4 text-indigo-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">DETECT</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ingest multilingual voice logs, shift notes, inspections, and work orders with zero form friction.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                  Step 02
                </span>
                <Layers className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">CORRELATE</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Compound risk across independent reporting roles and calculate dynamic temporal interval acceleration.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                  Step 03
                </span>
                <Activity className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">EXPLAIN</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Audit every point in the 0–100 score with the Factor Waterfall and deterministic "Why Now?" attribution.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                  Step 04
                </span>
                <Shield className="w-4 h-4 text-rose-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">ACT</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Provide role-tailored prescriptive protocols translated deterministically for frontline execution.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  Step 05
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">VERIFY</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Confirm mitigation outcomes through closed-loop reporting and apply mathematical recency risk decay.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">PREVENT</span>
            <span>· Decision-Support Safety Intelligence</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/app/transportation" className="hover:text-slate-900 transition-colors">
              Launch Live Demo
            </Link>
            <Link to="/evidence" className="hover:text-slate-900 transition-colors">
              NHTSA Evidence Track
            </Link>
          </div>
        </div>
      </footer>

      {/* Example Scenario Modal */}
      {selectedSpec && selectedSpec.spec && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800">
                  {selectedSpec.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      EXAMPLE SCENARIO SPECIFICATION
                    </span>
                  </div>
                  <h3 id="modal-title" className="text-xl font-bold text-slate-900 mt-1">
                    {selectedSpec.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedSpec.tagline}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSpec(null)}
                aria-label="Close specification dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invariance Framing Banner */}
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Architectural Invariance:</strong> This specification demonstrates how PREVENT's schema and 6-factor deterministic engine generalize to {selectedSpec.name.toLowerCase()} without altering risk scoring algorithms.
              </p>
            </div>

            {/* Scenario Breakdown */}
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-mono uppercase font-bold text-[10px] text-slate-500">
                  Sample Asset Entity
                </span>
                <p className="font-semibold text-slate-900 text-sm">
                  {selectedSpec.spec.sampleAsset}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-mono uppercase font-bold text-[10px] text-slate-500 block">
                  Dispersed Observational Signals (Fragmented Sources)
                </span>
                <ul className="space-y-1.5 text-slate-700">
                  {selectedSpec.spec.signalSources.map((source, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                      <span>{source}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1 text-amber-950">
                <span className="font-mono uppercase font-bold text-[10px] text-amber-800">
                  Signal Convergence Anomaly
                </span>
                <p className="leading-relaxed">{selectedSpec.spec.convergenceStory}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-1 text-indigo-950">
                <span className="font-mono uppercase font-bold text-[10px] text-indigo-800">
                  Prescriptive Recommended Action
                </span>
                <p className="leading-relaxed font-medium">
                  {selectedSpec.spec.recommendedAction}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-mono text-[11px]">
                To explore live interactive scoring, launch the Transportation demo.
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedSpec(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors font-medium w-full sm:w-auto cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSpec(null);
                    navigate('/app/transportation');
                  }}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-1.5 w-full sm:w-auto transition-colors shadow-xs cursor-pointer"
                >
                  <span>Launch Live Demo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
