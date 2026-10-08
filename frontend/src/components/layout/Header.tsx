import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RefreshCw, Plus, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onAddReport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, isRefreshing = false, onAddReport }) => {
  const location = useLocation();
  const isDetailPage = location.pathname.startsWith('/assets/');

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand + Navigation */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-baseline gap-2 group">
            <span className="text-base font-bold tracking-tight text-slate-900">
              PREVENT
            </span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Safety Intelligence
            </span>
          </Link>

          {/* Clean minimal navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-500">
            <Link
              to="/"
              className={`transition-colors hover:text-slate-900 ${
                !isDetailPage ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              Overview
            </Link>
            <a
              href="#fleet-roster"
              className="transition-colors hover:text-slate-900"
            >
              Assets
            </a>
            <button
              type="button"
              onClick={onAddReport}
              className="transition-colors hover:text-slate-900 cursor-pointer"
            >
              Add Report
            </button>
          </nav>
        </div>

        {/* Right utility area */}
        <div className="flex items-center gap-3">
          {isDetailPage && (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Fleet Overview</span>
            </Link>
          )}

          {/* System status indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500 pr-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>System operational</span>
          </div>

          {/* Add Safety Report Button */}
          {onAddReport && (
            <button
              type="button"
              onClick={onAddReport}
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-300" />
              <span>Safety Report</span>
            </button>
          )}

          {/* Refresh Action */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh data"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-slate-900' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
