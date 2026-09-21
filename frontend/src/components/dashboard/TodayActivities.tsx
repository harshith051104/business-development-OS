import React from 'react'
import type { TodayActivityItem } from '../../types/dashboard'
import {
  CalendarCheck,
  Building2,
  User,
  Clock,
  Phone,
  Send,
  Video,
  CheckCircle2,
  FileText,
} from 'lucide-react'

interface TodayActivitiesProps {
  activities: TodayActivityItem[]
  hideContainer?: boolean
}

function getActivityTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'call':
      return <Phone className="w-3.5 h-3.5 text-cyan-400" />
    case 'meeting':
      return <Video className="w-3.5 h-3.5 text-purple-400" />
    case 'send presentation':
      return <Send className="w-3.5 h-3.5 text-emerald-400" />
    default:
      return <FileText className="w-3.5 h-3.5 text-amber-400" />
  }
}

export const TodayActivities: React.FC<TodayActivitiesProps> = ({
  activities,
  hideContainer = false,
}) => {
  const content = activities.length === 0 ? (
    <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
      <CheckCircle2 className="w-7 h-7 text-slate-600 stroke-[1.5]" />
      <p>No business activities scheduled for today.</p>
    </div>
  ) : (
    <div className="space-y-2.5">
      {activities.map((item) => (
        <div
          key={item.id}
          className="p-3.5 rounded-xl bg-[#1A1040]/90 border border-slate-800/80 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
        >
          <div className="flex items-start space-x-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5 sm:mt-0">
              {getActivityTypeIcon(item.activity_type)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-white text-xs sm:text-sm group-hover:text-amber-200 transition truncate">
                  {item.activity_type} with {item.organization}
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-0.5 text-xs text-slate-400">
                <span className="flex items-center gap-1 text-slate-300 truncate">
                  <User className="w-3 h-3 text-slate-500 shrink-0" />
                  {item.contact}
                </span>
                <span>·</span>
                <span className="text-slate-400 truncate">{item.organization}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
            <span className="px-2 py-0.5 rounded-md bg-[#110B2E] border border-slate-700 text-slate-300 text-[11px] font-mono flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>{item.time}</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                item.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
              }`}
            >
              {item.status === 'completed' ? 'Done' : 'Pending'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )

  if (hideContainer) {
    return content
  }

  return (
    <div className="bg-[#110B2E] border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Today's Activities</h2>
            <p className="text-xs text-slate-400">Scheduled outreach, calls, and actions for today</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
          {activities.length} tasks
        </span>
      </div>

      {content}
    </div>
  )
}
export default TodayActivities
