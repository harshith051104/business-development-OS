import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { connectionsService } from '../../services/connections'
import type { KanbanBoard, KanbanCard } from '../../types/opportunity'
import PriorityBadge from '../../components/organizations/PriorityBadge'
import {
  GitFork,
  Search,
  Building2,
  User,
  Clock3,
  Target,
  RotateCw,
  AlertCircle,
  GripVertical,
  CheckCircle2,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react'

const PIPELINE_STAGES = [
  'Potential',
  'Contacted',
  'Connected',
  'Interested',
  'Meeting',
  'Discussion',
  'Partnership',
]

export const ConnectionsBoardPage: React.FC = () => {
  const [board, setBoard] = useState<KanbanBoard | null>(null)
  const [search, setSearch] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('All')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Drag & Drop State
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Quick move modal state (if triggered manually from dropdown or note prompt)
  const [movingCard, setMovingCard] = useState<KanbanCard | null>(null)
  const [targetStage, setTargetStage] = useState<string>('')
  const [moveNote, setMoveNote] = useState<string>('')
  const [isMoving, setIsMoving] = useState<boolean>(false)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  const handleAutoSync = async () => {
    setIsSyncing(true)
    try {
      const res = await connectionsService.autoSync()
      setNotification({
        message: res.message || `Pipeline synchronized. ${res.updated_count} organization(s) progressed.`,
        type: 'success',
      })
      await fetchPipeline()
    } catch (err: any) {
      setNotification({
        message: err.message || 'Failed to auto-sync pipeline.',
        type: 'error',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const fetchPipeline = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await connectionsService.getKanbanPipeline({
        search: search.trim() || undefined,
        priority: priorityFilter !== 'All' ? priorityFilter : undefined,
      })
      setBoard(data)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load connections pipeline.')
    } finally {
      setLoading(false)
    }
  }, [search, priorityFilter])

  useEffect(() => {
    fetchPipeline()
  }, [fetchPipeline])

  // Toast notification auto-dismiss
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, card: KanbanCard) => {
    setDraggedCard(card)
    e.dataTransfer.setData('text/plain', JSON.stringify(card))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedCard(null)
    setDragOverStage(null)
  }

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverStage !== stage) {
      setDragOverStage(stage)
    }
  }

  const handleDragLeave = (e: React.DragEvent, stage: string) => {
    // Only clear if leaving the main column container
    const relatedTarget = e.relatedTarget as HTMLElement | null
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      if (dragOverStage === stage) {
        setDragOverStage(null)
      }
    }
  }

  const executeStageMove = async (card: KanbanCard, nextStage: string, note?: string) => {
    if (card.status === nextStage) return

    // Optimistic UI Update: immediately shift the card in state
    if (board) {
      const previousBoard = { ...board }
      const updatedColumns = board.columns.map((col) => {
        if (col.stage === card.status) {
          return {
            ...col,
            count: Math.max(0, col.count - 1),
            organizations: col.organizations.filter((o) => o.organization_id !== card.organization_id),
          }
        }
        if (col.stage === nextStage) {
          const updatedCard: KanbanCard = { ...card, status: nextStage }
          return {
            ...col,
            count: col.count + 1,
            organizations: [updatedCard, ...col.organizations],
          }
        }
        return col
      })

      setBoard({
        ...board,
        columns: updatedColumns,
      })

      try {
        await connectionsService.moveStage(
          card.organization_id,
          nextStage,
          note || `Moved via Kanban board to ${nextStage}`
        )
        setNotification({
          message: `Moved "${card.organization_name}" to ${nextStage}`,
          type: 'success',
        })
      } catch (err: any) {
        // Rollback to previous board state on error
        setBoard(previousBoard)
        setNotification({
          message: err.detail || err.message || `Failed to move ${card.organization_name}`,
          type: 'error',
        })
      }
    }
  }

  const handleDrop = async (e: React.DragEvent, targetStageName: string) => {
    e.preventDefault()
    setDragOverStage(null)
    if (!draggedCard) return

    if (draggedCard.status === targetStageName) {
      setDraggedCard(null)
      return
    }

    const cardToMove = draggedCard
    setDraggedCard(null)
    await executeStageMove(cardToMove, targetStageName)
  }

  const handleQuickSelectMove = (card: KanbanCard, nextStg: string) => {
    if (card.status === nextStg) return
    setMovingCard(card)
    setTargetStage(nextStg)
    setMoveNote('')
  }

  const confirmModalMove = async () => {
    if (!movingCard || !targetStage) return
    setIsMoving(true)
    try {
      await executeStageMove(movingCard, targetStage, moveNote.trim() || undefined)
      setMovingCard(null)
    } finally {
      setIsMoving(false)
    }
  }

  const getStageColor = (stg: string) => {
    switch (stg) {
      case 'Potential':
        return 'text-slate-400 border-slate-700 bg-slate-800/40'
      case 'Contacted':
        return 'text-blue-400 border-blue-500/30 bg-blue-500/10'
      case 'Connected':
        return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
      case 'Interested':
        return 'text-violet-400 border-violet-500/30 bg-violet-500/10'
      case 'Meeting':
        return 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      case 'Discussion':
        return 'text-orange-400 border-orange-500/30 bg-orange-500/10'
      case 'Partnership':
        return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      default:
        return 'text-slate-400 border-slate-700 bg-slate-800/40'
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Subheader Bar ── */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Connection Pipeline Board
              </h1>
              {board && (
                <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-xs font-mono border border-violet-500/20">
                  {board.total_organizations} Organizations in Funnel
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>Drag & drop cards across stages or select from dropdown</span>
              <span className="text-slate-600">·</span>
              <span className="text-violet-400 font-medium">Auto-synced</span>
            </p>
          </div>
        </div>

        {/* Search & Priority Controls */}
        <div className="flex items-center space-x-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizations..."
              className="w-full bg-[#1A1040] border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
          >
            <option value="All">All Priorities</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>

          <button
            type="button"
            onClick={handleAutoSync}
            disabled={isSyncing || loading}
            className="px-3.5 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 hover:text-white text-xs font-semibold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50 shrink-0"
            title="Scan outreach emails, replies, meetings, and opportunities to auto-progress pipeline stages"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-violet-400' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Auto-Sync Funnel'}</span>
          </button>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl border shadow-2xl flex items-center space-x-2.5 animate-in slide-in-from-bottom duration-200 ${
            notification.type === 'success'
              ? 'bg-[#110B2E] border-emerald-500/40 text-emerald-300'
              : 'bg-[#110B2E] border-rose-500/40 text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{notification.message}</span>
        </div>
      )}

      {/* ── Main Kanban Columns ── */}
      <main className="flex-1 p-6 overflow-x-auto">
        {loading ? (
          <div className="py-32 text-center space-y-3">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading relationship pipeline board...</p>
          </div>
        ) : error || !board ? (
          <div className="p-8 rounded-2xl bg-[#110B2E] border border-rose-500/20 text-center space-y-3 max-w-md mx-auto my-12">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Error Loading Pipeline</h3>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={fetchPipeline}
              className="px-4 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex gap-4 min-w-[1750px] items-start pb-8">
            {board.columns.map((col) => {
              const stageColor = getStageColor(col.stage)
              const isOver = dragOverStage === col.stage && draggedCard?.status !== col.stage

              return (
                <div
                  key={col.stage}
                  onDragOver={(e) => handleDragOver(e, col.stage)}
                  onDragLeave={(e) => handleDragLeave(e, col.stage)}
                  onDrop={(e) => handleDrop(e, col.stage)}
                  className={`w-[245px] shrink-0 rounded-2xl bg-[#110B2E] border transition-all duration-150 flex flex-col max-h-[calc(100vh-210px)] shadow-xl ${
                    isOver
                      ? 'border-violet-500 ring-2 ring-violet-500/40 bg-[#140E2C] shadow-violet-500/10 scale-[1.01]'
                      : 'border-slate-800/90'
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-current opacity-80" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                        {col.stage}
                      </h2>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${stageColor}`}
                    >
                      {col.count}
                    </span>
                  </div>

                  {/* Cards Scroll Container */}
                  <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Drop Target Visual Cue when Dragging Over */}
                    {isOver && (
                      <div className="p-3 rounded-xl border-2 border-dashed border-violet-400/60 bg-violet-500/10 text-center text-xs font-semibold text-violet-300 animate-pulse">
                        Drop to move into {col.stage}
                      </div>
                    )}

                    {col.organizations.length === 0 && !isOver ? (
                      <div className="py-10 text-center text-[11px] text-slate-500 italic">
                        No organizations in {col.stage}
                      </div>
                    ) : (
                      col.organizations.map((org) => {
                        const isBeingDragged = draggedCard?.organization_id === org.organization_id

                        return (
                          <div
                            key={org.organization_id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, org)}
                            onDragEnd={handleDragEnd}
                            className={`p-3.5 rounded-xl bg-[#1A1040] border border-slate-800/90 hover:border-violet-500/40 transition-all space-y-2.5 group shadow-md cursor-grab active:cursor-grabbing select-none ${
                              isBeingDragged
                                ? 'opacity-30 scale-95 border-violet-500 ring-2 ring-violet-500/50'
                                : 'hover:scale-[1.01]'
                            }`}
                          >
                            {/* Top Row: Name, Grip & Priority */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start space-x-1.5 min-w-0">
                                <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0 mt-0.5 transition" />
                                <Link
                                  to={`/business-development/organizations/${org.organization_id}`}
                                  className="text-xs font-bold text-white hover:text-violet-300 transition line-clamp-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {org.organization_name}
                                </Link>
                              </div>
                              <PriorityBadge priority={org.priority} size="sm" />
                            </div>

                            {/* Details: Type & City */}
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate pl-5">
                              <span className="truncate">{org.organization_type}</span>
                              {org.city && (
                                <>
                                  <span>·</span>
                                  <span className="truncate text-slate-500">{org.city}</span>
                                </>
                              )}
                            </div>

                            {/* Primary Contact */}
                            {org.primary_contact_name && (
                              <div className="p-2 rounded-lg bg-[#110B2E] border border-slate-800/80 text-[11px] space-y-0.5">
                                <div className="flex items-center space-x-1 text-teal-300 font-semibold truncate">
                                  <User className="w-3 h-3 text-teal-500 shrink-0" />
                                  <span className="truncate">{org.primary_contact_name}</span>
                                </div>
                                {org.primary_contact_designation && (
                                  <div className="text-[10px] text-slate-500 truncate pl-4">
                                    {org.primary_contact_designation}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Opportunities Indicator */}
                            {org.active_opportunities_count > 0 && (
                              <div className="flex items-center space-x-1 text-[10px] font-mono text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20">
                                <Target className="w-3 h-3 text-violet-400" />
                                <span>{org.active_opportunities_count} Active Opps</span>
                              </div>
                            )}

                            {/* Next Follow-up */}
                            {org.next_followup_title && (
                              <div className="text-[10px] text-amber-300/90 flex items-center space-x-1 font-mono pt-1 border-t border-slate-800/60 truncate">
                                <Clock3 className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="truncate">{org.next_followup_title}</span>
                              </div>
                            )}

                            {/* Quick Stage Mover Dropdown (Accessible Fallback) */}
                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                              <select
                                value={org.status}
                                onChange={(e) => handleQuickSelectMove(org, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-[#110B2E] border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-violet-500"
                              >
                                {PIPELINE_STAGES.map((stg) => (
                                  <option key={stg} value={stg}>
                                    → {stg}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Move Confirmation Modal (For dropdown selector or custom note entry) */}
      {movingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Update Pipeline Stage</h3>
            <p className="text-xs text-slate-300">
              Move <span className="font-bold text-white">"{movingCard.organization_name}"</span>{' '}
              from <span className="text-slate-400 font-mono">{movingCard.status}</span> to{' '}
              <span className="text-violet-400 font-bold font-mono">{targetStage}</span>?
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Reason / Activity Note (Optional)
              </label>
              <textarea
                rows={3}
                value={moveNote}
                onChange={(e) => setMoveNote(e.target.value)}
                placeholder="e.g. Moved card after client update meeting..."
                className="w-full bg-[#1A1040] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2.5">
              <button
                onClick={() => setMovingCard(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmModalMove}
                disabled={isMoving}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30 disabled:opacity-50 flex items-center space-x-1.5"
              >
                {isMoving ? 'Moving...' : 'Confirm Move'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default ConnectionsBoardPage
