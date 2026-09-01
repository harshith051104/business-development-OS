import React from 'react'

interface PriorityBadgeProps {
  priority: string
  size?: 'sm' | 'md'
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'sm' }) => {
  const getStyle = (pr: string) => {
    switch (pr?.toLowerCase()) {
      case 'high':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold'
      case 'medium':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-medium'
      case 'low':
        return 'bg-slate-700/30 text-slate-400 border-slate-700 font-normal'
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700'
    }
  }

  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'

  return (
    <span
      className={`inline-flex items-center uppercase tracking-wider rounded-md border ${getStyle(
        priority
      )} ${padding}`}
    >
      {priority}
    </span>
  )
}
export default PriorityBadge
