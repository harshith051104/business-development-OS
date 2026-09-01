import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { communicationsService } from '../../services/communications'
import type { Communication } from '../../types/communication'
import CommunicationChannelBadge from '../communications/CommunicationChannelBadge'
import CommunicationDirectionBadge from '../communications/CommunicationDirectionBadge'
import { MessageSquare, ArrowRight, Plus, Building2, User, RotateCw } from 'lucide-react'

export const RecentCommunicationsSection: React.FC = () => {
  const [communications, setCommunications] = useState<Communication[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    communicationsService
      .getCommunications({ page_size: 5, sort_by: 'communication_date', sort_order: 'desc' })
      .then((data) => setCommunications(data.items))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
              Recent Outreach & Communications
            </h2>
            <p className="text-xs text-slate-400">
              Latest email, call, and direct engagement interactions
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/business-development/communications/new"
            className="inline-flex items-center space-x-1 py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition shadow-md shadow-violet-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record</span>
          </Link>
          <Link
            to="/business-development/communications"
            className="inline-flex items-center space-x-1 py-1.5 px-3 rounded-lg bg-[#1A1040] hover:bg-slate-800 text-slate-300 text-xs font-semibold transition border border-slate-800"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <RotateCw className="w-5 h-5 animate-spin text-violet-400 mx-auto" />
        </div>
      ) : communications.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 italic">
          No communication logged yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {communications.map((comm) => (
            <Link
              key={comm.id}
              to={`/business-development/communications/${comm.id}`}
              className="p-3.5 rounded-xl bg-[#1A1040] border border-slate-800/80 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-violet-300">
                    {new Date(comm.communication_date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <CommunicationChannelBadge channel={comm.channel} size="sm" />
                  <CommunicationDirectionBadge direction={comm.direction} size="sm" />
                </div>
                <div className="text-xs font-bold text-white group-hover:text-violet-300 transition">
                  {comm.subject}
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                  {comm.organization_name && (
                    <span className="flex items-center space-x-1">
                      <Building2 className="w-3 h-3 text-slate-500" />
                      <span>{comm.organization_name}</span>
                    </span>
                  )}
                  {comm.contact_name && (
                    <span className="flex items-center space-x-1 text-teal-400">
                      <User className="w-3 h-3 text-teal-500" />
                      <span>{comm.contact_name}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 shrink-0 self-end sm:self-center">
                {comm.created_by || 'BD Team'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
export default RecentCommunicationsSection
