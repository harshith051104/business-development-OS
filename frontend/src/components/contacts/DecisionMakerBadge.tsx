import React from 'react'
import { Award } from 'lucide-react'

interface DecisionMakerBadgeProps {
  isDecisionMaker: boolean
  size?: 'sm' | 'md'
}

export const DecisionMakerBadge: React.FC<DecisionMakerBadgeProps> = ({
  isDecisionMaker,
  size = 'sm',
}) => {
  if (!isDecisionMaker) return null

  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'

  return (
    <span
      className={`inline-flex items-center space-x-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider ${padding}`}
      title="Key Decision Maker / Approver"
    >
      <Award className="w-3 h-3 text-amber-400" />
      <span>Decision Maker</span>
    </span>
  )
}
export default DecisionMakerBadge
