import React from 'react'
import type { RecentActivity } from '../../types/dashboard'
import {
  Activity,
  Building,
  UserPlus,
  Link2,
  ArrowUpRight,
  Calendar,
  Sparkles,
  MessageSquare,
  Clock,
  User,
} from 'lucide-react'

interface RecentActivityFeedProps {
  activities: RecentActivity[]
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'organization_added':
      return <Building className="w-4 h-4 text-blue-400" />
    case 'contact_added':
      return <UserPlus className="w-4 h-4 text-cyan-400" />
    case 'connection_created':
      return <Link2 className="w-4 h-4 text-emerald-400" />
    case 'status_updated':
      return <ArrowUpRight className="w-4 h-4 text-amber-400" />
    case 'meeting_scheduled':
      return <Calendar className="w-4 h-4 text-purple-400" />
    case 'project_shared':
      return <Sparkles className="w-4 h-4 text-violet-400" />
    case 'discussion_started':
      return <MessageSquare className="w-4 h-4 text-indigo-400" />
    default:
      return <Activity className="w-4 h-4 text-slate-400" />
  }
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({ activities }) => {
  return (
    <div className="bg-[#110B2E] border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Recent Activity</h2>
            <p className="text-xs text-slate-400">Real-time team outreach actions and milestone updates</p>
          </div>
        </div>
        <span className="text-xs text-slate-400">{activities.length} updates</span>
      </div>

      {activities.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
          <Activity className="w-8 h-8 text-slate-600 stroke-[1.5]" />
          <p>No recent activities recorded yet.</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
          {activities.map((act) => (
            <div key={act.id} className="relative group">
              {/* Timeline marker node */}
              <div className="absolute -left-6 top-2 w-4 h-4 rounded-full bg-[#1A1040] border border-slate-700 flex items-center justify-center -translate-x-1/2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              </div>

              <div className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800/80 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5 sm:mt-0">
                    {getActivityIcon(act.type)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-white transition">
                      {act.description}
                    </p>
                    <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-400">
                      <span className="text-violet-300 font-medium">{act.organization}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <User className="w-3 h-3 text-slate-500" />
                        {act.user_name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  <span className="flex items-center space-x-1 text-[11px] text-slate-500 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{act.timestamp}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export default RecentActivityFeed
