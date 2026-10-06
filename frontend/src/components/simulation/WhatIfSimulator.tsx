import React, { useState } from 'react';
import { Play, RotateCcw, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import type { SimulateSignalResponse } from '../../types/api';
import { RiskBadge } from '../risk/RiskBadge';

interface WhatIfSimulatorProps {
  assetId: string;
  currentRiskScore?: number;
  currentSubsystem: string;
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({
  assetId,
  currentSubsystem,
}) => {
  const [eventType, setEventType] = useState('operational_report');
  const [subsystem, setSubsystem] = useState(currentSubsystem || 'braking');
  const [severity, setSeverity] = useState(4);
  const [source, setSource] = useState('Driver Shift Incident Pad');
  const [reporterRole, setReporterRole] = useState('driver');
  const [description, setDescription] = useState(
    'Driver reported noticeable brake pedal shudder and delayed stopping at 35 mph in damp conditions.'
  );

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SimulateSignalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.simulateSignal({
        asset_id: assetId,
        event_type: eventType,
        subsystem: subsystem,
        severity: Number(severity),
        source: source,
        reporter_role: reporterRole,
        description: description,
      });
      setResult(response);
    } catch (err: any) {
      setError(err?.message || 'Simulation request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              WHAT-IF SIGNAL SIMULATOR
            </h3>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-950/70 border border-blue-800 text-blue-400">
              Interactive Decision Sandbox
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            What happens to fleet risk if another independent warning signal occurs?
          </p>
        </div>

        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
          SIMULATED — NOT PERSISTED
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Simulation Form (7 Cols) */}
        <form onSubmit={handleRunSimulation} className="lg:col-span-7 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Event Type */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Event Type
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 focus:outline-none focus:border-orange-500"
              >
                <option value="operational_report">Driver / Operational Report</option>
                <option value="complaint">Passenger Complaint</option>
                <option value="inspection">Regulatory Inspection</option>
                <option value="maintenance">Maintenance Finding</option>
                <option value="near_miss">Near-Miss Event</option>
                <option value="incident">Safety Incident</option>
              </select>
            </div>

            {/* Subsystem */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Subsystem
              </label>
              <select
                value={subsystem}
                onChange={(e) => setSubsystem(e.target.value)}
                className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 focus:outline-none focus:border-orange-500"
              >
                <option value="braking">Braking System</option>
                <option value="doors_body">Doors & Body</option>
                <option value="electrical">Electrical System</option>
                <option value="powertrain">Powertrain</option>
                <option value="suspension">Suspension & Steering</option>
                <option value="hvac">HVAC / Climate</option>
                <option value="general">General Vehicle</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Severity */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Severity (1 - 5)
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 focus:outline-none focus:border-orange-500 font-mono"
              >
                <option value={1}>1 - Negligible</option>
                <option value={2}>2 - Minor</option>
                <option value={3}>3 - Moderate</option>
                <option value={4}>4 - Serious</option>
                <option value={5}>5 - Critical / Near-Miss</option>
              </select>
            </div>

            {/* Reporter Role */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Reporter Role
              </label>
              <select
                value={reporterRole}
                onChange={(e) => setReporterRole(e.target.value)}
                className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 focus:outline-none focus:border-orange-500"
              >
                <option value="driver">Driver</option>
                <option value="passenger">Passenger</option>
                <option value="inspector">Safety Inspector</option>
                <option value="technician">Depot Technician</option>
                <option value="safety_officer">Safety Dispatch / Telematics</option>
              </select>
            </div>

            {/* Source */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Source System
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Factual Event Narrative
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 p-2.5 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-colors disabled:opacity-50 shadow-md shadow-orange-950/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isLoading ? 'Calculating Shift...' : 'Run What-If Simulation'}
            </button>

            {result && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-400 text-xs">
              {error}
            </div>
          )}
        </form>

        {/* Live Simulation Output Panel (5 Cols) */}
        <div className="lg:col-span-5 rounded-lg border border-slate-800 bg-slate-950/80 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-850 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                PROJECTION SUMMARY
              </span>
              <span className="text-[10px] text-orange-400 font-mono font-bold bg-orange-950/50 px-2 py-0.5 rounded border border-orange-900/60">
                LIVE DELTA
              </span>
            </div>

            {result ? (
              <div className="space-y-4">
                {/* Before / After Scores */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-mono">
                      Current Baseline
                    </div>
                    <div className="text-2xl font-black font-mono text-slate-300">
                      {Math.round(result.before_risk_score)}
                      <span className="text-xs text-slate-500 font-normal"> / 100</span>
                    </div>
                    <div className="mt-1">
                      <RiskBadge level={result.before_risk_level} size="sm" />
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-orange-400 uppercase font-mono font-bold">
                      Simulated Projection
                    </div>
                    <div className="text-2xl font-black font-mono text-orange-400">
                      {Math.round(result.after_risk_score)}
                      <span className="text-xs text-slate-500 font-normal"> / 100</span>
                    </div>
                    <div className="mt-1">
                      <RiskBadge level={result.after_risk_level} size="sm" />
                    </div>
                  </div>
                </div>

                {/* Score Delta Pill */}
                <div className="p-2.5 rounded-lg bg-orange-950/40 border border-orange-700/60 flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Risk Score Delta:</span>
                  <span className="text-orange-400 font-mono font-black text-sm">
                    +{result.risk_score_delta.toFixed(1)} points
                  </span>
                </div>

                {/* Algorithmic Reason for Shift */}
                <div className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/40 p-2.5 rounded border border-slate-850">
                  <span className="font-semibold text-white block mb-1">Why Risk Shifted:</span>
                  {result.explanation_of_change}
                </div>

                {/* Specific Factor Deltas */}
                <div className="space-y-1 text-xs">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold">
                    Factor Contributions:
                  </span>
                  {Object.entries(result.factor_breakdown_delta).map(([k, delta]) => {
                    if (delta === 0) return null;
                    return (
                      <div key={k} className="flex justify-between font-mono text-[11px] py-0.5">
                        <span className="text-slate-400">
                          {k.replace('_points', '').replace(/_/g, ' ')}:
                        </span>
                        <span className="text-orange-400 font-bold">+{delta.toFixed(1)} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                Fill in hypothetical signal parameters and click <strong>Run What-If</strong> to
                observe real-time risk escalation.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 text-[10px] text-slate-500 font-mono text-center">
            Zero mutation guarantee: Simulation runs in memory only.
          </div>
        </div>
      </div>
    </div>
  );
};
