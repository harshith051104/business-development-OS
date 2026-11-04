import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  HOUR_PX,
  SNAP_MIN,
  dayKey,
  layoutDay,
  meetingColor,
  sameDay,
  taskColor,
  timeLabel,
  type CalItem,
  type CalMeeting,
  type CalTask,
} from './calendarModel'
import { CheckSquare, Square } from 'lucide-react'

interface Props {
  days: Date[]
  meetings: CalMeeting[]
  tasks: CalTask[]
  tzShort: string
  selectedKey: string | null
  onSelect: (item: CalItem, anchor: DOMRect) => void
  onCreateAt: (day: Date, minutes: number | null, anchor: DOMRect) => void
  onMoveMeeting: (m: CalMeeting, start: Date, durationMin: number) => void
  onMoveTask: (taskId: number, day: string) => void
}

type Drag = {
  id: number
  mode: 'move' | 'resize'
  startX: number
  startY: number
  origStart: Date
  origEnd: Date
  dayIndex: number
  moved: boolean
  preview: { start: Date; end: Date } | null
}

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes()
const snap = (m: number) => Math.round(m / SNAP_MIN) * SNAP_MIN

/** Week / Day view: day headers, an all-day row for task due dates, and an hourly grid for meetings. */
export const TimeGrid: React.FC<Props> = ({ days, meetings, tasks, tzShort, selectedKey, onSelect, onCreateAt, onMoveMeeting, onMoveTask }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const justDragged = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [dropDay, setDropDay] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  const today = new Date()

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_PX - 8
  }, [])
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const byDay = useMemo(() => {
    const m = new Map<string, CalMeeting[]>()
    meetings.forEach((x) => {
      const k = dayKey(x.start)
      m.set(k, [...(m.get(k) || []), x])
    })
    return m
  }, [meetings])
  const tasksByDay = useMemo(() => {
    const m = new Map<string, CalTask[]>()
    tasks.forEach((t) => t.day && m.set(t.day, [...(m.get(t.day) || []), t]))
    return m
  }, [tasks])

  // Pointer-based move/resize for meetings, snapped to 15 minutes.
  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const dy = e.clientY - drag.startY
      const dx = e.clientX - drag.startX
      if (!drag.moved && Math.abs(dy) < 4 && Math.abs(dx) < 4) return
      const deltaMin = snap((dy / HOUR_PX) * 60)
      let start = drag.origStart
      let end = drag.origEnd
      if (drag.mode === 'resize') {
        end = new Date(Math.max(drag.origStart.getTime() + SNAP_MIN * 60000, drag.origEnd.getTime() + deltaMin * 60000))
      } else {
        const colW = Math.max(1, ((scrollRef.current?.clientWidth || 0) - 56) / days.length)
        const dayDelta = Math.max(-drag.dayIndex, Math.min(days.length - 1 - drag.dayIndex, Math.round(dx / colW)))
        const shiftMs = (deltaMin + dayDelta * 1440) * 60000
        start = new Date(drag.origStart.getTime() + shiftMs)
        end = new Date(drag.origEnd.getTime() + shiftMs)
      }
      setDrag({ ...drag, moved: true, preview: { start, end } })
    }
    const onUp = () => {
      const d = drag
      setDrag(null)
      if (d.moved) {
        // The click that follows a drag must not open the details panel.
        justDragged.current = true
        setTimeout(() => (justDragged.current = false), 0)
      }
      if (d.moved && d.preview) {
        const m = meetings.find((x) => x.id === d.id)
        const changed = d.preview.start.getTime() !== d.origStart.getTime() || d.preview.end.getTime() !== d.origEnd.getTime()
        if (m && changed) onMoveMeeting(m, d.preview.start, Math.round((d.preview.end.getTime() - d.preview.start.getTime()) / 60000))
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, days.length, meetings, onMoveMeeting])

  const taskChip = (t: CalTask) => {
    const c = taskColor(t.task)
    const done = t.task.status === 'Completed'
    return (
      <button
        key={`t-${t.id}`}
        type="button"
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/elly-task', String(t.id))}
        onClick={(e) => onSelect(t, (e.currentTarget as HTMLElement).getBoundingClientRect())}
        aria-label={`Task: ${t.title}, due ${t.day}, ${t.task.status}`}
        className={`w-full flex items-center gap-1 text-left text-[11px] rounded-md px-1.5 py-0.5 truncate outline-none focus-visible:ring-2 focus-visible:ring-[#8B7CC7] ${selectedKey === `task-${t.id}` ? 'ring-2 ring-[#8B7CC7]' : ''}`}
        style={{ backgroundColor: c.bg, color: c.text, borderLeft: `3px solid ${c.dot}` }}
      >
        {done ? <CheckSquare className="w-3 h-3 shrink-0" /> : <Square className="w-3 h-3 shrink-0" />}
        <span className={`truncate ${done ? 'line-through' : ''}`}>{t.title}</span>
      </button>
    )
  }

  const dayHeader = (d: Date) => {
    const isToday = sameDay(d, today)
    return (
      <div
        key={dayKey(d)}
        className={`rounded-2xl px-3 py-2 flex items-baseline gap-1.5 justify-center ${isToday ? 'bg-[#3a3a52] ring-1 ring-[#8B7CC7]' : 'bg-[#0E0B1D]'}`}
      >
        <span className={`text-sm ${isToday ? 'text-[#C9C2E3]' : 'text-[#8B7CC7]'}`}>{d.toLocaleDateString(undefined, { weekday: 'short' }).toLowerCase()}</span>
        <span className={`text-2xl font-semibold ${isToday ? 'text-[#C9C2E3]' : 'text-[#C9C2E3]/90'}`}>{d.getDate()}</span>
      </div>
    )
  }

  const gridCols = { gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Day headers */}
      <div className="grid gap-2 px-3 pt-1 pb-2" style={gridCols}>
        <div className="rounded-2xl bg-[#0E0B1D] flex items-center justify-center" title={`Times shown in ${tzShort}`}>
          <span className="text-[10px] font-semibold text-[#8B7CC7] -rotate-90 whitespace-nowrap">{tzShort}</span>
        </div>
        {days.map(dayHeader)}
      </div>

      <div className="flex-1 min-h-0 bg-[#0E0B1D] rounded-3xl mx-3 mb-3 border border-[#2a1e4d] flex flex-col overflow-hidden shadow-sm">
        {/* All-day row: task due dates (no times or durations) */}
        <div className="grid border-b border-[#2a1e4d]" style={gridCols}>
          <div className="text-[10px] text-[#8B7CC7] px-2 py-2 leading-tight">Tasks due</div>
          {days.map((d) => {
            const k = dayKey(d)
            const list = tasksByDay.get(k) || []
            return (
              <div
                key={k}
                data-day={k}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('text/elly-task')) {
                    e.preventDefault()
                    setDropDay(k)
                  }
                }}
                onDragLeave={() => setDropDay((x) => (x === k ? null : x))}
                onDrop={(e) => {
                  const id = Number(e.dataTransfer.getData('text/elly-task'))
                  setDropDay(null)
                  if (id) onMoveTask(id, k)
                }}
                className={`p-1 space-y-0.5 min-h-[34px] max-h-[96px] overflow-y-auto border-l border-[#2a1e4d] ${dropDay === k ? 'bg-[#2a1e4d]' : ''}`}
              >
                {list.map(taskChip)}
              </div>
            )
          })}
        </div>

        {/* Hourly grid */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid relative" style={{ ...gridCols, height: 24 * HOUR_PX }}>
            <div className="relative">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="absolute right-2 text-[11px] text-[#8B7CC7] -translate-y-1/2" style={{ top: h * HOUR_PX }}>
                  {h === 0 ? '' : new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' }).toLowerCase()}
                </div>
              ))}
            </div>
            <div className="contents">
              {days.map((d, di) => {
                const k = dayKey(d)
                const list = byDay.get(k) || []
                const lay = layoutDay(list)
                const isToday = sameDay(d, today)
                return (
                  <div
                    key={k}
                    className="relative border-l border-[#2a1e4d] cursor-pointer"
                    onClick={(e) => {
                      if (e.target !== e.currentTarget) return
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const minutes = Math.min(23 * 60 + 30, Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30)
                      onCreateAt(d, minutes, new DOMRect(e.clientX, e.clientY, 1, 1))
                    }}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="absolute left-0 right-0 border-t border-[#2a1e4d] pointer-events-none" style={{ top: h * HOUR_PX }} />
                    ))}
                    {isToday && (
                      <div className="absolute left-0 right-0 border-t-2 border-[#C9C2E3] z-10 pointer-events-none" style={{ top: (minutesOf(now) / 60) * HOUR_PX }}>
                        <span className="absolute -left-1 -top-[5px] w-2 h-2 rounded-full bg-[#C9C2E3]" />
                      </div>
                    )}
                    {list.map((m) => {
                      const live = drag?.id === m.id && drag.preview ? drag.preview : { start: m.start, end: m.end }
                      // Meetings that cross midnight are clipped to this day.
                      const startMin = sameDay(live.start, d) ? minutesOf(live.start) : 0
                      const endMin = sameDay(live.end, d) ? Math.max(startMin + 15, minutesOf(live.end)) : 1440
                      const pos = lay.get(m.id) || { col: 0, cols: 1 }
                      const c = meetingColor(m.meeting.meeting_type)
                      const dayShift = drag?.id === m.id && drag.preview ? Math.round((startOfDayMs(live.start) - startOfDayMs(m.start)) / 864e5) : 0
                      const cancelled = m.meeting.status === 'Cancelled'
                      return (
                        <div
                          key={m.id}
                          className={`absolute rounded-2xl px-2 py-1.5 overflow-hidden select-none touch-none group ${drag?.id === m.id ? 'shadow-lg z-20 opacity-90' : 'z-[5]'} ${selectedKey === `meeting-${m.id}` ? 'ring-2 ring-[#8B7CC7]' : ''}`}
                          style={{
                            top: (startMin / 60) * HOUR_PX + 1,
                            height: Math.max(22, ((endMin - startMin) / 60) * HOUR_PX - 3),
                            left: `calc(${(pos.col / pos.cols) * 100}% + 3px + ${dayShift * 100}%)`,
                            width: `calc(${100 / pos.cols}% - 6px)`,
                            backgroundColor: c.bg,
                            color: c.text,
                            borderLeft: `3px solid ${c.dot}`,
                            opacity: cancelled ? 0.55 : undefined,
                          }}
                          onPointerDown={(e) => {
                            if ((e.target as HTMLElement).dataset.resize) return
                            e.preventDefault()
                            setDrag({ id: m.id, mode: 'move', startX: e.clientX, startY: e.clientY, origStart: m.start, origEnd: m.end, dayIndex: di, moved: false, preview: null })
                          }}
                          onClick={(e) => {
                            if (justDragged.current) return
                            onSelect(m, (e.currentTarget as HTMLElement).getBoundingClientRect())
                          }}
                        >
                          <button
                            type="button"
                            className="block w-full text-left outline-none focus-visible:underline"
                            aria-label={`Meeting: ${m.title}, ${timeLabel(live.start)} to ${timeLabel(live.end)}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onSelect(m, (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect())
                              }
                            }}
                          >
                            <span className={`block text-[12px] font-semibold leading-tight truncate ${cancelled ? 'line-through' : ''}`}>{m.title}</span>
                            <span className="block text-[11px] opacity-80">
                              {timeLabel(live.start)} – {timeLabel(live.end)}
                            </span>
                            {m.meeting.organization_name && <span className="block text-[11px] opacity-70 truncate">{m.meeting.organization_name}</span>}
                          </button>
                          {m.meeting.primary_contact_name && endMin - startMin >= 60 && (
                            <div className="flex mt-1" aria-hidden>
                              <span className="w-6 h-6 rounded-full bg-[#8B7CC7] border-2 border-[#0E0B1D] text-[#0E0B1D] text-[10px] font-semibold flex items-center justify-center" title={m.meeting.primary_contact_name}>
                                {m.meeting.primary_contact_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('')}
                              </span>
                            </div>
                          )}
                          <div
                            data-resize="1"
                            title="Drag to change the end time"
                            className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 bg-black/20"
                            onPointerDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setDrag({ id: m.id, mode: 'resize', startX: e.clientX, startY: e.clientY, origStart: m.start, origEnd: m.end, dayIndex: di, moved: false, preview: null })
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const startOfDayMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export default TimeGrid
