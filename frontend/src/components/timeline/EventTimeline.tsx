import React from 'react';
import { Clock, ShieldAlert, Wrench, MessageSquare, AlertTriangle, AlertOctagon, User, Radio, ArrowRight } from 'lucide-react';
import type { TimelineEventItem } from '../../types/api';

interface EventTimelineProps {
  events: TimelineEventItem[];
  primarySubsystem?: string;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  // Sort ascending
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Compute intervals between consecutive events
  const intervals: { days: number }[] = [];
  for (let i = 1; i < sortedEvents.length; i++) {
    const prev = new Date(sortedEvents[i - 1].timestamp).getTime();
    const curr = new Date(sortedEvents[i].timestamp).getTime();
    const days = Math.max(0, (curr - prev) / (1000 * 60 * 60 * 24));
    intervals.push({ days: Math.round(days * 10) / 10 });
  }

  const getEventIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'maintenance':
        return <Wrench className="w-3.5 h-3.5 text-blue-400" />;
      case 'complaint':
        return <MessageSquare className="w-3.5 h-3.5 text-amber-400" />;
      case 'inspection':
        return <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />;
      case 'operational_report':
        return <Radio className="w-3.5 h-3.5 text-orange-400" />;
      case 'near_miss':
      case 'incident':
        return <AlertOctagon className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getSeverityStyle = (sev: number) => {
    switch (sev) {
      case 5:
        return 'bg-red-500/20 border-red-500 text-red-400';
      case 4:
        return 'bg-orange-500/20 border-orange-500 text-orange-400';
      case 3:
        return 'bg-amber-500/20 border-amber-500 text-amber-400';
      case 2:
        return 'bg-blue-500/20 border-blue-500 text-blue-400';
      default:
        return 'bg-slate-500/20 border-slate-500 text-slate-400';
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" />
            CHRONOLOGICAL SIGNAL TIMELINE
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-departmental warning signals aggregated over time
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {sortedEvents.length} signals logged
        </span>
      </div>

      {/* Escalation Sequence Visualizer */}
      {sortedEvents.length >= 2 && (
        <div className="mb-6 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Signal Escalation Path (Severity & Contracting Intervals)
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {sortedEvents.map((ev, idx) => (
              <React.Fragment key={ev.id}>
                <div
                  className={`flex flex-col items-center px-2.5 py-1.5 rounded border text-xs font-mono ${getSeverityStyle(
                    ev.severity
                  )}`}
                >
                  <span className="text-[10px] text-slate-400 uppercase font-sans">
                    {new Date(ev.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="font-bold text-sm">Sev {ev.severity}</span>
                  <span className="text-[9px] uppercase tracking-wider">
                    {ev.reporter_role}
                  </span>
                </div>

                {idx < sortedEvents.length - 1 && (
                  <div className="flex flex-col items-center text-[10px] text-slate-500 font-mono px-0.5">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                    <span>{intervals[idx]?.days}d</span>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Vertical Timeline Ladder */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {sortedEvents.map((ev) => {
          const isNearMiss = ev.event_type === 'near_miss' || ev.severity >= 5;
          const formattedDate = new Date(ev.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const formattedTime = new Date(ev.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div key={ev.id} className="relative group">
              {/* Timeline Bullet Node */}
              <div
                className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border flex items-center justify-center bg-slate-900 ${
                  isNearMiss
                    ? 'border-red-500 shadow-lg shadow-red-500/30'
                    : ev.severity >= 4
                    ? 'border-orange-500'
                    : ev.severity >= 3
                    ? 'border-amber-500'
                    : 'border-slate-600'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isNearMiss
                      ? 'bg-red-400 animate-ping'
                      : ev.severity >= 4
                      ? 'bg-orange-400'
                      : ev.severity >= 3
                      ? 'bg-amber-400'
                      : 'bg-slate-400'
                  }`}
                />
              </div>

              {/* Event Content Card */}
              <div
                className={`rounded-lg border p-3.5 transition-colors ${
                  isNearMiss
                    ? 'border-red-600/40 bg-red-950/20'
                    : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-slate-900 border border-slate-800">
                      {getEventIcon(ev.event_type)}
                    </span>
                    <span className="font-bold text-white text-xs uppercase tracking-wide">
                      {ev.event_type.replace('_', ' ')}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getSeverityStyle(
                        ev.severity
                      )}`}
                    >
                      SEVERITY {ev.severity}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span>{formattedDate}</span>
                    <span className="text-slate-600">•</span>
                    <span>{formattedTime}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 mb-2 leading-relaxed font-sans">
                  {ev.description}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-850 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" />
                    Role: <strong className="text-slate-200">{ev.reporter_role}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Source: <strong className="text-slate-200">{ev.source}</strong>
                  </span>
                  {ev.location && (
                    <>
                      <span>•</span>
                      <span>
                        Location: <strong className="text-slate-200">{ev.location}</strong>
                      </span>
                    </>
                  )}
                  {ev.is_simulated && (
                    <span className="ml-auto text-[10px] font-bold text-orange-400 bg-orange-950/60 px-2 py-0.5 rounded border border-orange-800">
                      SIMULATED
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
