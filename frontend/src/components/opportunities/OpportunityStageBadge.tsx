import React from 'react'
import type { OpportunityStage } from '../../types/opportunity'

interface OpportunityStageBadgeProps {
  stage: OpportunityStage | string
  size?: 'sm' | 'md'
}

export const OpportunityStageBadge: React.FC<OpportunityStageBadgeProps> = ({
  stage,
  size = 'md',
}) => {
  const getColors = () => {
    switch (stage) {
      case 'Potential':
        return 'bg-slate-500/10 text-slate-300 border-slate-500/30'
      case 'Contacted':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'Connected':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
      case 'Interested':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/30'
      case 'Meeting':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'Discussion':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30'
      case 'Partnership':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
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
      {stage}
    </span>
  )
}
export default OpportunityStageBadge
