import React from 'react'
import type { CommunicationChannel } from '../../types/communication'
import {
  Mail,
  Phone,
  MessageCircle,
  Video,
  Users,
  MapPin,
  MessageSquare,
  Share2,
} from 'lucide-react'

interface CommunicationChannelBadgeProps {
  channel: CommunicationChannel | string
  size?: 'sm' | 'md'
}

export const CommunicationChannelBadge: React.FC<CommunicationChannelBadgeProps> = ({
  channel,
  size = 'md',
}) => {
  const getIcon = () => {
    switch (channel) {
      case 'Email':
        return <Mail className="w-3.5 h-3.5" />
      case 'Phone':
        return <Phone className="w-3.5 h-3.5" />
      case 'LinkedIn':
        return <Share2 className="w-3.5 h-3.5" />
      case 'WhatsApp':
        return <MessageCircle className="w-3.5 h-3.5" />
      case 'Meeting':
        return <Users className="w-3.5 h-3.5" />
      case 'Video Call':
        return <Video className="w-3.5 h-3.5" />
      case 'In Person':
        return <MapPin className="w-3.5 h-3.5" />
      default:
        return <MessageSquare className="w-3.5 h-3.5" />
    }
  }

  const getColors = () => {
    switch (channel) {
      case 'Email':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'Phone':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      case 'LinkedIn':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30'
      case 'WhatsApp':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/30'
      case 'Meeting':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/30'
      case 'Video Call':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
      case 'In Person':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    }
  }

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-[10px] space-x-1' : 'px-2.5 py-1 text-xs font-semibold space-x-1.5'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${getColors()} ${sizeClasses}`}
    >
      {getIcon()}
      <span>{channel}</span>
    </span>
  )
}
export default CommunicationChannelBadge
