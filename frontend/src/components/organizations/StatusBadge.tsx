import React from 'react'

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const getStyle = (st: string) => {
    switch (st?.toLowerCase()) {
      case 'potential':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/30'
      case 'contacted':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
      case 'connected':
        return 'bg-teal-500/10 text-teal-300 border-teal-500/30'
      case 'interested':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
      case 'meeting':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30'
      case 'discussion':
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
      case 'partnership':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700'
    }
  }

  const padding = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border tracking-wide uppercase ${getStyle(
        status
      )} ${padding}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {status}
    </span>
  )
}
export default StatusBadge
