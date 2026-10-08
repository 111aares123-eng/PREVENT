import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { ArrowRight } from 'lucide-react';
import type { RiskHistoryResponse } from '../../types/api';

interface RiskTrajectoryChartProps {
  history: RiskHistoryResponse;
  onSelectEventId?: (eventId: string) => void;
  selectedEventId?: string | null;
}

export const RiskTrajectoryChart: React.FC<RiskTrajectoryChartProps> = ({
  history,
  onSelectEventId,
  selectedEventId
}) => {
  const points = history.points || [];

  const chartData = points.map((p, idx) => {
    const d = new Date(p.timestamp);
    const shortDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fullDate = d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      index: idx,
      name: shortDate,
      fullDate,
      score: Math.round(p.risk_score),
      exactScore: p.risk_score,
      severity: p.severity,
      eventType: p.event_type,
      description: p.description,
      eventId: p.event_id,
      isSelected: selectedEventId === p.event_id,
    };
  });

  const latestPoint = points.length > 0 ? points[points.length - 1] : null;

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
            RISK TRAJECTORY
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic risk score progression evaluated as warning signals accumulated
          </p>
        </div>

        {latestPoint && (
          <div className="flex items-baseline gap-2 font-mono text-xs">
            <span className="font-extrabold text-rose-600 text-sm">
              {Math.round(latestPoint.risk_score)} {history.current_risk_level}
            </span>
            <span className="text-slate-400">·</span>
            <span className="font-semibold text-slate-700">
              {history.trend.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>

      {/* Stepper Progression: 7 → 27 → 51 → 69 → 82 */}
      {points.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto py-1 font-mono text-xs text-slate-600">
          <span className="text-[10px] uppercase font-sans tracking-wider text-slate-400 font-semibold mr-1 shrink-0">
            Signal Sequence:
          </span>
          {chartData.map((pt, idx) => (
            <React.Fragment key={pt.eventId}>
              <button
                type="button"
                onClick={() => onSelectEventId?.(pt.eventId)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  pt.isSelected
                    ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <span className="text-[10px] text-slate-400">{pt.name}</span>
                <span className="font-bold text-slate-900">{pt.score}</span>
                <span className="text-[10px] text-slate-400">s{pt.severity}</span>
              </button>

              {idx < chartData.length - 1 && (
                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Recharts Area Chart */}
      {points.length > 0 ? (
        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onClick={(e: any) => {
                if (e?.activePayload?.[0]?.payload?.eventId && onSelectEventId) {
                  onSelectEventId(e.activePayload[0].payload.eventId);
                }
              }}
            >
              <defs>
                <linearGradient id="riskTrajectoryLightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ea580c" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ea580c" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

              <XAxis
                dataKey="name"
                stroke="#cbd5e1"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
              />

              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 45, 70, 100]}
                stroke="#cbd5e1"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
              />

              <ReferenceLine
                y={70}
                stroke="#e11d48"
                strokeDasharray="3 3"
                label={{
                  value: 'High Risk (70)',
                  fill: '#e11d48',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />

              <ReferenceLine
                y={45}
                stroke="#d97706"
                strokeDasharray="3 3"
                label={{
                  value: 'Medium Risk (45)',
                  fill: '#d97706',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white rounded p-2.5 shadow-lg text-xs font-mono max-w-xs">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-800 pb-1 mb-1">
                          <span>{data.fullDate}</span>
                          <span>Sev {data.severity}</span>
                        </div>
                        <div className="font-sans font-semibold text-slate-100 truncate">
                          {data.eventType.replace('_', ' ')}
                        </div>
                        <div className="text-[11px] font-sans text-slate-300 line-clamp-2 mt-0.5">
                          {data.description}
                        </div>
                        <div className="mt-1.5 pt-1 border-t border-slate-800 flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">Evaluated Score:</span>
                          <span className="font-bold text-amber-400">{data.score} / 100</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="score"
                stroke="#ea580c"
                strokeWidth={2}
                fill="url(#riskTrajectoryLightGrad)"
                dot={{
                  r: 4,
                  fill: '#ea580c',
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: '#ea580c',
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="py-8 text-center text-slate-400 text-xs font-mono">
          No historical risk trajectory points recorded.
        </div>
      )}
    </section>
  );
};
