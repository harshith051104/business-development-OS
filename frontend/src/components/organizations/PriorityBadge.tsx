import React from 'react'
import { normalizePriority, priorityColor } from '../../lib/priority'

interface PriorityBadgeProps {
  priority: string
  size?: 'sm' | 'md'
}

/** A small coloured dot plus the priority written out, so colour is never the only signal. */
export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'sm' }) => {
  const label = normalizePriority(priority) || priority || 'Not set'
  return (
    <span className={`inline-flex items-center gap-1.5 text-slate-300 ${size === 'md' ? 'text-xs' : 'text-[11px]'}`}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: priorityColor(priority) }} aria-hidden />
      {label}
    </span>
  )
}
export default PriorityBadge
