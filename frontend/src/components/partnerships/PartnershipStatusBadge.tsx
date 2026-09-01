import React from 'react'
import { CheckCircle2, PauseCircle, CheckCircle, XCircle } from 'lucide-react'

interface Props {
  status: string
  size?: 'sm' | 'md'
}

export const PartnershipStatusBadge: React.FC<Props> = ({ status, size = 'sm' }) => {
  const getStyle = (st: string) => {
    switch (st) {
      case 'Active':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: CheckCircle2,
        }
      case 'On Hold':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          icon: PauseCircle,
        }
      case 'Completed':
        return {
          bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
          icon: CheckCircle,
        }
      case 'Ended':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          icon: XCircle,
        }
      default:
        return {
          bg: 'bg-slate-800 text-slate-400 border-slate-700',
          icon: CheckCircle2,
        }
    }
  }

  const { bg, icon: Icon } = getStyle(status)
  const sizeClasses = size === 'md' ? 'text-xs px-3 py-1 gap-1.5' : 'text-[10px] px-2 py-0.5 gap-1'

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider border ${bg} ${sizeClasses}`}
    >
      <Icon className={size === 'md' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'} />
      <span>{status}</span>
    </span>
  )
}
export default PartnershipStatusBadge
