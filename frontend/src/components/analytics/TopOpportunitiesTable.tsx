import React from 'react'
import { Link } from 'react-router-dom'
import type { TopOpportunity } from '../../types/analytics'
import OpportunityStageBadge from '../opportunities/OpportunityStageBadge'
import OpportunityPriorityBadge from '../opportunities/OpportunityPriorityBadge'
import { Target, ExternalLink } from 'lucide-react'

interface TopOpportunitiesTableProps {
  opportunities: TopOpportunity[]
}

export const TopOpportunitiesTable: React.FC<TopOpportunitiesTableProps> = ({
  opportunities,
}) => {
  return (
    <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400">
              High-Priority Active Opportunities
            </h2>
            <p className="text-xs text-slate-400">
              Key enterprise discussions and prospective partnerships
            </p>
          </div>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 italic">
          No active opportunities recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">Opportunity & Account</th>
                <th className="pb-3 font-semibold">Stage</th>
                <th className="pb-3 font-semibold">Priority</th>
                <th className="pb-3 font-semibold">Estimated Value</th>
                <th className="pb-3 font-semibold">Next Action</th>
                <th className="pb-3 font-semibold">Owner</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {opportunities.map((opp) => (
                <tr key={opp.id} className="hover:bg-[#1A1040]/40 transition">
                  <td className="py-3">
                    <div className="font-bold text-white">{opp.name}</div>
                    <div className="text-[11px] text-slate-400">{opp.organization_name}</div>
                  </td>
                  <td className="py-3">
                    <OpportunityStageBadge stage={opp.stage} size="sm" />
                  </td>
                  <td className="py-3">
                    <OpportunityPriorityBadge priority={opp.priority} size="sm" />
                  </td>
                  <td className="py-3 font-mono font-semibold text-emerald-400">
                    {opp.estimated_value
                      ? `${opp.currency} ${opp.estimated_value.toLocaleString()}`
                      : 'Value unavailable'}
                  </td>
                  <td className="py-3 text-slate-300">
                    <div>{opp.next_action || 'None set'}</div>
                    {opp.next_action_date && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(opp.next_action_date).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-slate-400">{opp.owner_name || 'BD Team'}</td>
                  <td className="py-3 text-right">
                    <Link
                      to={`/business-development/opportunities/${opp.id}`}
                      className="p-1.5 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 hover:text-white inline-flex transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
export default TopOpportunitiesTable
