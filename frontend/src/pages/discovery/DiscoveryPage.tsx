import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { discoveryService } from '../../services/discovery'
import type {
  DiscoveredOrganization,
  DiscoveryStats,
  DiscoveryHistoryItem,
  ProviderList,
} from '../../types/discovery'
import DiscoveryCard from '../../components/discovery/DiscoveryCard'
import CsvImportModal from '../../components/discovery/CsvImportModal'
import OrgMap from '../../components/map/OrgMap'
import {
  Compass,
  Search,
  MapPin,
  Building2,
  Bookmark,
  History,
  FileSpreadsheet,
  RotateCw,
  Plus,
  AlertCircle,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  Target,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Users,
} from 'lucide-react'

const ORG_TYPES = [
  'All',
  'SaaS Company',
  'Software Company',
  'Technology Company',
  'AI Company',
  'Fintech Company',
  'Financial Services',
  'Healthcare Company',
  'Company',
  'Company Group',
  'Healthcare Technology Company',
  'Manufacturing',
  'Industrial',
  'Energy',
  'Logistics',
  'Retail',
  'E-commerce',
  'Consulting',
  'Insurance Company',
  'NGO',
  'Other',
]

const PARTNERSHIP_OBJECTIVES = [
  'Technology partnership',
  'Digital transformation partnership',
  'Strategic partnership',
  'Platform integration partnership',
  'Product showcase / business discussion',
  'Integration partnership',
  'Market expansion partnership',
]

