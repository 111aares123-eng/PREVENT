import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, RefreshCw, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, isRefreshing = false }) => {
  const location = useLocation();
  const isDetailPage = location.pathname.startsWith('/assets/');

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-orange-600/10 border border-orange-500/30 flex items-center justify-center text-orange-400 group-hover:border-orange-500/60 transition-colors">
                <ShieldAlert className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-tight text-white">PREVENT</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-orange-400 px-1.5 py-0.5 rounded bg-orange-950/60 border border-orange-800/40">
                    Safety Intelligence
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-normal">
                  Connecting the warnings before they become incidents.
                </p>
              </div>
            </Link>
          </div>

          {/* Right Action & Status Area */}
          <div className="flex items-center gap-3">
            {isDetailPage && (
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Fleet Overview
              </Link>
            )}

            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-xs text-slate-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE FLEET MONITOR</span>
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Refresh fleet data"
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
