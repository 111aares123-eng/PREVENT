import React from 'react';
import type { TimelineEventItem } from '../../types/api';

interface EventTimelineProps {
  events: TimelineEventItem[];
  primarySubsystem?: string;
  highlightedEventIds?: string[];
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  highlightedEventIds = []
}) => {
  // Sort ascending
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
            CHRONOLOGICAL SIGNAL TIMELINE
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-departmental warning signals aggregated in chronological order
          </p>
        </div>

        <span className="text-xs font-mono text-slate-400">
          {sortedEvents.length} events logged
        </span>
      </div>

      {/* Clean Editorial Timeline (Vertical line + small event markers) */}
      <div className="relative pl-6 space-y-6 pt-2 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-px before:bg-slate-200">
        {sortedEvents.map((ev) => {
          const isNearMiss = ev.event_type === 'near_miss' || ev.severity >= 5;
          const isHighlighted = highlightedEventIds.includes(ev.id);

          const dateObj = new Date(ev.timestamp);
          const dateStr = dateObj.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
          });
          const timeStr = dateObj.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={ev.id}
              id={`event-item-${ev.id}`}
              className={`relative scroll-mt-24 transition-colors ${
                isHighlighted ? 'bg-amber-50/80 -mx-3 px-3 py-2 rounded-md ring-1 ring-amber-300' : ''
              }`}
            >
              {/* Timeline Bullet Node */}
              <div
                className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                  isNearMiss
                    ? 'bg-rose-600 ring-rose-100'
                    : ev.severity >= 4
                    ? 'bg-orange-500'
                    : 'bg-slate-400'
                }`}
              />

              {/* Event Content Row */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 text-xs">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-slate-400 text-[11px] font-medium">
                    {dateStr}
                  </span>
                  <span
                    className={`font-semibold uppercase tracking-wider text-xs ${
                      isNearMiss ? 'text-rose-700 font-bold' : 'text-slate-900'
                    }`}
                  >
                    {ev.event_type.replace('_', ' ')}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    · {ev.reporter_role}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                  <span
                    className={`px-1.5 py-0.2 rounded border font-semibold ${
                      ev.severity >= 5
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : ev.severity >= 4
                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Sev {ev.severity}
                  </span>
                  <span className="text-slate-400 hidden sm:inline">{timeStr}</span>
                </div>
              </div>

              {/* Event Description */}
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {ev.description}
              </p>
              {ev.location && (
                <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                  Location: {ev.location}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