export const DiscoveryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'saved' | 'history'>('search')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

  // OpenOutreach 3-tier Discovery Form State
  const [productDescription, setProductDescription] = useState<string>(
    'Our company has built a technology platform that helps organizations improve digital workflows and operational efficiency.'
  )
  const [targetIcp, setTargetIcp] = useState<string>(
    'Enterprise organizations interested in technology partnerships, digital transformation, and platform integration.'
  )
  const [discoveryObjective, setDiscoveryObjective] = useState<string>(
    'Find potential technology and platform partners.'
  )

  // Secondary search filters
  const [keyword, setKeyword] = useState<string>('')
  const [location, setLocation] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('All')
  const [selectedProvider, setSelectedProvider] = useState<string>('Multi-Source Discovery (Recommended)')
  const [pageSize, setPageSize] = useState<number>(12)
  const [page, setPage] = useState<number>(1)

  // Results & stats
  const [items, setItems] = useState<DiscoveredOrganization[]>([])
  const [totalItems, setTotalItems] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [stats, setStats] = useState<DiscoveryStats | null>(null)
  const [historyItems, setHistoryItems] = useState<DiscoveryHistoryItem[]>([])
  const [providers, setProviders] = useState<ProviderList | null>(null)

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false)

  // Add to ELLY modal state
  const [addingOrg, setAddingOrg] = useState<DiscoveredOrganization | null>(null)
  const [addPriority, setAddPriority] = useState<string>('High')
  const [addNotes, setAddNotes] = useState<string>('')
  const [allowDup, setAllowDup] = useState<boolean>(false)
  const [isAdding, setIsAdding] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Fetch summary stats & providers on mount
  useEffect(() => {
    discoveryService.getStats().then(setStats).catch(() => {})
    discoveryService.getProviders().then(setProviders).catch(() => {})
  }, [])

  // Auto dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toastMessage])

  // Execute search / discovery
  const executeSearch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (activeTab === 'search') {
        const res = await discoveryService.search({
          keyword: keyword.trim() || undefined,
          location: location.trim() || undefined,
          organization_type: selectedType !== 'All' ? selectedType : undefined,
          product_description: productDescription.trim() || undefined,
          target_icp: targetIcp.trim() || undefined,
          discovery_objective: discoveryObjective.trim() || undefined,
          provider: selectedProvider,
          page,
          page_size: pageSize,
        })
        setItems(res.items)
        setTotalItems(res.total)
        setTotalPages(res.total_pages)
      } else if (activeTab === 'saved') {
        const res = await discoveryService.getSaved({ page, page_size: pageSize })
        setItems(res.items)
        setTotalItems(res.total)
        setTotalPages(res.total_pages)
      } else if (activeTab === 'history') {
        const h = await discoveryService.getHistory(25)
        setHistoryItems(h)
      }
    } catch (err: any) {
      setError(err.detail || err.message || 'Discovery search failed.')
    } finally {
      setLoading(false)
    }
  }, [activeTab, keyword, location, selectedType, productDescription, targetIcp, discoveryObjective, selectedProvider, page, pageSize])

  useEffect(() => {
    executeSearch()
  }, [executeSearch])

  // Save / Bookmark action
  const handleSave = async (id: number) => {
    try {
      await discoveryService.save(id)
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'saved' } : item))
      )
      setToastMessage('Lead saved to bookmarks.')
      discoveryService.getStats().then(setStats)
    } catch (e: any) {
      alert(e.message || 'Failed to save discovery.')
    }
  }

  // Skip action
  const handleSkip = async (id: number) => {
    try {
      await discoveryService.skip(id)
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'skipped' } : item))
      )
      setToastMessage('Lead dismissed.')
      discoveryService.getStats().then(setStats)
    } catch (e: any) {
      alert(e.message || 'Failed to skip discovery.')
    }
  }

  // Open Add modal
  const handleOpenAdd = (item: DiscoveredOrganization) => {
    setAddingOrg(item)
    setAddPriority(item.potential_fit === 'High' ? 'High' : 'Medium')
    setAddNotes(`Sourced via AI Discovery (${item.source_name}). Fit Reason: ${item.qualification_reason || ''}`)
    setAllowDup(false)
  }

  // Confirm Add to ELLY CRM
  const handleConfirmAdd = async () => {
    if (!addingOrg) return
    setIsAdding(true)
    try {
      await discoveryService.addToOrganizations(addingOrg.id, {
        priority: addPriority,
        notes: addNotes,
        allow_duplicate: allowDup,
      })
      setItems((prev) =>
        prev.map((item) =>
          item.id === addingOrg.id ? { ...item, status: 'added' } : item
        )
      )
      setToastMessage(`"${addingOrg.name}" added to ELLY Connection Pipeline.`)
      setAddingOrg(null)
      discoveryService.getStats().then(setStats)
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to add organization.')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Subheader Bar ── */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E] relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-bold text-white tracking-tight">
                AI Organization Discovery Studio
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-xs font-mono border border-violet-500/20">
                OpenOutreach B2B Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Discover and qualify organizations, decision-makers, and technology partners across all industries
            </p>
          </div>
        </div>

        {/* Quick Actions & Stats Header */}
        <div className="flex flex-wrap items-center gap-3">
          {stats && (
            <div className="hidden lg:flex items-center space-x-4 px-3 py-1.5 rounded-xl bg-[#1A1040] border border-slate-800 text-xs text-slate-300">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span>{stats.total_discovered} Discovered</span>
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{stats.total_added} in CRM</span>
              </div>
              {stats.conversion_rate !== null && (
                <>
                  <span className="text-slate-600">|</span>
                  <div className="flex items-center space-x-1.5 text-violet-300 font-mono">
                    <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                    <span>{stats.conversion_rate}% Conv.</span>
                  </div>
                </>
              )}
            </div>
          )}

          <a
            href={discoveryService.getExportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import CSV</span>
          </button>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-[#110B2E] border border-emerald-500/40 text-emerald-300 shadow-2xl flex items-center space-x-2.5 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-3">
          <button
            onClick={() => {
              setActiveTab('search')
              setPage(1)
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'search'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#1A1040]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Discovery Search</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('saved')
              setPage(1)
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'saved'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#1A1040]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Bookmarks</span>
            {stats && stats.total_saved > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-mono">
                {stats.total_saved}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('history')
              setPage(1)
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'history'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#1A1040]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Search & Objective History</span>
          </button>
        </div>

        {/* ── OpenOutreach 3-tier Discovery Form ── */}
        {activeTab === 'search' && (
          <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800/90 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Discovery Parameters & Context
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                AI evaluates these criteria to generate explainable fit reasoning
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Product Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 text-[10px] flex items-center justify-center font-mono">
                    1
                  </span>
                  <span>What does your project provide?</span>
                </label>
                <textarea
                  rows={3}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="e.g. AI-powered platform that improves digital workflows..."
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                />
              </div>

              {/* 2. Target ICP */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 text-[10px] flex items-center justify-center font-mono">
                    2
                  </span>
                  <span>Who are you looking for? (ICP)</span>
                </label>
                <textarea
                  rows={3}
                  value={targetIcp}
                  onChange={(e) => setTargetIcp(e.target.value)}
                  placeholder="e.g. Enterprise companies in India interested in digital transformation..."
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                />
              </div>

              {/* 3. Discovery Objective */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 text-[10px] flex items-center justify-center font-mono">
                    3
                  </span>
                  <span>What is the discovery objective?</span>
                </label>
                <select
                  value={discoveryObjective}
                  onChange={(e) => setDiscoveryObjective(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition mb-2"
                >
                  {PARTNERSHIP_OBJECTIVES.map((obj) => (
                    <option key={obj} value={`Find organizations for ${obj.toLowerCase()}`}>
                      {obj}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={discoveryObjective}
                  onChange={(e) => setDiscoveryObjective(e.target.value)}
                  placeholder="Or enter custom objective..."
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                />
              </div>
            </div>

            {/* Secondary Search Filters Row */}
            <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Keyword / Name</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full bg-[#1A1040] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Location / City</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Hyderabad, USA, London, Singapore"
                    className="w-full bg-[#1A1040] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Organization Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  {ORG_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setPage(1)
                    executeSearch()
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {loading ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Start Discovery</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Results Header / Counter ── */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">
              {activeTab === 'search'
                ? `Discovered Leads (${totalItems})`
                : activeTab === 'saved'
                ? `Saved Leads (${totalItems})`
                : `Discovery History`}
            </h3>
            <p className="text-xs text-slate-400">
              {activeTab === 'search'
                ? 'Review AI qualification and discover executive decision-makers before adding to CRM'
                : activeTab === 'saved'
                ? 'Bookmarked leads awaiting BD outreach preparation'
                : 'Recent B2B discovery search queries and prompt executions'}
            </p>
          </div>
        </div>

        {/* ── Content Views ── */}
        {loading ? (
          <div className="py-24 text-center space-y-3 bg-[#110B2E] rounded-2xl border border-slate-800">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Running AI qualification and provider matching...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-[#110B2E] border border-rose-500/20 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Discovery Query Error</h4>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={executeSearch}
              className="px-4 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : activeTab === 'history' ? (
          /* History View */
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="divide-y divide-slate-800/80">
              {historyItems.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 italic">
                  No discovery search history recorded yet.
                </div>
              ) : (
                historyItems.map((h) => (
                  <div key={h.id} className="p-4 hover:bg-[#1A1040] transition flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Data Source</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  {providers?.organization_providers?.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  )) || (
                    <option value="Multi-Source Discovery (Recommended)">Multi-Source Discovery (Recommended)</option>
                  )}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">
                          {h.query_keyword || 'All Organizations'}
                        </span>
                        {h.organization_type && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300 font-mono">
                            {h.organization_type}
                          </span>
                        )}
                        {h.location && (
                          <span className="text-[11px] text-slate-400">· {h.location}</span>
                        )}
                      </div>
                      {h.discovery_objective && (
                        <p className="text-xs text-slate-400 font-mono line-clamp-1">
                          Goal: {h.discovery_objective}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-slate-400">
                      <span className="font-mono text-violet-300">{h.results_count} results</span>
                      <span>{new Date(h.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Cards Grid View */
          <>
            {/* List/Map toggle */}
            {items.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-slate-400">
                  <span className="font-mono text-white">{totalItems}</span> organizations found
                </span>
                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      viewMode === 'list'
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 inline mr-1" />
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      viewMode === 'map'
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 inline mr-1" />
                    Map
                  </button>
                </div>
              </div>
            )}

            {viewMode === 'map' ? (
              <OrgMap showFilters={false} height="500px" />
            ) : (
              <>
                {items.length === 0 ? (
              <div className="p-16 text-center space-y-3 bg-[#110B2E] rounded-2xl border border-slate-800">
                <Compass className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-white">No Organizations Found</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Try adjusting your location, organization type filter, or broadening your target ICP query.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((item) => (
                  <DiscoveryCard
                    key={item.id}
                    item={item}
                    onSave={handleSave}
                    onSkip={handleSkip}
                    onAdd={handleOpenAdd}
                  />
                ))}
              </div>
            )}

            {/* Pagination Controls (list view only) */}
            {viewMode === 'list' && totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                <span className="text-xs text-slate-400">
                  Showing page <span className="font-mono text-white">{page}</span> of{' '}
                  <span className="font-mono text-white">{totalPages}</span>
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-xl bg-[#1A1040] border border-slate-800 text-slate-300 disabled:opacity-40 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-xl bg-[#1A1040] border border-slate-800 text-slate-300 disabled:opacity-40 hover:text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            </>
            )}
          </>
        )}
      </main>

      {/* ── Add to ELLY CRM Modal ── */}
      {addingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white">Add Organization to ELLY CRM</h3>
              <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-[10px] font-mono border border-violet-500/20">
                Connection Stage: Potential
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#1A1040] border border-slate-800 space-y-1">
                <div className="font-bold text-white">{addingOrg.name}</div>
                <div className="text-slate-400">{addingOrg.organization_type} · {addingOrg.city || addingOrg.country}</div>
                {addingOrg.qualification_reason && (
                  <div className="text-slate-300 pt-1 text-[11px] border-t border-slate-800/60 mt-1">
                    <span className="text-violet-400 font-bold">Fit Reason: </span>
                    {addingOrg.qualification_reason}
                  </div>
                )}
              </div>

              {addingOrg.is_existing_duplicate && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1.5">
                  <div className="font-bold flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Possible Existing Organization Detected</span>
                  </div>
                  <p className="text-[11px]">
                    An organization with a matching name or domain already exists in ELLY.
                  </p>
                  <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowDup}
                      onChange={(e) => setAllowDup(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-0"
                    />
                    <span className="text-slate-200 text-[11px]">Create anyway (allow duplicate)</span>
                  </label>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Initial BD Priority</label>
                <select
                  value={addPriority}
                  onChange={(e) => setAddPriority(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Internal Sourcing Notes</label>
                <textarea
                  rows={2}
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full bg-[#1A1040] border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end space-x-2.5">
              <button
                onClick={() => setAddingOrg(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdd}
                disabled={isAdding}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30 disabled:opacity-50 flex items-center space-x-1.5"
              >
                {isAdding ? 'Adding...' : 'Confirm & Add to ELLY'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <CsvImportModal
          isOpen={isCsvModalOpen}
          onClose={() => setIsCsvModalOpen(false)}
          onSuccess={() => {
            setIsCsvModalOpen(false)
            executeSearch()
            discoveryService.getStats().then(setStats)
          }}
        />
      )}
    </div>
  )
}
export default DiscoveryPage
