import React from 'react'
import { Link } from 'react-router-dom'
import type { AttentionRequired } from '../../types/analytics'
import {
  AlertTriangle,
  Clock3,
  Target,
  Calendar,
  Building2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'

interface AttentionRequiredWidgetProps {
  attention: AttentionRequired
}

export const AttentionRequiredWidget: React.FC<AttentionRequiredWidgetProps> = ({
  attention,
}) => {
  const totalItems =
    attention.overdue_followups_count +
    attention.opportunities_no_next_action_count +
    attention.interested_no_meeting_count +
    attention.stale_organizations_count

  return (
    <div className="bg-[#110B2E] border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-amber-400">
              Attention Required
            </h2>
            <p className="text-xs text-slate-400">
              High-priority relationship bottlenecks and overdue commitments
            </p>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
          {totalItems} Items
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Overdue Follow-ups */}
        <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <Clock3 className="w-4 h-4 text-rose-400" />
              <span>Overdue Follow-ups</span>
            </div>
            <span className="text-xs font-mono font-bold text-rose-400">
              {attention.overdue_followups_count}
            </span>
          </div>

          {attention.overdue_followups.length > 0 ? (
            <div className="space-y-2">
              {attention.overdue_followups.slice(0, 3).map((fol) => (
                <div
                  key={fol.id}
                  className="p-2.5 rounded-lg bg-[#110B2E] border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <div className="font-semibold text-slate-200 truncate">{fol.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {fol.organization_name || 'Account'} · Due{' '}
                      {new Date(fol.due_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Link
                    to="/business-development/followups"
                    className="text-[11px] text-violet-400 hover:text-white shrink-0"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-center text-xs text-slate-500 italic">
              All follow-ups are up to date.
            </div>
          )}
        </div>

        {/* 2. Opportunities Without Next Actions */}
        <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <Target className="w-4 h-4 text-amber-400" />
              <span>Opportunities Without Next Action</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">
              {attention.opportunities_no_next_action_count}
            </span>
          </div>

          {attention.opportunities_no_next_action.length > 0 ? (
            <div className="space-y-2">
              {attention.opportunities_no_next_action.slice(0, 3).map((opp) => (
                <div
                  key={opp.id}
                  className="p-2.5 rounded-lg bg-[#110B2E] border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <div className="font-semibold text-slate-200 truncate">{opp.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {opp.organization_name} · Stage: {opp.stage}
                    </div>
                  </div>
                  <Link
                    to={`/business-development/opportunities/${opp.id}`}
                    className="text-[11px] text-violet-400 hover:text-white shrink-0"
                  >
                    Fix
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-center text-xs text-slate-500 italic">
              All active opportunities have defined next actions.
            </div>
          )}
        </div>

        {/* 3. Interested Orgs Without Scheduled Meeting */}
        <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Interested Accounts (No Meeting Set)</span>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400">
              {attention.interested_no_meeting_count}
            </span>
          </div>

          {attention.interested_no_meeting.length > 0 ? (
            <div className="space-y-2">
              {attention.interested_no_meeting.slice(0, 3).map((org) => (
                <div
                  key={org.id}
                  className="p-2.5 rounded-lg bg-[#110B2E] border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <div className="font-semibold text-slate-200 truncate">{org.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {org.city || 'Location unavailable'} · Status: Interested
                    </div>
                  </div>
                  <Link
                    to={`/business-development/meetings/new?organization_id=${org.id}`}
                    className="text-[11px] text-indigo-400 hover:text-white shrink-0"
                  >
                    Schedule
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-center text-xs text-slate-500 italic">
              All interested accounts have upcoming scheduled meetings.
            </div>
          )}
        </div>

        {/* 4. Stale Active Accounts (>14 days no contact) */}
        <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <Building2 className="w-4 h-4 text-violet-400" />
              <span>Stale Active Accounts (&gt;14 days)</span>
            </div>
            <span className="text-xs font-mono font-bold text-violet-400">
              {attention.stale_organizations_count}
            </span>
          </div>

          {attention.stale_organizations.length > 0 ? (
            <div className="space-y-2">
              {attention.stale_organizations.slice(0, 3).map((stale) => (
                <div
                  key={stale.id}
                  className="p-2.5 rounded-lg bg-[#110B2E] border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <div className="font-semibold text-slate-200 truncate">{stale.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Inactive for {stale.days_since_last_activity} days · {stale.status}
                    </div>
                  </div>
                  <Link
                    to={`/business-development/organizations/${stale.id}`}
                    className="text-[11px] text-violet-400 hover:text-white shrink-0"
                  >
                    Review
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-center text-xs text-slate-500 italic">
              All active pipeline accounts have recent communication activity.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default AttentionRequiredWidget
