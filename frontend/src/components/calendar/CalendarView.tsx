import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calendarService } from '../../services/calendar'
import type { CalendarEvent } from '../../services/calendar'
import { parseMeetingDate } from '../../utils/date'

const STATUS_COLORS: Record<string, string> = {
  Scheduled: 'bg-blue-500',
  Completed: 'bg-green-500',
  Rescheduled: 'bg-amber-500',
  Cancelled: 'bg-red-500',
}

const STATUS_DOTS: Record<string, string> = {
  Scheduled: 'bg-blue-400',
  Completed: 'bg-green-400',
  Rescheduled: 'bg-amber-400',
  Cancelled: 'bg-red-400',
}

interface CalendarViewProps {
  onEventClick?: (event: CalendarEvent) => void
  height?: string
}

function toLocalDate(isoStr: string): Date {
  const d = parseMeetingDate(isoStr)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export default function CalendarView({ onEventClick, height = '600px' }: CalendarViewProps) {
  const navigate = useNavigate()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  useEffect(() => {
    loadEvents()
  }, [currentDate])

  async function loadEvents() {
    setLoading(true)
    try {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
      const data = await calendarService.getEvents({
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      })
      setEvents(data)
    } catch {
      setEvents([])
    }
    setLoading(false)
  }

  function getDaysInMonth() {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }

  function getEventsForDay(day: number) {
    return events.filter(e => {
      const d = toLocalDate(e.start)
      return d.getDate() === day && d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()
    })
  }

  function handleEventClick(event: CalendarEvent) {
    if (onEventClick) {
      onEventClick(event)
    } else {
      navigate(`/business-development/meetings/${event.id}`)
    }
  }

  function prevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setSelectedDay(null)
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setSelectedDay(null)
  }

  function today() {
    setCurrentDate(new Date())
    setSelectedDay(new Date().getDate())
  }

  const days = getDaysInMonth()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const todayDate = new Date()
  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : []

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition">
            ←
          </button>
          <h2 className="text-white font-semibold text-lg min-w-[200px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition">
            →
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={today} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition">
            Today
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 border-b border-slate-700">
        {dayNames.map(d => (
          <div key={d} className="text-center text-slate-400 text-xs py-2 font-medium">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-slate-400">Loading events...</div>
        </div>
      ) : (
        <div className="grid grid-cols-7" style={{ minHeight: height }}>
          {days.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className="border-b border-r border-slate-700/50" />
            const dayEvents = getEventsForDay(day)
            const isToday = day === todayDate.getDate() &&
              currentDate.getMonth() === todayDate.getMonth() &&
              currentDate.getFullYear() === todayDate.getFullYear()
            const isSelected = day === selectedDay

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`border-b border-r border-slate-700/50 p-1 min-h-[80px] cursor-pointer transition-colors ${
                  isSelected ? 'bg-indigo-900/30' : isToday ? 'bg-slate-700/30' : 'hover:bg-slate-700/20'
                }`}
              >
                <div className={`text-xs mb-1 ${isToday ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}>
                  {isToday ? <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">{day}</span> : day}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(event => (
                    <button
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEventClick(event)
                      }}
                      className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate text-white hover:brightness-110 transition ${STATUS_COLORS[event.status] || 'bg-slate-600'}`}
                    >
                      {event.title.substring(0, 18)}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-slate-500 pl-1">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Selected day detail panel */}
      {selectedDay && (
        <div className="border-t border-slate-700 p-4 bg-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">
              {monthNames[currentDate.getMonth()]} {selectedDay}, {currentDate.getFullYear()}
            </h3>
            <button onClick={() => setSelectedDay(null)} className="text-slate-400 hover:text-white text-xs">✕ Close</button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No meetings on this day</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map(event => (
                <button
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="w-full flex items-start gap-3 text-left p-3 bg-[#1A1040] border border-slate-700 rounded-xl hover:border-violet-500/50 transition"
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${STATUS_DOTS[event.status] || 'bg-slate-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium">{event.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {parseMeetingDate(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {event.end && ` – ${parseMeetingDate(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                    {event.organization_name && (
                      <div className="text-xs text-violet-400 mt-0.5">{event.organization_name}</div>
                    )}
                    {event.contact_names.length > 0 && (
                      <div className="text-xs text-slate-500 mt-0.5">With: {event.contact_names.join(', ')}</div>
                    )}
                    {event.location && (
                      <div className="text-xs text-slate-500 mt-0.5">📍 {event.location}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        event.status === 'Completed' ? 'bg-green-500/20 text-green-300' :
                        event.status === 'Scheduled' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-slate-600/40 text-slate-400'
                      }`}>{event.status}</span>
                      {event.meeting_type && (
                        <span className="text-[10px] text-slate-500">{event.meeting_type}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All events this month list */}
      {!selectedDay && events.length > 0 && (
        <div className="border-t border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-2">All Meetings This Month ({events.length})</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {events.map(event => (
              <button
                key={event.id}
                onClick={() => handleEventClick(event)}
                className="w-full flex items-center gap-3 text-left p-2 hover:bg-slate-700 rounded transition"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOTS[event.status] || 'bg-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{event.title}</div>
                  <div className="text-xs text-slate-400">
                    {parseMeetingDate(event.start).toLocaleDateString()} at {parseMeetingDate(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' • '}{event.organization_name || 'No org'}
                  </div>
                </div>
                <span className="text-xs text-slate-500">{event.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
