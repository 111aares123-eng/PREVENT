import React from 'react';
import { FileText } from 'lucide-react';

interface ExplanationCardProps {
  narrative: string;
}

export const ExplanationCard: React.FC<ExplanationCardProps> = ({ narrative }) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-orange-950/60 border border-orange-800/50 text-orange-400">
          <FileText className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            WHY PREVENT FLAGGED THIS ASSET
          </h3>
          <p className="text-xs text-slate-400">
            Synthesized algorithmic justification for safety decision support
          </p>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-200 text-xs leading-relaxed font-sans">
        <p className="whitespace-pre-line">{narrative}</p>
      </div>
    </div>
  );
};
