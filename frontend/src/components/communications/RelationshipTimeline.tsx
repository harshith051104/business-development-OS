import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { communicationsService } from '../../services/communications'
import type { RelationshipTimeline as IRelationshipTimeline, TimelineItem } from '../../types/communication'
import CommunicationChannelBadge from './CommunicationChannelBadge'
import CommunicationDirectionBadge from './CommunicationDirectionBadge'
import RecordCommunicationModal from './RecordCommunicationModal'
import {
  Clock,
  MessageSquare,
  Calendar,
  Clock3,
  Activity,
  Plus,
  RotateCw,
  ExternalLink,
  ChevronRight,
  User,
} from 'lucide-react'

interface RelationshipTimelineProps {
  organizationId?: number
  organizationName?: string
  contactId?: number
  contactName?: string
  opportunityId?: number
  opportunityName?: string
  title?: string
  limit?: number
}

export const RelationshipTimeline: React.FC<RelationshipTimelineProps> = ({
  organizationId,
  organizationName,
  contactId,
  contactName,
  opportunityId,
  opportunityName,
  title = 'Relationship History & Timeline',
  limit = 50,
}) => {
  const [timeline, setTimeline] = useState<IRelationshipTimeline | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false)

  const fetchTimeline = useCallback(async () => {
    if (!organizationId && !contactId && !opportunityId) return
    setLoading(true)
    try {
      const data = await communicationsService.getRelationshipTimeline({
        organization_id: organizationId,
        contact_id: contactId,
        opportunity_id: opportunityId,
        limit,
      })
      setTimeline(data)
    } catch (err) {
      console.error('Failed to load relationship timeline:', err)
    } finally {
      setLoading(false)
    }
  }, [organizationId, contactId, opportunityId, limit])

  useEffect(() => {
    fetchTimeline()
  }, [fetchTimeline])

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'communication':
        return <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
      case 'meeting':
        return <Calendar className="w-3.5 h-3.5 text-blue-400" />
      case 'followup':
        return <Clock3 className="w-3.5 h-3.5 text-amber-400" />
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-400" />
    }
  }

  const getEventLink = (event: TimelineItem) => {
    if (event.event_type === 'communication' && event.reference_id) {
      return `/business-development/communications/${event.reference_id}`
    }
    if (event.event_type === 'meeting' && event.reference_id) {
      return `/business-development/meetings/${event.reference_id}`
    }
    if (event.event_type === 'followup') {
      return `/business-development/followups`
    }
    return null
  }

  return (
    <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400">
              {title}
            </h2>
            <p className="text-xs text-slate-400">
              Chronological log of communications, meetings, and follow-ups
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {organizationId && (
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="inline-flex items-center space-x-1 py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition shadow-md shadow-violet-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Communication</span>
            </button>
          )}
        </div>
      </div>

      {/* Timeline Content */}
      {loading ? (
        <div className="py-12 text-center space-y-2">
          <RotateCw className="w-6 h-6 animate-spin text-violet-400 mx-auto" />
          <p className="text-xs text-slate-500">Loading relationship history...</p>
        </div>
      ) : !timeline || timeline.events.length === 0 ? (
        <div className="py-12 text-center space-y-3 bg-[#1A1040] rounded-xl border border-slate-800 p-6">
          <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-xs font-bold text-slate-300">No communication history yet</h3>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            Record your first business interaction with this account to start building the timeline.
          </p>
          {organizationId && (
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Communication</span>
            </button>
          )}
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
          {timeline.events.map((event) => {
            const link = getEventLink(event)
            const dateObj = new Date(event.timestamp)
            const formattedDate = dateObj.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
            const formattedTime = dateObj.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div key={event.id} className="relative group">
                {/* Bullet */}
                <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-[#110B2E] border-2 border-violet-500 group-hover:scale-110 transition flex items-center justify-center" />

                <div className="p-4 rounded-xl bg-[#1A1040] border border-slate-800 hover:border-slate-700 transition space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-violet-300">
                        {formattedDate} · {formattedTime}
                      </span>
                      {event.channel && (
                        <CommunicationChannelBadge channel={event.channel} size="sm" />
                      )}
                      {event.direction && (
                        <CommunicationDirectionBadge direction={event.direction} size="sm" />
                      )}
                    </div>

                    {link && (
                      <Link
                        to={link}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>

                  <div className="text-xs font-bold text-white">{event.title}</div>

                  {event.subtitle && (
                    <div className="text-[11px] text-slate-400">{event.subtitle}</div>
                  )}

                  {event.description && (
                    <p className="text-xs text-slate-300 bg-[#110B2E] p-2.5 rounded-lg border border-slate-800/80 leading-relaxed whitespace-pre-wrap">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Record Communication Modal */}
      {organizationId && (
        <RecordCommunicationModal
          isOpen={isRecordModalOpen}
          organizationId={organizationId}
          organizationName={organizationName}
          contactId={contactId}
          contactName={contactName}
          opportunityId={opportunityId}
          opportunityName={opportunityName}
          onClose={() => setIsRecordModalOpen(false)}
          onSuccess={fetchTimeline}
        />
      )}
    </div>
  )
}
export default RelationshipTimeline
