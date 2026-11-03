import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dailyPrioritiesService } from '../../services/dailyPriorities';
import type { OrganizationQueueResponse, QueueAction, QueueSection } from '../../types/dailyPriorities';
import { Building2, CheckSquare, Clock, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

const SECTION_STYLES: Record<QueueSection['key'], string> = {
  overdue: 'text-rose-300',
  today: 'text-amber-300',
  upcoming: 'text-slate-300',
  undated: 'text-slate-400',
};

const formatDue = (iso?: string | null) => {
  if (!iso) return 'No due date';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const ActionRow: React.FC<{ action: QueueAction }> = ({ action }) => (
  <li className="flex items-start justify-between gap-2 py-1">
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] text-white">
        {action.kind === 'task' ? (
          <CheckSquare className="w-3 h-3 text-teal-400 shrink-0" />
        ) : (
          <Clock className="w-3 h-3 text-amber-400 shrink-0" />
        )}
        <span className="truncate">{action.title}</span>
      </div>
      <div className="text-[10px] text-slate-500 pl-[18px]">
        {formatDue(action.due_at)}
        {action.owner_name ? ` · ${action.owner_name}` : ''}
        {action.priority ? ` · ${action.priority}` : ''}
      </div>
    </div>
    <Link
      to={action.source_url}
      className="text-[10px] text-violet-400 hover:text-white underline shrink-0"
      title={`Open the ${action.kind === 'task' ? 'tasks' : 'follow-ups'} page`}
    >
      {action.kind === 'task' ? 'Task' : 'Follow-up'} #{action.id}
    </Link>
  </li>
);

export const OrganizationQueue: React.FC = () => {
  const [data, setData] = useState<OrganizationQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dailyPrioritiesService.getOrganizationQueue());
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Unable to load your organization queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="bg-[#1A1040]/90 border border-slate-800/80 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          <Building2 className="w-3.5 h-3.5 text-teal-400" />
          <span>My Organization Queue</span>
          {data && !loading && <span className="text-slate-500 normal-case">({data.total_actions})</span>}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition disabled:opacity-50"
          title="Refresh queue"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
          <span>Loading your open tasks and follow-ups…</span>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-2 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button onClick={load} className="text-rose-200 underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {!error && data && data.total_actions === 0 && (
        <p className="text-[11px] text-slate-400 py-1">
          No open organization tasks or pending follow-ups assigned to you.
        </p>
      )}

      {!error && data && data.total_actions > 0 && (
        <div className="space-y-2">
          {data.sections
            .filter((s) => s.organizations.length > 0)
            .map((section) => (
              <div key={section.key} className="space-y-1">
                <div className={`text-[10px] font-bold uppercase tracking-wider ${SECTION_STYLES[section.key]}`}>
                  {section.label}
                </div>
                {section.organizations.map((group) => (
                  <div
                    key={`${section.key}-${group.organization_id}`}
                    className="border-l border-slate-700 pl-2"
                  >
                    <Link
                      to={group.organization_url}
                      className="text-[11px] font-semibold text-teal-300 hover:text-white"
                    >
                      {group.organization_name}
                    </Link>
                    {group.financial_health && group.financial_health !== 'insufficient_data' && (
                      <span className="ml-1.5 text-[10px] text-slate-500">
                        · financials: {group.financial_health === 'stale' ? 'out of date' : group.financial_health}
                      </span>
                    )}
                    <ul>
                      {group.actions.map((action) => (
                        <ActionRow key={`${action.kind}-${action.id}`} action={action} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default OrganizationQueue;
