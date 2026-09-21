import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Sparkles,
  X,
  Send,
  Minimize2,
  Maximize2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Bot,
  User as UserIcon,
  Loader2,
  Building2,
  Users,
  Calendar,
  Layers,
  FileCheck2,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
} from 'lucide-react'
import { copilotService } from '../../services/copilot'
import { CopilotMessageContent } from './CopilotMessageContent'
import type {
  CopilotMessage,
  CopilotContext,
  ConfirmationAction,
  DataReference,
  CopilotSuggestion,
} from '../../types/copilot'

export const CopilotDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputMessage, setInputMessage] = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([])
  const [expandedTools, setExpandedTools] = useState<Record<number, boolean>>({})
  const [confirmLoading, setConfirmLoading] = useState<Record<string, boolean>>({})

  const location = useLocation()
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Derive active context from current route
  const getActiveContext = (): CopilotContext => {
    const path = location.pathname
    const ctx: CopilotContext = {
      current_page: path,
    }

    const orgMatch = path.match(/\/organizations\/(\d+)/)
    if (orgMatch) {
      ctx.active_entity_type = 'organization'
      ctx.active_entity_id = parseInt(orgMatch[1], 10)
    }

    const contactMatch = path.match(/\/contacts\/(\d+)/)
    if (contactMatch) {
      ctx.active_entity_type = 'contact'
      ctx.active_entity_id = parseInt(contactMatch[1], 10)
    }

    const oppMatch = path.match(/\/opportunities\/(\d+)/)
    if (oppMatch) {
      ctx.active_entity_type = 'opportunity'
      ctx.active_entity_id = parseInt(oppMatch[1], 10)
    }

    const meetingMatch = path.match(/\/meetings\/(\d+)/)
    if (meetingMatch) {
      ctx.active_entity_type = 'meeting'
      ctx.active_entity_id = parseInt(meetingMatch[1], 10)
    }

    return ctx
  }

  // Load suggestions on open or route change
  useEffect(() => {
    if (isOpen) {
      copilotService
        .getSuggestions(location.pathname)
        .then((res) => setSuggestions(res || []))
        .catch(() => setSuggestions([]))
    }
  }, [isOpen, location.pathname])

  // Scroll to bottom on message updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, loading])

  // Send initial welcome message if conversation is empty
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          sender: 'assistant',
          content:
            "👋 **Hello! I'm ELLY**, your Autonomous Business Development AI Agent powered by Groq, Gemini & NVIDIA NIM.\n\nI can proactively research prospects, draft outreach emails, recommend showcase pitch decks, schedule meetings, and surface high-priority follow-ups with safe 1-click approvals.",
          suggested_followups: [
            'What needs my attention today?',
            'Recommend showcase deck for active leads',
            'Auto-generate follow-up actions',
            'Draft outreach email for our top prospect',
          ],
        },
      ])
    }
  }, [isOpen, messages.length])

  const handleSendMessage = async (msgToSend?: string) => {
    const text = (msgToSend || inputMessage).trim()
    if (!text || loading) return

    const userMsg: CopilotMessage = {
      sender: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputMessage('')
    setLoading(true)

    try {
      const activeCtx = getActiveContext()
      const res = await copilotService.sendMessage({
        message: text,
        conversation_id: conversationId,
        context: activeCtx,
      })

      setConversationId(res.conversation_id)

      const botMsg: CopilotMessage = {
        id: res.message_id,
        conversation_id: res.conversation_id,
        sender: 'assistant',
        content: res.reply,
        intent: res.intent,
        tools_executed: res.tools_executed,
        data_references: res.data_references,
        pending_confirmation: res.pending_confirmation,
        confirmation_status: res.pending_confirmation ? 'pending' : undefined,
        suggested_followups: res.suggested_followups,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, botMsg])
    } catch (err: any) {
      const errMsg: CopilotMessage = {
        sender: 'assistant',
        content:
          '⚠️ Sorry, I encountered an error communicating with the ELLY Copilot service. Please try again.',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmAction = async (action: ConfirmationAction, approved: boolean) => {
    setConfirmLoading((prev) => ({ ...prev, [action.action_id]: true }))

    try {
      const res = await copilotService.confirmAction({
        action_id: action.action_id,
        approved,
      })

      // Update message status
      setMessages((prev) =>
        prev.map((m) => {
          if (m.pending_confirmation?.action_id === action.action_id) {
            return {
              ...m,
              confirmation_status: approved ? 'approved' : 'rejected',
            }
          }
          return m
        })
      )

      // Add feedback message
      const systemFeedback: CopilotMessage = {
        sender: 'assistant',
        content: approved
          ? `✅ **Action Confirmed**: ${res.message}`
          : `🛑 **Action Cancelled**: The request has been discarded.`,
        data_references: res.data_references,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, systemFeedback])
    } catch (err: any) {
      const errFeedback: CopilotMessage = {
        sender: 'assistant',
        content: `❌ **Failed to execute action**: ${err?.message || 'Server error'}`,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errFeedback])
    } finally {
      setConfirmLoading((prev) => ({ ...prev, [action.action_id]: false }))
    }
  }

  const handleClearChat = () => {
    setMessages([])
    setConversationId(undefined)
  }

  const toggleTools = (idx: number) => {
    setExpandedTools((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <>
      {/* Floating Sparkle Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 hover:from-violet-500 hover:to-purple-500 text-white rounded-full shadow-2xl hover:shadow-violet-500/30 transition-all duration-300 transform hover:-translate-y-0.5 border border-violet-400/30 group cursor-pointer"
          title="Open ELLY Universal BD Copilot"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-200"></span>
          </span>
          <Sparkles className="w-5 h-5 text-purple-200 animate-pulse" />
          <span className="font-semibold text-sm tracking-wide">Ask ELLY</span>
        </button>
      )}

      {/* Slide-over Copilot Drawer */}
      {isOpen && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex flex-col bg-[#0F0A24]/95 backdrop-blur-xl border border-violet-800/40 rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden ${
            isExpanded
              ? 'w-[750px] h-[85vh] max-w-[calc(100vw-2rem)]'
              : 'w-[440px] h-[640px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-[#1A1040]/90 to-[#110B2E]/90 border-b border-violet-800/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/25 border border-violet-500/40">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-100 tracking-wide">ELLY Autonomous BD Agent</h3>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider bg-emerald-500/15 text-emerald-300 rounded border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Groq • Gemini • NIM
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Autonomous Business Development & Execution</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="New Chat / Clear History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Context Banner */}
          {location.pathname !== '/' && (
            <div className="px-4 py-1.5 bg-violet-950/40 border-b border-violet-800/30 flex items-center gap-2 text-[11px] text-violet-300">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
              <span className="truncate">
                Context: <strong>{location.pathname}</strong>
              </span>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-violet-600/30 border border-violet-500/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-violet-300" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm space-y-2.5 ${
                    msg.sender === 'user'
                      ? 'bg-violet-600 text-white rounded-br-none ml-auto'
                      : 'bg-[#1A1040]/90 text-slate-200 border border-violet-800/40 rounded-tl-none'
                  }`}
                >
                  {/* Markdown / Rich Content */}
                  <CopilotMessageContent content={msg.content} isUser={msg.sender === 'user'} />

                  {/* Executed Tools Breakdown */}
                  {msg.tools_executed && msg.tools_executed.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-700/50">
                      <button
                        onClick={() => toggleTools(idx)}
                        className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-violet-300 transition-colors cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-violet-400" />
                        <span>
                          {msg.tools_executed.length} Tool{msg.tools_executed.length > 1 ? 's' : ''} Executed
                        </span>
                        {expandedTools[idx] ? (
                          <ChevronUp className="w-3 h-3 ml-auto" />
                        ) : (
                          <ChevronDown className="w-3 h-3 ml-auto" />
                        )}
                      </button>

                      {expandedTools[idx] && (
                        <div className="mt-2 space-y-1 bg-[#0B0520]/60 rounded-lg p-2 border border-violet-800/30">
                          {msg.tools_executed.map((tool, tIdx) => (
                            <div
                              key={tIdx}
                              className="flex items-center justify-between text-[10px] text-slate-300"
                            >
                              <span className="font-mono text-violet-400">{tool.tool_name}</span>
                              <span className="text-emerald-400 font-semibold">{tool.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pending Write Action Confirmation Card */}
                  {msg.pending_confirmation && (
                    <div className="mt-2 p-3 bg-gradient-to-br from-amber-950/40 to-slate-900/80 border border-amber-500/40 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{msg.pending_confirmation.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-normal">
                        {msg.pending_confirmation.description}
                      </p>

                      {msg.confirmation_status === 'pending' ? (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleConfirmAction(msg.pending_confirmation!, true)}
                            disabled={confirmLoading[msg.pending_confirmation.action_id]}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {confirmLoading[msg.pending_confirmation.action_id] ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Approve & Execute</span>
                          </button>
                          <button
                            onClick={() => handleConfirmAction(msg.pending_confirmation!, false)}
                            disabled={confirmLoading[msg.pending_confirmation.action_id]}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium pt-1">
                          {msg.confirmation_status === 'approved' ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approved and Committed
                            </span>
                          ) : (
                            <span className="text-rose-400 flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Action Cancelled
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Data Reference Chips */}
                  {msg.data_references && msg.data_references.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-700/50 flex flex-wrap gap-1.5">
                      {msg.data_references.map((ref, rIdx) => (
                          <button
                            key={rIdx}
                            onClick={() => ref.url && navigate(ref.url)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-violet-900/40 hover:bg-violet-700/50 text-violet-300 hover:text-white rounded-lg text-[11px] border border-violet-700/40 transition-colors cursor-pointer"
                        >
                          <span className="font-medium truncate max-w-[160px]">{ref.title}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Suggested Followups */}
                  {msg.suggested_followups && msg.suggested_followups.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {msg.suggested_followups.map((fol, fIdx) => (
                        <button
                          key={fIdx}
                          onClick={() => handleSendMessage(fol)}
                          className="flex items-center gap-1 px-2 py-0.5 bg-slate-900/70 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full text-[10px] border border-slate-700/70 transition-colors cursor-pointer"
                        >
                          <span>{fol}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-violet-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-center text-slate-400 text-xs py-2">
                <div className="w-7 h-7 rounded-lg bg-violet-600/30 border border-violet-500/40 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-violet-300" />
                </div>
                <div className="flex items-center gap-2 bg-[#1A1040]/80 px-3.5 py-2 rounded-2xl border border-violet-800/40 text-slate-300">
                  <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                  <span>ELLY is analyzing across modules...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Contextual Suggestions (Shown when messages are few) */}
          {suggestions.length > 0 && messages.length <= 2 && (
            <div className="px-4 py-2 bg-[#0F0A24]/80 border-t border-violet-900/40 overflow-x-auto flex gap-1.5 scrollbar-thin">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(s.prompt)}
                  className="shrink-0 px-2.5 py-1 bg-[#1A1040] hover:bg-violet-900/40 text-slate-300 hover:text-violet-200 border border-violet-800/40 hover:border-violet-500/40 rounded-lg text-[11px] transition-all cursor-pointer text-left"
                >
                  <div className="font-medium truncate">{s.prompt}</div>
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div className="p-3 bg-[#0F0A24]/90 border-t border-violet-900/40">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask ELLY to research, draft email, recommend decks, schedule meetings..."
                className="flex-1 bg-[#1A1040]/90 text-slate-100 placeholder-slate-500 px-3.5 py-2 rounded-xl text-xs border border-violet-800/40 focus:outline-none focus:border-violet-500/80 focus:ring-1 focus:ring-violet-500/40"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || loading}
                className="p-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl shadow transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
