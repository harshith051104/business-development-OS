import React from 'react'
import type { FollowUpPriority } from '../../types/followup'

interface FollowUpPriorityBadgeProps {
  priority: FollowUpPriority | string
  size?: 'sm' | 'md'
}

export const FollowUpPriorityBadge: React.FC<FollowUpPriorityBadgeProps> = ({
  priority,
  size = 'md',
}) => {
  const getColors = () => {
    switch (priority) {
      case 'High':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30'
      case 'Medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'Low':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    }
  }

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs font-semibold'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${getColors()} ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {priority} Priority
    </span>
  )
}
export default FollowUpPriorityBadge
