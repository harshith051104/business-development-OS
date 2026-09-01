import React from 'react'
import type { MeetingStatus } from '../../types/meeting'

interface MeetingStatusBadgeProps {
  status: MeetingStatus | string
  size?: 'sm' | 'md'
}

export const MeetingStatusBadge: React.FC<MeetingStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const getColors = () => {
    switch (status) {
      case 'Scheduled':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'Completed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      case 'Rescheduled':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'Cancelled':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30'
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    }
  }

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs font-semibold'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${getColors()} ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {status}
    </span>
  )
}
export default MeetingStatusBadge
