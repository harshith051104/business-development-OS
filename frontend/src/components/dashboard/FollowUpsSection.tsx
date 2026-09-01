import React from 'react'
import type { GroupedFollowUps, CategorizedFollowUpItem } from '../../types/dashboard'
import {
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
  User,
  FileText,
  CheckCircle2,
} from 'lucide-react'

interface FollowUpsSectionProps {
  followups: GroupedFollowUps
}

const FollowUpCard: React.FC<{ item: CategorizedFollowUpItem; badgeStyle: string }> = ({
  item,
  badgeStyle,
}) => (
  <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800/80 hover:border-slate-700 transition space-y-2 group">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center space-x-1.5 truncate">
        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="font-semibold text-white text-xs truncate group-hover:text-violet-300 transition">
          {item.organization}
        </span>
      </div>
      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0 border ${badgeStyle}`}>
        {item.timing}
      </span>
    </div>

    <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
      <User className="w-3 h-3 text-slate-500 shrink-0" />
      <span className="text-slate-300">{item.contact}</span>
    </div>

    <div className="flex items-start space-x-1 text-[11px] text-slate-400 bg-slate-900/40 p-2 rounded-lg border border-slate-800/50">
      <FileText className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
      <span className="text-slate-300 leading-snug line-clamp-2">{item.reason}</span>
    </div>
  </div>
)

export const FollowUpsSection: React.FC<FollowUpsSectionProps> = ({ followups }) => {
  const totalFollowups =
    (followups.overdue?.length || 0) +
    (followups.today?.length || 0) +
    (followups.upcoming?.length || 0)

  return (
    <div className="bg-[#110B2E] border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Follow-ups</h2>
            <p className="text-xs text-slate-400">Time-sensitive outreach & relationship check-ins</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
          {totalFollowups} active
        </span>
      </div>

      {totalFollowups === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-slate-600 stroke-[1.5]" />
          <p>No follow-ups currently due.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Overdue Column */}
          <div className="space-y-2.5">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-red-400 uppercase tracking-wider px-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Overdue ({followups.overdue?.length || 0})</span>
            </div>
            {followups.overdue?.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-[#1A1040]/40 rounded-xl border border-slate-800">
                No overdue items
              </p>
            ) : (
              followups.overdue.map((item) => (
                <FollowUpCard
                  key={item.id}
                  item={item}
                  badgeStyle="bg-red-500/10 text-red-300 border-red-500/20"
                />
              ))
            )}
          </div>

          {/* Today Column */}
          <div className="space-y-2.5">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider px-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Today ({followups.today?.length || 0})</span>
            </div>
            {followups.today?.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-[#1A1040]/40 rounded-xl border border-slate-800">
                No follow-ups for today
              </p>
            ) : (
              followups.today.map((item) => (
                <FollowUpCard
                  key={item.id}
                  item={item}
                  badgeStyle="bg-amber-500/10 text-amber-300 border-amber-500/20"
                />
              ))
            )}
          </div>

          {/* Upcoming Column */}
          <div className="space-y-2.5">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-violet-400 uppercase tracking-wider px-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Upcoming ({followups.upcoming?.length || 0})</span>
            </div>
            {followups.upcoming?.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-[#1A1040]/40 rounded-xl border border-slate-800">
                No upcoming follow-ups
              </p>
            ) : (
              followups.upcoming.map((item) => (
                <FollowUpCard
                  key={item.id}
                  item={item}
                  badgeStyle="bg-violet-500/10 text-violet-300 border-violet-500/20"
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
export default FollowUpsSection
