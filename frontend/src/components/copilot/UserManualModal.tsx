import React, { useState, useEffect } from 'react'
import {
  BookOpen,
  X,
  Search,
  ChevronRight,
  Layers,
  Sparkles,
  Sliders,
  Mail,
  Users,
  CheckCircle2,
  Activity,
  Calendar,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react'
import { copilotService } from '../../services/copilot'

interface Section {
  key: string
  title: string
  content: string
}

interface UserManualModalProps {
  isOpen: boolean
  onClose: () => void
}

export const UserManualModal: React.FC<UserManualModalProps> = ({ isOpen, onClose }) => {
  const [sections, setSections] = useState<Section[]>([])
  const [selectedKey, setSelectedKey] = useState<string>('system_overview')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen && sections.length === 0) {
      setLoading(true)
      copilotService
        .getUserManual()
        .then((res) => {
          if (res && res.sections) {
            setSections(res.sections)
            if (res.sections.length > 0) {
              setSelectedKey(res.sections[0].key)
            }
          }
        })
        .catch((err) => {
          console.error('Failed to load user manual:', err)
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen, sections.length])

  if (!isOpen) return null

  const filteredSections = sections.filter((s) => {
    const q = search.toLowerCase()
    return s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
  })

  const currentSection = sections.find((s) => s.key === selectedKey) || sections[0]

  const handleCopy = () => {
    if (currentSection) {
      navigator.clipboard.writeText(currentSection.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getSectionIcon = (key: string) => {
    switch (key) {
      case 'system_overview':
        return <Layers className="w-4 h-4 text-violet-400" />
      case 'dashboard':
        return <Activity className="w-4 h-4 text-violet-400" />
      case 'find_organizations':
        return <Search className="w-4 h-4 text-cyan-400" />
      case 'organizations':
        return <Users className="w-4 h-4 text-blue-400" />
      case 'contacts':
        return <Users className="w-4 h-4 text-emerald-400" />
      case 'opportunities':
        return <CheckCircle2 className="w-4 h-4 text-amber-400" />
      case 'lead_import':
        return <CheckCircle2 className="w-4 h-4 text-purple-400" />
      case 'connection_pipeline':
        return <Sliders className="w-4 h-4 text-blue-400" />
      case 'lead_tracker':
        return <CheckCircle2 className="w-4 h-4 text-indigo-400" />
      case 'statuses_and_colors':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />
      case 'reply_monitoring_agent':
        return <Mail className="w-4 h-4 text-pink-400" />
      case 'campaigns':
        return <Users className="w-4 h-4 text-amber-400" />
      case 'showcase':
        return <Sparkles className="w-4 h-4 text-purple-400" />
      case 'outreach_and_tracker':
        return <Mail className="w-4 h-4 text-violet-400" />
      case 'meetings_and_demos':
        return <Calendar className="w-4 h-4 text-cyan-400" />
      case 'proposals_and_negotiations':
        return <Layers className="w-4 h-4 text-blue-400" />
      case 'tasks_and_followups':
        return <CheckCircle2 className="w-4 h-4 text-amber-400" />
      case 'partnerships_and_customers':
        return <Users className="w-4 h-4 text-emerald-400" />
      case 'reports_and_analytics':
        return <Activity className="w-4 h-4 text-pink-400" />
      case 'calendar_and_map':
        return <Calendar className="w-4 h-4 text-cyan-400" />
      case 'communications':
        return <Mail className="w-4 h-4 text-blue-400" />
      case 'admin_console':
        return <ShieldCheck className="w-4 h-4 text-rose-400" />
      case 'ask_elly_copilot':
        return <Sparkles className="w-4 h-4 text-purple-400" />
      case 'gmail_and_deliverability':
        return <Activity className="w-4 h-4 text-rose-400" />
      default:
        return <BookOpen className="w-4 h-4 text-slate-400" />
    }
  }

  // Format simple markdown into clean HTML elements
  const renderFormattedMarkdown = (md: string) => {
    const lines = md.split('\n')
    return (
      <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim()

          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-xl font-black text-white pt-2 pb-1 border-b border-white/10 flex items-center gap-2">
                {trimmed.replace('# ', '')}
              </h1>
            )
          }
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-base font-bold text-violet-300 pt-3">
                {trimmed.replace('### ', '')}
              </h3>
            )
          }
          if (trimmed.startsWith('#### ')) {
            return (
              <h4 key={idx} className="text-sm font-semibold text-slate-200 pt-2">
                {trimmed.replace('#### ', '')}
              </h4>
            )
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const content = trimmed.substring(2)
            // Bold parser
            const parts = content.split(/(\*\*.*?\*\*)/g)
            return (
              <li key={idx} className="ml-4 list-disc text-slate-300 text-xs">
                {parts.map((part, pIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                      <strong key={pIdx} className="text-white font-semibold">
                        {part.slice(2, -2)}
                      </strong>
                    )
                  }
                  return part
                })}
              </li>
            )
          }
          if (trimmed.match(/^\d+\.\s/)) {
            const content = trimmed.replace(/^\d+\.\s/, '')
            const parts = content.split(/(\*\*.*?\*\*)/g)
            return (
              <div key={idx} className="ml-4 text-slate-300 text-xs flex gap-2">
                <span className="font-mono text-violet-400 font-bold shrink-0">{trimmed.match(/^\d+\./)?.[0]}</span>
                <div>
                  {parts.map((part, pIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return (
                        <strong key={pIdx} className="text-white font-semibold">
                          {part.slice(2, -2)}
                        </strong>
                      )
                    }
                    return part
                  })}
                </div>
              </div>
            )
          }
          if (trimmed === '---') {
            return <hr key={idx} className="border-white/10 my-4" />
          }
          if (!trimmed) {
            return <div key={idx} className="h-1" />
          }

          // Paragraph with bold support
          const parts = trimmed.split(/(\*\*.*?\*\*|`.*?`)/g)
          return (
            <p key={idx} className="text-xs text-slate-300 leading-normal">
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <strong key={pIdx} className="text-white font-semibold">
                      {part.slice(2, -2)}
                    </strong>
                  )
                }
                if (part.startsWith('`') && part.endsWith('`')) {
                  return (
                    <code key={pIdx} className="px-1.5 py-0.5 rounded bg-white/10 text-violet-300 font-mono text-[11px]">
                      {part.slice(1, -1)}
                    </code>
                  )
                }
                return part
              })}
            </p>
          )
        })}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl h-[85vh] bg-[#0F0A24] border border-violet-800/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#1A1040] to-[#110B2E] border-b border-violet-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300 shadow-lg shadow-violet-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Business Development OS — User Manual
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Official Guide
                </span>
              </h2>
              <p className="text-xs text-slate-400">Verbatim system documentation, workflows, and feature specifications</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={13} />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search manual topics..."
                className="pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 w-52 transition-all"
              />
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              title="Close Manual"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Two Columns (Chapters / Content) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Chapters */}
          <div className="w-72 border-r border-violet-800/30 bg-[#0B071A]/70 flex flex-col p-3 space-y-1 overflow-y-auto">
            <div className="text-[10px] uppercase font-bold text-slate-500 px-3 py-1 tracking-wider">
              Manual Chapters ({filteredSections.length})
            </div>

            {loading ? (
              <div className="p-4 text-xs text-slate-500 text-center">Loading documentation...</div>
            ) : filteredSections.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 text-center">No matching chapters found.</div>
            ) : (
              filteredSections.map((sec) => {
                const isSelected = sec.key === selectedKey
                return (
                  <button
                    key={sec.key}
                    onClick={() => setSelectedKey(sec.key)}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {getSectionIcon(sec.key)}
                      <span className="truncate">{sec.title}</span>
                    </div>
                    {isSelected && <ChevronRight size={13} className="text-violet-400 shrink-0" />}
                  </button>
                )
              })
            )}
          </div>

          {/* Right Content Area: Verbatim Documentation */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0717]/60">
            {currentSection ? (
              <>
                <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/[0.01]">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <BookOpen size={13} className="text-violet-400" />
                    <span>Documentation</span>
                    <span>/</span>
                    <span className="text-white font-medium">{currentSection.title}</span>
                  </div>

                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10 cursor-pointer"
                    title="Copy section markdown"
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-violet-800/40">
                  <div className="max-w-3xl mx-auto space-y-4">
                    {renderFormattedMarkdown(currentSection.content)}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                Select a topic from the left sidebar to view its manual.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
