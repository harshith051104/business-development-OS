import React, { useMemo, useState } from 'react'
import { dayKey, meetingColor, sameDay, taskColor, timeLabel, type CalItem, type CalMeeting, type CalTask } from './calendarModel'
import { CheckSquare, Square } from 'lucide-react'

interface Props {
  days: Date[] // 42 days, Monday first
  month: number
  meetings: CalMeeting[]
  tasks: CalTask[]
  selectedKey: string | null
  onSelect: (item: CalItem, anchor: DOMRect) => void
  onCreateAt: (day: Date, minutes: number | null, anchor: DOMRect) => void
  onOpenDay: (day: Date) => void
  onMoveTask: (taskId: number, day: string) => void
  onMoveMeetingDay: (m: CalMeeting, day: Date) => void
}

const MAX_PER_CELL = 3

/** Month view: meetings and task due dates per day; drag an item to another day to reschedule it. */
export const MonthGrid: React.FC<Props> = ({ days, month, meetings, tasks, selectedKey, onSelect, onCreateAt, onOpenDay, onMoveTask, onMoveMeetingDay }) => {
  const [dropDay, setDropDay] = useState<string | null>(null)
  const today = new Date()
  const items = useMemo(() => {
    const m = new Map<string, CalItem[]>()
    meetings.forEach((x) => m.set(dayKey(x.start), [...(m.get(dayKey(x.start)) || []), x]))
    tasks.forEach((t) => t.day && m.set(t.day, [...(m.get(t.day) || []), t]))
    m.forEach((list) =>
      list.sort((a, b) => (a.kind === 'task' ? -1 : 1) - (b.kind === 'task' ? -1 : 1) || (a.kind === 'meeting' && b.kind === 'meeting' ? a.start.getTime() - b.start.getTime() : 0)),
    )
    return m
  }, [meetings, tasks])

  const chip = (it: CalItem) => {
    const isTask = it.kind === 'task'
    const c = isTask ? taskColor((it as CalTask).task) : meetingColor((it as CalMeeting).meeting.meeting_type)
    const done = isTask && (it as CalTask).task.status === 'Completed'
    return (
      <button
        key={`${it.kind}-${it.id}`}
        type="button"
        draggable
        onDragStart={(e) => e.dataTransfer.setData(isTask ? 'text/elly-task' : 'text/elly-meeting', String(it.id))}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(it, (e.currentTarget as HTMLElement).getBoundingClientRect())
        }}
        aria-label={isTask ? `Task: ${it.title}` : `Meeting: ${it.title} at ${timeLabel((it as CalMeeting).start)}`}
        className={`w-full flex items-center gap-1 text-left text-[11px] rounded-md px-1.5 py-0.5 truncate outline-none focus-visible:ring-2 focus-visible:ring-[#8B7CC7] ${selectedKey === `${it.kind}-${it.id}` ? 'ring-2 ring-[#8B7CC7]' : ''}`}
        style={{ backgroundColor: c.bg, color: c.text, borderLeft: `3px solid ${c.dot}` }}
      >
        {isTask ? done ? <CheckSquare className="w-3 h-3 shrink-0" /> : <Square className="w-3 h-3 shrink-0" /> : <span className="shrink-0 font-semibold">{timeLabel((it as CalMeeting).start)}</span>}
        <span className={`truncate ${done ? 'line-through' : ''}`}>{it.title}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 px-3 pb-3">
      <div className="grid grid-cols-7 gap-2 pb-2">
        {days.slice(0, 7).map((d) => (
          <div key={d.getDay()} className="rounded-2xl bg-[#0E0B1D] text-center text-sm text-[#8B7CC7] py-2">
            {d.toLocaleDateString(undefined, { weekday: 'short' })}
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 bg-[#0E0B1D] border border-[#2a1e4d] rounded-3xl grid grid-cols-7 grid-rows-6 overflow-hidden shadow-sm">
        {days.map((d) => {
          const k = dayKey(d)
          const list = items.get(k) || []
          const other = d.getMonth() !== month
          return (
            <div
              key={k}
              data-day={k}
              onClick={(e) => e.target === e.currentTarget && onCreateAt(d, null, new DOMRect(e.clientX, e.clientY, 1, 1))}
              onDragOver={(e) => {
                e.preventDefault()
                setDropDay(k)
              }}
              onDragLeave={() => setDropDay((x) => (x === k ? null : x))}
              onDrop={(e) => {
                setDropDay(null)
                const taskId = Number(e.dataTransfer.getData('text/elly-task'))
                const meetingId = Number(e.dataTransfer.getData('text/elly-meeting'))
                if (taskId) onMoveTask(taskId, k)
                if (meetingId) {
                  const m = meetings.find((x) => x.id === meetingId)
                  if (m) onMoveMeetingDay(m, d)
                }
              }}
              className={`border-t border-l border-[#2a1e4d] p-1 min-h-0 overflow-hidden cursor-pointer flex flex-col gap-0.5 ${dropDay === k ? 'bg-[#2a1e4d]' : ''} ${other ? 'bg-black/30' : ''}`}
            >
              <div className="flex items-center justify-between pointer-events-none">
                <span
                  className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${sameDay(d, today) ? 'bg-[#5A3B8C] text-white font-semibold' : other ? 'text-[#8B7CC7]' : 'text-[#8B7CC7]'}`}
                >
                  {d.getDate()}
                </span>
              </div>
              {list.slice(0, MAX_PER_CELL).map(chip)}
              {list.length > MAX_PER_CELL && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenDay(d)
                  }}
                  className="text-[11px] text-[#8B7CC7] hover:text-[#C9C2E3] text-left px-1"
                >
                  +{list.length - MAX_PER_CELL} more
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MonthGrid
