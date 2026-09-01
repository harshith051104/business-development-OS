import React from 'react'
import type { UpcomingMeetingItem } from '../../types/dashboard'
import {
  Calendar,
  Building2,
  User,
  Clock,
  Video,
  Sparkles,
} from 'lucide-react'

interface UpcomingMeetingsProps {
  meetings: UpcomingMeetingItem[]
}

export const UpcomingMeetings: React.FC<UpcomingMeetingsProps> = ({ meetings }) => {
  return (
    <div className="bg-[#110B2E] border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Upcoming Meetings</h2>
            <p className="text-xs text-slate-400">Scheduled presentations & partnership discussions</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
          {meetings.length} scheduled
        </span>
      </div>

      {meetings.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
          <Calendar className="w-8 h-8 text-slate-600 stroke-[1.5]" />
          <p>No upcoming meetings scheduled.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {meetings.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-[#1A1040] border border-slate-800/80 hover:border-purple-500/30 transition-all duration-200 flex flex-col justify-between space-y-3 group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <h3 className="font-semibold text-white text-sm group-hover:text-purple-200 transition truncate">
                      {item.organization}
                    </h3>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-800/30 text-xs text-purple-200 flex items-center space-x-1.5 mb-2">
                  <Video className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate font-medium">{item.meeting_type}</span>
                </div>

                <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                  <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-slate-300">{item.contact}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-medium">{item.date}</span>
                <span className="px-2 py-0.5 rounded bg-[#110B2E] border border-slate-700 text-purple-300">
                  {item.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export default UpcomingMeetings
