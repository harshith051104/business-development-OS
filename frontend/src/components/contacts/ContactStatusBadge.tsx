import React from 'react'

interface ContactStatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

export const ContactStatusBadge: React.FC<ContactStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const getStyle = (st: string) => {
    switch (st?.toLowerCase()) {
      case 'not contacted':
        return 'bg-slate-800 text-slate-400 border-slate-700'
      case 'contacted':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
      case 'connected':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
      case 'interested':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30 font-semibold'
      case 'inactive':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30'
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
export default ContactStatusBadge
