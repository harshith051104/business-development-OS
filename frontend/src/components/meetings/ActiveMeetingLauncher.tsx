import React, { useState, useEffect, useRef } from 'react'
import { Video, ExternalLink, Bell, CheckCircle2, Clock, X, ChevronRight } from 'lucide-react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface ActiveMeeting {
  id: number
  title: string
  organization_name: string | null
  primary_contact_name: string | null
  scheduled_at: string
  duration_minutes: number
  location: string | null
  meeting_url: string | null
  is_active: boolean
  time_to_start_seconds: number
  auto_enter_eligible: boolean
}

interface ActiveUpcomingResponse {
  meetings: ActiveMeeting[]
  server_time: string
}

export const ActiveMeetingLauncher: React.FC = () => {
  const { user } = useAuth()
  const [meetings, setMeetings] = useState<ActiveMeeting[]>([])
  const [dismissedMeetingIds, setDismissedMeetingIds] = useState<number[]>([])
  const [autoEnterEnabled, setAutoEnterEnabled] = useState<boolean>(() => {
    return localStorage.getItem('elly_auto_enter_meeting') === 'true'
  })
  const launchedMeetingIdsRef = useRef<Set<number>>(new Set())

  // Toggle auto-enter preference
  const toggleAutoEnter = () => {
    const nextVal = !autoEnterEnabled
    setAutoEnterEnabled(nextVal)
    localStorage.setItem('elly_auto_enter_meeting', String(nextVal))
  }

  // Poll for active / upcoming meetings
  useEffect(() => {
    if (!user) return

    let isMounted = true
    const checkMeetings = async () => {
      try {
        const data = await api.get<ActiveUpcomingResponse>(
          '/api/business-development/meetings/active-upcoming'
        )
        if (!isMounted) return

        setMeetings(data.meetings || [])

        // Check if any meeting should be auto-entered
        if (autoEnterEnabled) {
          for (const m of data.meetings || []) {
            if (
              m.auto_enter_eligible &&
              m.meeting_url &&
              !launchedMeetingIdsRef.current.has(m.id) &&
              !dismissedMeetingIds.includes(m.id)
            ) {
              launchedMeetingIdsRef.current.add(m.id)
              // Auto-launch meet URL in new tab
              window.open(m.meeting_url, '_blank')
              // Notify user
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`Launching Meeting: ${m.title}`, {
                  body: `Entering meeting with ${m.organization_name || 'Prospect'}`,
                })
              }
            }
          }
        }
      } catch {
        // Silently handle if unauthenticated or offline
      }
    }

    checkMeetings()
    const interval = setInterval(checkMeetings, 20000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [user, autoEnterEnabled, dismissedMeetingIds])

  // Request browser notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Filter out dismissed meetings
  const visibleMeetings = meetings.filter((m) => !dismissedMeetingIds.includes(m.id))
  if (visibleMeetings.length === 0) return null

  const activeMeeting = visibleMeetings[0]

  const handleLaunchMeeting = (meeting: ActiveMeeting) => {
    launchedMeetingIdsRef.current.add(meeting.id)
    if (meeting.meeting_url) {
      window.open(meeting.meeting_url, '_blank')
    } else {
      window.location.href = `/business-development/meetings/${meeting.id}`
    }
  }

  const handleDismiss = (id: number) => {
    setDismissedMeetingIds((prev) => [...prev, id])
  }

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return 'In Progress Now'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `Starts in ${secs}s`
    return `Starts in ${mins}m ${secs}s`
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md w-full animate-in slide-in-from-top duration-300">
      <div className="bg-[#160E3B]/95 backdrop-blur-md border border-violet-500/40 rounded-2xl p-4 shadow-2xl text-white space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
              {activeMeeting.is_active ? 'Live Business Meeting' : 'Upcoming Meeting'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-violet-600/30 text-[10px] font-mono text-violet-300 border border-violet-500/30">
              {formatCountdown(activeMeeting.time_to_start_seconds)}
            </span>
          </div>

          <button
            onClick={() => handleDismiss(activeMeeting.id)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white line-clamp-1">{activeMeeting.title}</h4>
          <p className="text-xs text-slate-300 flex items-center space-x-1.5">
            <span>{activeMeeting.organization_name || 'Prospect'}</span>
            {activeMeeting.primary_contact_name && (
              <>
                <span className="text-slate-500">·</span>
                <span className="text-violet-300">{activeMeeting.primary_contact_name}</span>
              </>
            )}
          </p>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
          {/* Auto Enter Toggle */}
          <label className="flex items-center space-x-2 cursor-pointer select-none text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={autoEnterEnabled}
              onChange={toggleAutoEnter}
              className="rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-0 w-3.5 h-3.5"
            />
            <span>Auto-enter on time</span>
          </label>

          {/* Join Button */}
          <button
            onClick={() => handleLaunchMeeting(activeMeeting)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition flex items-center space-x-1.5 shrink-0"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Enter Meeting Now</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ActiveMeetingLauncher
