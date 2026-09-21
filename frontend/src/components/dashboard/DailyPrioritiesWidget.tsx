import React, { useEffect, useState } from 'react';
import { dailyPrioritiesService } from '../../services/dailyPriorities';
import type { DailyPrioritiesResponse, PriorityItem } from '../../types/dailyPriorities';
import { 
  Sparkles, 
  Clock, 
  PhoneCall, 
  Calendar, 
  TrendingUp, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  ShieldAlert,
  Loader2
} from 'lucide-react';

interface DailyPrioritiesWidgetProps {
  onNavigate?: (tab: string, entityId?: number) => void;
  hideContainer?: boolean;
}

export const DailyPrioritiesWidget: React.FC<DailyPrioritiesWidgetProps> = ({
  onNavigate,
  hideContainer = false,
}) => {
  const [data, setData] = useState<DailyPrioritiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPriorities();
  }, []);

  const fetchPriorities = async () => {
    try {
      setLoading(true);
      const res = await dailyPrioritiesService.getPriorities();
      setData(res);
      setError(null);
    } catch (err: any) {
      setError('Unable to load real-time daily priorities.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-center flex items-center justify-center space-x-3 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
        <span>Computing real-time commercial priorities...</span>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'who_to_contact':
        return <PhoneCall className="w-4 h-4 text-emerald-400" />;
      case 'overdue_followup':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'next_meeting':
        return <Calendar className="w-4 h-4 text-sky-400" />;
      case 'which_opportunity_is_most_important':
        return <TrendingUp className="w-4 h-4 text-violet-400" />;
      case 'pending_proposal':
        return <FileText className="w-4 h-4 text-indigo-400" />;
      case 'blocked_negotiation':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case 'customer_at_risk':
        return <ShieldAlert className="w-4 h-4 text-red-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-teal-400" />;
    }
  };

  if (hideContainer) {
    return (
      <div className="space-y-3">
        {/* Focus Action Banner */}
        <div className="bg-teal-950/30 border border-teal-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-200">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse mt-1 shrink-0" />
          <div className="min-w-0">
            <span className="font-semibold text-teal-300 mr-1.5">Next Move:</span>
            <span className="text-slate-300">{data.what_should_i_do_next}</span>
          </div>
        </div>

        {/* Priority Items List */}
        <div className="space-y-2">
          {data.all_priority_items.map((item, idx) => (
            <div
              key={idx}
              className="bg-[#1A1040]/90 hover:bg-[#1A1040] border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 transition duration-200 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <div className="p-1 rounded-md bg-slate-900 border border-slate-800">
                      {getCategoryIcon(item.category)}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {item.target_type}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    item.priority === 'High' 
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}>
                    {item.priority}
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-white group-hover:text-teal-300 transition-colors truncate">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                  {item.reason_why}
                </p>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-[11px] text-teal-400 font-medium truncate max-w-[220px]">
                  {item.recommended_action}
                </span>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate(item.target_type === 'organization' ? 'organizations' : (item.target_type === 'opportunity' ? 'opportunities' : item.target_type), item.target_id)}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition"
                    title="Open record"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-teal-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden mb-8">
      {/* Background ambient glow */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Today's Operating Priorities</h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/40 rounded-full">
                {data.total_priority_count} Key Actions
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{data.summary}</p>
          </div>
        </div>

        <button
          onClick={fetchPriorities}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
        >
          Refresh Priorities
        </button>
      </div>

      {/* Focus Action Banner */}
      <div className="mb-6 bg-slate-800/60 border border-teal-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 text-sm text-slate-200">
        <div className="flex items-center space-x-2.5">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <span className="font-medium text-teal-300">Recommended Next Move:</span>
          <span className="text-slate-300">{data.what_should_i_do_next}</span>
        </div>
      </div>

      {/* Grid of Priorities */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.all_priority_items.map((item, idx) => (
          <div
            key={idx}
            className="bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/60 hover:border-slate-600 rounded-xl p-4 transition duration-200 flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700">
                    {getCategoryIcon(item.category)}
                  </div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {item.target_type}
                  </span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                  item.priority === 'High' 
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}>
                  {item.priority}
                </span>
              </div>

              <h4 className="text-sm font-semibold text-white group-hover:text-teal-300 transition-colors">
                {item.title}
              </h4>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {item.reason_why}
              </p>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-teal-400 font-medium truncate max-w-[200px]">
                {item.recommended_action}
              </span>
              {onNavigate && (
                <button
                  onClick={() => onNavigate(item.target_type === 'organization' ? 'organizations' : (item.target_type === 'opportunity' ? 'opportunities' : item.target_type), item.target_id)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition"
                  title="Open record"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
