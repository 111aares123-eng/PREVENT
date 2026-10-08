import React from 'react';

interface ExplanationCardProps {
  narrative: string;
}

export const ExplanationCard: React.FC<ExplanationCardProps> = ({ narrative }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
      <div className="border-b border-slate-200 pb-2">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
          ASSESSMENT NARRATIVE
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Deterministic audit explanation of calculated score
        </p>
      </div>

      <div className="text-xs text-slate-700 leading-relaxed font-sans pt-1">
        <p className="whitespace-pre-line">{narrative}</p>
      </div>
    </div>
  );
};
