import React from 'react'
import { Star } from 'lucide-react'

interface PrimaryContactBadgeProps {
  isPrimary: boolean
  size?: 'sm' | 'md'
}

export const PrimaryContactBadge: React.FC<PrimaryContactBadgeProps> = ({
  isPrimary,
  size = 'sm',
}) => {
  if (!isPrimary) return null

  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'

  return (
    <span
      className={`inline-flex items-center space-x-1 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30 font-bold uppercase tracking-wider ${padding}`}
      title="Primary Organization Contact"
    >
      <Star className="w-3 h-3 fill-current text-teal-400" />
      <span>Primary</span>
    </span>
  )
}
export default PrimaryContactBadge
