import React, { useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
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
    <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
            WHAT-IF
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-sans">
            How would a new signal change the current risk?
          </p>
        </div>

        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          In-Memory Simulation · Zero Mutation
        </span>
      </div>

      {/* Simulation Form */}
      <form onSubmit={handleRunSimulation} className="space-y-4">
        {/* Horizontal Control Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Signal Type */}
          <div>
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Signal Type
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white text-slate-900 px-2.5 py-1.5 focus:outline-none focus:border-slate-900 text-xs"
            >
              <option value="operational_report">Driver Report</option>
              <option value="complaint">Passenger Complaint</option>
              <option value="inspection">Regulatory Inspection</option>
              <option value="maintenance">Maintenance Finding</option>
              <option value="near_miss">Near-Miss Event</option>
              <option value="incident">Safety Incident</option>
            </select>
          </div>

          {/* Subsystem */}
          <div>
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Subsystem
            </label>
            <select
              value={subsystem}
              onChange={(e) => setSubsystem(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white text-slate-900 px-2.5 py-1.5 focus:outline-none focus:border-slate-900 text-xs"
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

          {/* Severity */}
          <div>
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Severity (1 - 5)
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full rounded border border-slate-200 bg-white text-slate-900 px-2.5 py-1.5 focus:outline-none focus:border-slate-900 font-mono text-xs"
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
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Reporter Role
            </label>
            <select
              value={reporterRole}
              onChange={(e) => setReporterRole(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white text-slate-900 px-2.5 py-1.5 focus:outline-none focus:border-slate-900 text-xs"
            >
              <option value="driver">Driver</option>
              <option value="passenger">Passenger</option>
              <option value="inspector">Safety Inspector</option>
              <option value="technician">Depot Technician</option>
              <option value="safety_officer">Safety Dispatch</option>
            </select>
          </div>
        </div>

        {/* Narrative & Source input */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs">
          <div className="lg:col-span-8">
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Signal Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white text-slate-900 px-3 py-1.5 focus:outline-none focus:border-slate-900 text-xs"
            />
          </div>

          <div className="lg:col-span-4">
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Source System
            </label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white text-slate-900 px-3 py-1.5 focus:outline-none focus:border-slate-900 text-xs"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isLoading ? 'Calculating Shift...' : 'Run What-If Simulation'}
          </button>

          {result && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-2 rounded border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-xs">
            {error}
          </div>
        )}
      </form>

      {/* Live Simulation Output */}
      {result && (
        <div className="border-t border-slate-200 pt-5 space-y-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Simulation Result
          </div>

          {/* Current vs Simulated Risk Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-mono">
            <div>
              <span className="block text-[10px] uppercase text-slate-500 font-sans font-semibold">
                Current Risk
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl font-extrabold text-slate-900">
                  {Math.round(result.before_risk_score)}
                </span>
                <span className="text-xs text-slate-400 font-sans">/ 100</span>
              </div>
              <div className="mt-1">
                <RiskBadge level={result.before_risk_level} size="sm" />
              </div>
            </div>

            <div>
              <span className="block text-[10px] uppercase text-slate-500 font-sans font-semibold">
                Simulated Risk
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl font-extrabold text-slate-900">
                  {Math.round(result.after_risk_score)}
                </span>
                <span className="text-xs text-slate-400 font-sans">/ 100</span>
              </div>
              <div className="mt-1">
                <RiskBadge level={result.after_risk_level} size="sm" />
              </div>
            </div>

            <div>
              <span className="block text-[10px] uppercase text-slate-500 font-sans font-semibold">
                Risk Delta
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-3xl font-extrabold ${
                    result.risk_score_delta > 0
                      ? 'text-rose-600'
                      : result.risk_score_delta < 0
                      ? 'text-emerald-700'
                      : 'text-slate-700'
                  }`}
                >
                  {result.risk_score_delta > 0 ? '+' : ''}
                  {result.risk_score_delta.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500 font-sans">points</span>
              </div>
              <span className="text-[11px] text-slate-500 font-sans block mt-1">
                Escalation impact
              </span>
            </div>
          </div>

          {/* Explanation Narrative */}
          <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200 font-sans">
            <span className="font-semibold text-slate-900 block mb-0.5">Assessment:</span>
            {result.explanation_of_change}
          </div>

          {/* Factor Breakdown Deltas */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
              Factor Contribution Deltas:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
              {Object.entries(result.factor_breakdown_delta).map(([k, delta]) => {
                if (delta === 0) return null;
                return (
                  <div
                    key={k}
                    className="p-2 rounded bg-slate-50 border border-slate-200 flex justify-between items-center"
                  >
                    <span className="text-slate-600 text-[11px] truncate">
                      {k.replace('_points', '').replace(/_/g, ' ')}
                    </span>
                    <span className="font-bold text-orange-700">+{delta.toFixed(1)} pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
