import React, { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, dayKey, sameDay, startOfMonth, startOfWeek } from './calendarModel'

/** Small month picker for the side panel; days with items get a dot. */
export const MiniMonth: React.FC<{ selected: Date; marked: Set<string>; onPick: (d: Date) => void }> = ({ selected, marked, onPick }) => {
  const [month, setMonth] = useState(startOfMonth(selected))
  useEffect(() => setMonth(startOfMonth(selected)), [selected])
  const start = startOfWeek(month)
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const today = new Date()
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-[#EAE7EF]">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
        <div className="flex gap-1">
          <button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1 rounded-md text-[#ABA3B7] hover:text-[#EAE7EF]">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1 rounded-md text-[#ABA3B7] hover:text-[#EAE7EF]">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-[#8F879C] mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const isSel = sameDay(d, selected)
          const isToday = sameDay(d, today)
          const other = d.getMonth() !== month.getMonth()
          return (
            <button
              key={dayKey(d)}
              onClick={() => onPick(d)}
              aria-label={d.toDateString()}
              aria-pressed={isSel}
              className={`relative mx-auto w-7 h-7 rounded-full text-[11px] ${
                isToday ? 'bg-[#7A5C9E] text-white font-semibold' : isSel ? 'bg-[#443253] text-[#EAE7EF] ring-1 ring-[#8B6BB1]/60' : other ? 'text-[#7E778A]' : 'text-[#ABA3B7] hover:bg-white/10'
              }`}
            >
              {d.getDate()}
              {marked.has(dayKey(d)) && !isToday && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#B49ACF]" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MiniMonth
