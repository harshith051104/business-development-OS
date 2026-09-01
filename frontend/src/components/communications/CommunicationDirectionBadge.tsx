import React from 'react'
import type { CommunicationDirection } from '../../types/communication'
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'

interface CommunicationDirectionBadgeProps {
  direction: CommunicationDirection | string
  size?: 'sm' | 'md'
}

export const CommunicationDirectionBadge: React.FC<CommunicationDirectionBadgeProps> = ({
  direction,
  size = 'md',
}) => {
  const isOutgoing = direction === 'Outgoing'

  const getColors = () => {
    return isOutgoing
      ? 'bg-violet-500/10 text-violet-300 border-violet-500/30'
      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
  }

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-[10px] space-x-1' : 'px-2.5 py-1 text-xs font-semibold space-x-1.5'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${getColors()} ${sizeClasses}`}
    >
      {isOutgoing ? (
        <ArrowUpRight className="w-3 h-3 text-violet-400" />
      ) : (
        <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
      )}
      <span>{direction}</span>
    </span>
  )
}
export default CommunicationDirectionBadge
