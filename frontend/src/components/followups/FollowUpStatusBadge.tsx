import React from 'react'
import type { FollowUpStatus } from '../../types/followup'

interface FollowUpStatusBadgeProps {
  status: FollowUpStatus | string
  isOverdue?: boolean
  size?: 'sm' | 'md'
}

export const FollowUpStatusBadge: React.FC<FollowUpStatusBadgeProps> = ({
  status,
  isOverdue = false,
  size = 'md',
}) => {
  const getColors = () => {
    if (isOverdue && status === 'Pending') {
      return 'bg-rose-500/15 text-rose-300 border-rose-500/40'
    }
    switch (status) {
      case 'Pending':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
      case 'Completed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      case 'Cancelled':
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
      {isOverdue && status === 'Pending' ? 'Overdue' : status}
    </span>
  )
}
export default FollowUpStatusBadge
