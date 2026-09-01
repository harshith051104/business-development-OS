import React from 'react'
import type { PartnershipType } from '../../types/partnership'
import {
  Handshake,
  Cpu,
  TrendingUp,
  Share2,
  Headphones,
  Truck,
  UserCheck,
  Tag,
} from 'lucide-react'

interface Props {
  type: string
  size?: 'sm' | 'md'
}

export const PartnershipTypeBadge: React.FC<Props> = ({ type, size = 'sm' }) => {
  const getStyle = (t: string) => {
    switch (t) {
      case 'Technology Partnership':
        return {
          bg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
          icon: Cpu,
        }
      case 'Business Partnership':
        return {
          bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
          icon: Handshake,
        }
      case 'Strategic Partnership':
        return {
          bg: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
          icon: TrendingUp,
        }
      case 'Integration Partnership':
        return {
          bg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
          icon: Share2,
        }
      case 'Service Partnership':
        return {
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          icon: Headphones,
        }
      case 'Distribution Partnership':
        return {
          bg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
          icon: Truck,
        }
      case 'Referral Partnership':
        return {
          bg: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
          icon: UserCheck,
        }
      default:
        return {
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: Tag,
        }
    }
  }

  const { bg, icon: Icon } = getStyle(type)
  const sizeClasses = size === 'md' ? 'text-xs px-3 py-1 gap-1.5' : 'text-[11px] px-2.5 py-0.5 gap-1'

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border ${bg} ${sizeClasses}`}
    >
      <Icon className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      <span>{type}</span>
    </span>
  )
}
export default PartnershipTypeBadge
