import React from 'react'
import type { TeamMemberPerformance } from '../../types/analytics'
import { Users, User } from 'lucide-react'

interface TeamPerformanceTableProps {
  team: TeamMemberPerformance[]
}

export const TeamPerformanceTable: React.FC<TeamPerformanceTableProps> = ({ team }) => {
  return (
    <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
              Team Operational Activity
            </h2>
            <p className="text-xs text-slate-400">
              Operational visibility across Business Development accounts and tasks
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="pb-3 font-semibold">BD Team Member</th>
              <th className="pb-3 font-semibold text-center">Accounts Added</th>
              <th className="pb-3 font-semibold text-center">Contacts Added</th>
              <th className="pb-3 font-semibold text-center">Comms Logged</th>
              <th className="pb-3 font-semibold text-center">Meetings Done</th>
              <th className="pb-3 font-semibold text-center">Opps Managed</th>
              <th className="pb-3 font-semibold text-center">Follow-ups Done</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {team.map((member) => (
              <tr key={member.user_id} className="hover:bg-[#1A1040]/40 transition">
                <td className="py-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-full bg-violet-600/20 text-violet-300 border border-violet-500/30 flex items-center justify-center font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-white">{member.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-center font-mono font-semibold text-slate-200">
                  {member.organizations_added}
                </td>
                <td className="py-3 text-center font-mono font-semibold text-slate-200">
                  {member.contacts_added}
                </td>
                <td className="py-3 text-center font-mono font-semibold text-slate-200">
                  {member.communications_logged}
                </td>
                <td className="py-3 text-center font-mono font-semibold text-violet-300">
                  {member.meetings_completed}
                </td>
                <td className="py-3 text-center font-mono font-semibold text-indigo-300">
                  {member.opportunities_managed}
                </td>
                <td className="py-3 text-center font-mono font-semibold text-teal-300">
                  {member.followups_completed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
export default TeamPerformanceTable
