import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { discoveryService } from '../../services/discovery'
import type {
  DiscoveredOrganization,
  DiscoveryStats,
  DiscoveryHistoryItem,
  ProviderList,
  DiscoveryPromptParseOut,
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
  const [searchNotices, setSearchNotices] = useState<string[]>([])
  // null = unknown (health check failed); false = no live web search key configured
  const [webSearchConfigured, setWebSearchConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    discoveryService
      .getProviderHealth()
      .then((h) => setWebSearchConfigured(Boolean(h.Tavily?.configured || h.Serper?.configured)))
      .catch(() => setWebSearchConfigured(null))
  }, [])

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false)

  // Single Prompt Natural Language Discovery State
  const [singlePrompt, setSinglePrompt] = useState<string>('')
  const [isParsingPrompt, setIsParsingPrompt] = useState<boolean>(false)
  const [showAdvancedParams, setShowAdvancedParams] = useState<boolean>(false)
  const [lastParsedInfo, setLastParsedInfo] = useState<DiscoveryPromptParseOut | null>(null)

  // Search History Results Modal State
  const [selectedHistory, setSelectedHistory] = useState<DiscoveryHistoryItem | null>(null)
  const [historyResults, setHistoryResults] = useState<DiscoveredOrganization[]>([])
  const [historyResultsLoading, setHistoryResultsLoading] = useState<boolean>(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false)

  // Add to ELLY modal state
  const [addingOrg, setAddingOrg] = useState<DiscoveredOrganization | null>(null)
  const [addPriority, setAddPriority] = useState<string>('High')
  const [addNotes, setAddNotes] = useState<string>('')
  const [allowDup, setAllowDup] = useState<boolean>(false)
  const [isAdding, setIsAdding] = useState<boolean>(false)
  const [addContactIds, setAddContactIds] = useState<number[]>([])
  const [addError, setAddError] = useState<{ status?: number; message: string } | null>(null)
  const [addedOrg, setAddedOrg] = useState<{ id: number; name: string } | null>(null)
  const addInFlight = useRef<boolean>(false)
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

  // Single Prompt Discovery Handler
  const handlePromptDiscovery = async (customPrompt?: string) => {
    const promptToUse = (customPrompt || singlePrompt).trim()
    if (!promptToUse) return
    setIsParsingPrompt(true)
    setError(null)
    try {
      const parsed = await discoveryService.parsePrompt(promptToUse)
      setLastParsedInfo(parsed)
      if (parsed.keyword) setKeyword(parsed.keyword)
      if (parsed.location) setLocation(parsed.location)
      if (parsed.organization_type) setSelectedType(parsed.organization_type)
      if (parsed.product_description) setProductDescription(parsed.product_description)
      if (parsed.target_icp) setTargetIcp(parsed.target_icp)
      if (parsed.discovery_objective) setDiscoveryObjective(parsed.discovery_objective)

      setLoading(true)
      const res = await discoveryService.search({
        keyword: parsed.keyword || undefined,
        location: parsed.location || undefined,
        organization_type: (parsed.organization_type && parsed.organization_type !== 'All') ? parsed.organization_type : undefined,
        product_description: parsed.product_description || undefined,
        target_icp: parsed.target_icp || undefined,
        discovery_objective: parsed.discovery_objective || undefined,
        provider: selectedProvider,
        page: 1,
        page_size: pageSize,
      })
      setItems(res.items)
      setSearchNotices(res.notices || [])
      setTotalItems(res.total)
      setTotalPages(res.total_pages)
      setPage(1)
      setToastMessage(`LLM understood query! Discovered ${res.total} organization(s).`)
      discoveryService.getStats().then(setStats)
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to parse prompt and discover leads.')
    } finally {
      setIsParsingPrompt(false)
      setLoading(false)
    }
  }

  // Load history item results
  const handleViewHistoryResults = async (h: DiscoveryHistoryItem) => {
    setSelectedHistory(h)
    setIsHistoryModalOpen(true)
    setHistoryResultsLoading(true)
    try {
      const res = await discoveryService.getHistoryResults(h.id, { page: 1, page_size: 50 })
      setHistoryResults(res.items)
    } catch (err: any) {
      alert(err.message || 'Failed to load past discovery results.')
    } finally {
      setHistoryResultsLoading(false)
    }
  }

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
        setSearchNotices(res.notices || [])
        setTotalItems(res.total)
        setTotalPages(res.total_pages)
      } else if (activeTab === 'saved') {
        const res = await discoveryService.getSaved({ page, page_size: pageSize })
        setItems(res.items)
        setSearchNotices([])
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
    // Every source-backed contact starts selected; people without a cited source cannot be imported.
    setAddContactIds((item.contacts || []).filter((c) => !!c.source_url).map((c) => c.id))
    setAddError(null)
    setAddedOrg(null)
  }

  const handleCloseAdd = () => {
    if (addInFlight.current) return
    setAddingOrg(null)
    setAddError(null)
    setAddedOrg(null)
  }

  // Confirm Add to ELLY CRM
  const handleConfirmAdd = async () => {
    // Ref guard: a fast double click can fire before isAdding re-renders.
    if (!addingOrg || addInFlight.current) return
    addInFlight.current = true
    setIsAdding(true)
    setAddError(null)
    try {
      const created = await discoveryService.addToOrganizations(addingOrg.id, {
        priority: addPriority,
        notes: addNotes,
        allow_duplicate: allowDup,
        selected_contact_ids: addContactIds,
      })
      const markAdded = (item: DiscoveredOrganization) =>
        item.id === addingOrg.id ? { ...item, status: 'added' as const, organization_id: created.id } : item
      setItems((prev) => prev.map(markAdded))
      setHistoryResults((prev) => prev.map(markAdded))
      setAddedOrg({ id: created.id, name: created.name })
      setToastMessage(`"${created.name}" added to ELLY Connection Pipeline.`)
      discoveryService.getStats().then(setStats).catch(() => {})
    } catch (err: any) {
      setAddError({
        status: err?.status,
        message: err?.detail || err?.message || 'Failed to add organization.',
      })
    } finally {
      addInFlight.current = false
      setIsAdding(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0E0B1D] text-[#C9C2E3] flex flex-col md:pl-64">
      <Navbar />

      {/* ── Subheader Bar ── */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#0E0B1D] relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <div className="hidden lg:flex items-center space-x-4 px-3 py-1.5 rounded-xl bg-[#2A1E4D] border border-slate-800 text-xs text-slate-300">
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
            className="px-3 py-1.5 rounded-xl bg-[#2A1E4D] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[#2A1E4D] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import CSV</span>
          </button>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-[#0E0B1D] border border-emerald-500/40 text-emerald-300 shadow-2xl flex items-center space-x-2.5 animate-in slide-in-from-bottom duration-200">
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
                : 'text-slate-400 hover:text-white hover:bg-[#2A1E4D]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Discovery Search</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('history')
              setPage(1)
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'history'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#2A1E4D]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Search & Objective History</span>
          </button>
        </div>

        {/* ── Single-Prompt Natural Language Lead Discovery & Context ── */}
        {activeTab === 'search' && (
          <div className="p-6 rounded-2xl bg-[#0E0B1D] border border-slate-800/90 shadow-xl space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-3 gap-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-violet-600/20 text-violet-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    AI Lead Discovery Assistant
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Just describe who you want to reach in plain English — the LLM extracts parameters and discovers leads automatically
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedParams((prev) => !prev)}
                className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center space-x-1 self-start sm:self-auto"
              >
                <span>{showAdvancedParams ? 'Hide Details' : 'Detailed Parameters'}</span>
                <span>{showAdvancedParams ? '▲' : '▼'}</span>
              </button>
            </div>

            {/* Single Prompt Input Bar */}
            <div className="space-y-3">
              <div className="relative flex flex-col sm:flex-row items-stretch gap-2">
                <div className="relative flex-1">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-violet-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={singlePrompt}
                    onChange={(e) => setSinglePrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isParsingPrompt && !loading) {
                        handlePromptDiscovery()
                      }
                    }}
                    placeholder="e.g. Find enterprise hospitals and diagnostic chains in Hyderabad and Bangalore for digital health partnerships..."
                    className="w-full bg-[#2A1E4D] border border-violet-500/40 focus:border-violet-400 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 shadow-inner transition"
                  />
                </div>
                <button
                  type="button"
                  disabled={!singlePrompt.trim() || isParsingPrompt || loading}
                  onClick={() => handlePromptDiscovery()}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition flex items-center justify-center space-x-2 disabled:opacity-50 shrink-0"
                >
                  {isParsingPrompt || loading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Discovering...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Discover Leads</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Prompt Ideas */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mr-1">
                  Try prompt:
                </span>
                {[
                  'Enterprise healthcare & hospitals in Hyderabad',
                  'High-growth Fintech SaaS in Singapore and India',
                  'AI & machine learning startups in Bangalore',
                  'Supply chain & logistics leaders in Mumbai',
                ].map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => {
                      setSinglePrompt(idea)
                      handlePromptDiscovery(idea)
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#2A1E4D] hover:bg-violet-900/40 text-[11px] text-slate-300 hover:text-white border border-slate-800 transition"
                  >
                    {idea}
                  </button>
                ))}
              </div>

              {/* LLM Inferred Context Badges */}
              {lastParsedInfo && (
                <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-500/20 text-xs space-y-1.5 animate-in fade-in">
                  <div className="text-[11px] font-bold text-violet-300 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />
                    <span>LLM Inferred Search Context:</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {lastParsedInfo.keyword && (
                      <span className="px-2 py-0.5 rounded-md bg-[#0E0B1D] border border-violet-500/30 text-slate-200">
                        🎯 <strong className="text-violet-300">Keyword:</strong> {lastParsedInfo.keyword}
                      </span>
                    )}
                    {lastParsedInfo.location && (
                      <span className="px-2 py-0.5 rounded-md bg-[#0E0B1D] border border-violet-500/30 text-slate-200">
                        📍 <strong className="text-violet-300">Location:</strong> {lastParsedInfo.location}
                      </span>
                    )}
                    {lastParsedInfo.organization_type && (
                      <span className="px-2 py-0.5 rounded-md bg-[#0E0B1D] border border-violet-500/30 text-slate-200">
                        🏢 <strong className="text-violet-300">Type:</strong> {lastParsedInfo.organization_type}
                      </span>
                    )}
                    {lastParsedInfo.discovery_objective && (
                      <span className="px-2 py-0.5 rounded-md bg-[#0E0B1D] border border-violet-500/30 text-slate-200">
                        💡 <strong className="text-violet-300">Objective:</strong> {lastParsedInfo.discovery_objective}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Optional Collapsible Advanced Parameters */}
            {showAdvancedParams && (
              <div className="pt-4 border-t border-slate-800/80 space-y-4 animate-in fade-in">
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
                      rows={2}
                      value={productDescription}
                      onChange={(e) => setProductDescription(e.target.value)}
                      placeholder="e.g. AI platform that improves digital workflows..."
                      className="w-full bg-[#2A1E4D] border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                    />
                  </div>

                  {/* 2. Target ICP */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                      <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 text-[10px] flex items-center justify-center font-mono">
                        2
                      </span>
                      <span>Target ICP</span>
                    </label>
                    <textarea
                      rows={2}
                      value={targetIcp}
                      onChange={(e) => setTargetIcp(e.target.value)}
                      placeholder="e.g. Enterprise companies interested in digital transformation..."
                      className="w-full bg-[#2A1E4D] border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                    />
                  </div>

                  {/* 3. Discovery Objective */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                      <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 text-[10px] flex items-center justify-center font-mono">
                        3
                      </span>
                      <span>Discovery Objective</span>
                    </label>
                    <input
                      type="text"
                      value={discoveryObjective}
                      onChange={(e) => setDiscoveryObjective(e.target.value)}
                      placeholder="Objective..."
                      className="w-full bg-[#2A1E4D] border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Secondary Search Filters Row (with Data Source properly placed) */}
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
                    className="w-full bg-[#2A1E4D] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
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
                    placeholder="e.g. Hyderabad, Singapore"
                    className="w-full bg-[#2A1E4D] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Organization Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-[#2A1E4D] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  {ORG_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Data Source</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full bg-[#2A1E4D] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  {providers?.organization_providers?.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  )) || (
                    <option value="Multi-Source Discovery (Recommended)">
                      Multi-Source Discovery (Recommended)
                    </option>
                  )}
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
                    <Filter className="w-3.5 h-3.5" />
                  )}
                  <span>Filter Leads</span>
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
                : `Discovery History & Results`}
            </h3>
            <p className="text-xs text-slate-400">
              {activeTab === 'search'
                ? 'Review AI qualification and discover executive decision-makers before adding to CRM'
                : activeTab === 'saved'
                ? 'Bookmarked leads awaiting BD outreach preparation'
                : 'Click on any search run or data source to review the full list of discovered leads'}
            </p>
          </div>
        </div>

        {/* ── Content Views ── */}
        {!loading && activeTab === 'search' && searchNotices.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
            {searchNotices.map((n) => (
              <div key={n} className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{n}</span>
              </div>
            ))}
          </div>
        )}
        {loading ? (
          <div className="py-24 text-center space-y-3 bg-[#0E0B1D] rounded-2xl border border-slate-800">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Running AI qualification and provider matching...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-[#0E0B1D] border border-rose-500/20 text-center space-y-3">
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
          /* Search & Objective History View with Results List Trigger */
          <div className="bg-[#0E0B1D] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="divide-y divide-slate-800/80">
              {historyItems.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 italic">
                  No discovery search history recorded yet. Run a search to populate history.
                </div>
              ) : (
                historyItems.map((h) => (
                  <div
                    key={h.id}
                    className="p-5 hover:bg-[#2A1E4D]/70 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {h.query_keyword || 'All Target Organizations'}
                        </span>
                        {h.organization_type && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300 font-mono">
                            {h.organization_type}
                          </span>
                        )}
                        {h.location && (
                          <span className="text-xs text-slate-400">· 📍 {h.location}</span>
                        )}
                        {h.provider_used && (
                          <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-[10px] font-mono border border-violet-500/20">
                            Source: {h.provider_used}
                          </span>
                        )}
                      </div>
                      {h.discovery_objective && (
                        <p className="text-xs text-slate-400 line-clamp-1">
                          <strong className="text-slate-300">Goal:</strong> {h.discovery_objective}
                        </p>
                      )}
                      <div className="text-[11px] text-slate-500">
                        Executed on {new Date(h.timestamp).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-semibold">
                        {h.results_count} Discovered Leads
                      </span>
                      <button
                        onClick={() => handleViewHistoryResults(h)}
                        className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-violet-600/20"
                      >
                        <span>View Results</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
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
              <OrgMap
                showFilters={true}
                height="620px"
                items={items}
                onAdd={handleOpenAdd}
                onSkip={handleSkip}
              />
            ) : (
              <>
                {items.length === 0 ? (
              <div className="p-16 text-center space-y-3 bg-[#0E0B1D] rounded-2xl border border-slate-800">
                <Compass className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-white">No Organizations Found</h4>
                {webSearchConfigured === false ? (
                  <p className="text-xs text-amber-300 max-w-md mx-auto">
                    Live web search is not configured (no Tavily or Serper API key), so results can only come from
                    the built-in directory. Ask an administrator to add a search key, or import a CSV.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Try adjusting your location, organization type filter, or broadening your target ICP query.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((item) => (
                  <DiscoveryCard
                    key={item.id}
                    item={item}
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
                    className="p-2 rounded-xl bg-[#2A1E4D] border border-slate-800 text-slate-300 disabled:opacity-40 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-xl bg-[#2A1E4D] border border-slate-800 text-slate-300 disabled:opacity-40 hover:text-white"
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
      {addingOrg && (() => {
        const allContacts = addingOrg.contacts || []
        const contacts = allContacts.filter((c) => !!c.source_url)
        const unsourcedContacts = allContacts.filter((c) => !c.source_url)
        const noContactSelected = contacts.length > 0 && addContactIds.length === 0
        const blockedByDuplicate = !!addingOrg.is_existing_duplicate && !allowDup
        const sourceHref = addingOrg.source_url
        const websiteHref = addingOrg.website
          ? (addingOrg.website.startsWith('http') ? addingOrg.website : `https://${addingOrg.website}`)
          : null
        const emailLabel = (c: (typeof contacts)[number]) => {
          const status = c.email_status
          if (!c.email || status === 'not_found' || status === 'unavailable') return 'No email found'
          if (status === 'verified') return `${c.email} (verified by an email-verification service)`
          if (status === 'publicly_found') return `${c.email} (found on the source page, not verified)`
          if (status === 'guessed' || status === 'predicted') return `${c.email} (guessed from a name pattern, not verified)`
          return `${c.email} (unverified)`
        }
        return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0E0B1D] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-white">Add Organization to ELLY CRM</h3>
              <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-[10px] font-mono border border-violet-500/20">
                Connection Stage: Potential
              </span>
            </div>

            {addedOrg ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
                <div className="font-bold flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Added to ELLY as “{addedOrg.name}”</span>
                </div>
                <p className="text-[11px] text-emerald-200/80">
                  The server confirmed the new organization. No outreach, tasks or ownership changes were made.
                </p>
                <Link
                  to={`/business-development/organizations/${addedOrg.id}`}
                  className="inline-block text-violet-300 hover:text-white underline text-[11px] font-medium"
                >
                  Open organization
                </Link>
              </div>
            ) : (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#2A1E4D] border border-slate-800 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-white">{addingOrg.name}</div>
                  {addingOrg.potential_fit && (
                    <span className="text-[10px] text-slate-300 shrink-0">
                      Fit: {addingOrg.potential_fit} ({addingOrg.potential_fit_score ?? '—'}/100)
                    </span>
                  )}
                </div>
                <div className="text-slate-400">
                  {addingOrg.organization_type} · {addingOrg.city || addingOrg.country || 'Location not recorded'}
                </div>
                <div className="text-slate-300 pt-1 text-[11px] border-t border-slate-800/60 mt-1">
                  <span className="text-violet-400 font-bold">Fit Reason: </span>
                  {addingOrg.qualification_reason || (
                    <span className="text-slate-500 italic">No fit explanation was recorded for this organization.</span>
                  )}
                </div>
                <div className="pt-1 text-[11px] text-slate-400 space-y-0.5">
                  <div>
                    Source: {addingOrg.source_name || 'Not recorded'}
                    {sourceHref ? (
                      <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-violet-400 hover:text-violet-300 underline">
                        Open source link
                      </a>
                    ) : (
                      <span className="ml-1.5 text-slate-500 italic">No source link recorded</span>
                    )}
                  </div>
                  <div>
                    Website:{' '}
                    {websiteHref ? (
                      <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">
                        {addingOrg.website}
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">Not recorded</span>
                    )}
                  </div>
                </div>
              </div>

              {addingOrg.is_existing_duplicate ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1.5">
                  <div className="font-bold flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Already in ELLY{addingOrg.existing_org_name ? `: ${addingOrg.existing_org_name}` : ''}</span>
                  </div>
                  <p className="text-[11px]">
                    An organization with a matching name or website already exists. The server will refuse this
                    addition unless you confirm it is a different organization.
                  </p>
                  {addingOrg.existing_org_id && (
                    <Link
                      to={`/business-development/organizations/${addingOrg.existing_org_id}`}
                      className="inline-block text-violet-300 hover:text-white underline text-[11px] font-medium"
                    >
                      Open existing organization
                    </Link>
                  )}
                  <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowDup}
                      onChange={(e) => setAllowDup(e.target.checked)}
                      disabled={isAdding}
                      className="rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-0"
                    />
                    <span className="text-slate-200 text-[11px]">Create anyway (allow duplicate)</span>
                  </label>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>No matching organization found in ELLY (checked by name and website).</span>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300">Contacts to import</label>
                  {contacts.length > 0 && (
                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={() =>
                        setAddContactIds(addContactIds.length === contacts.length ? [] : contacts.map((c) => c.id))
                      }
                      className="text-[10px] text-violet-400 hover:text-white underline disabled:opacity-50"
                    >
                      {addContactIds.length === contacts.length ? 'Deselect all' : 'Select all'}
                    </button>
                  )}
                </div>
                {contacts.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">
                    No source-backed contacts were found for this organization. It will be added without contacts.
                  </p>
                ) : (
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {contacts.map((c) => (
                      <li key={c.id} className="p-2 rounded-lg bg-[#2A1E4D] border border-slate-800">
                        <label className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addContactIds.includes(c.id)}
                            disabled={isAdding}
                            onChange={() =>
                              setAddContactIds((prev) =>
                                prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                              )
                            }
                            className="mt-0.5 rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-0"
                          />
                          <div className="min-w-0 text-[11px]">
                            <div className="text-white font-medium">
                              {c.full_name}
                              {c.job_title && <span className="text-slate-400 font-normal"> · {c.job_title}</span>}
                            </div>
                            <div className="text-slate-400">{emailLabel(c)}</div>
                            {c.source_url && (
                              <a
                                href={c.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-violet-400 hover:text-violet-300 underline"
                              >
                                Source page
                              </a>
                            )}
                            <div className="text-slate-500">
                              {c.phone ? 'Phone listed' : 'No phone'} · {c.linkedin_url ? 'LinkedIn listed' : 'No LinkedIn'}
                            </div>
                            {c.is_existing_duplicate && (
                              <div className="text-amber-300">
                                Already in CRM{c.existing_contact_name ? ` as ${c.existing_contact_name}` : ''}
                              </div>
                            )}
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {noContactSelected && (
                  <p className="text-[11px] text-amber-300">
                    Select at least one contact. When none are selected, the add step imports every contact.
                  </p>
                )}
                {unsourcedContacts.length > 0 && (
                  <p className="text-[11px] text-slate-500">
                    {unsourcedContacts.length} suggested contact{unsourcedContacts.length === 1 ? '' : 's'} with no
                    public source {unsourcedContacts.length === 1 ? 'is' : 'are'} not shown and will not be imported.
                  </p>
                )}
                <p className="text-[10px] text-slate-500">
                  Only people found on a cited public page can be imported. Each email shows how it was obtained;
                  only "verified" means an email-verification service confirmed it.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Initial BD Priority</label>
                <select
                  value={addPriority}
                  onChange={(e) => setAddPriority(e.target.value)}
                  className="w-full bg-[#2A1E4D] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
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
                  className="w-full bg-[#2A1E4D] border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              {addError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] space-y-1">
                  <div className="font-bold flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Not added</span>
                  </div>
                  <p>{addError.message}</p>
                  <p className="text-rose-200/80">
                    {addError.status === 409
                      ? 'Open the existing organization instead, or tick “Create anyway” if this is a different organization.'
                      : addError.status === 403 || addError.status === 401
                      ? 'Your account is not allowed to add organizations. Sign in with a business development account.'
                      : 'Nothing was saved. Check your connection and try again.'}
                  </p>
                </div>
              )}
            </div>
            )}

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end space-x-2.5">
              <button
                onClick={handleCloseAdd}
                disabled={isAdding}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold disabled:opacity-50"
              >
                {addedOrg ? 'Close' : 'Cancel'}
              </button>
              {!addedOrg && (
                <button
                  onClick={handleConfirmAdd}
                  disabled={isAdding || noContactSelected || blockedByDuplicate}
                  title={
                    blockedByDuplicate
                      ? 'This organization already exists. Tick “Create anyway” to add a duplicate.'
                      : noContactSelected
                      ? 'Select at least one contact.'
                      : undefined
                  }
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30 disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isAdding ? 'Adding...' : addError ? 'Try again' : 'Confirm & Add to ELLY'}
                </button>
              )}
            </div>
          </div>
        </div>
        )
      })()}

      {/* ── Search & Objective History Results Modal ── */}
      {isHistoryModalOpen && selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0E0B1D] border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#0E0B1D]">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-white">
                    {selectedHistory.query_keyword || 'All Target Organizations'}
                  </h3>
                  {selectedHistory.organization_type && (
                    <span className="px-2 py-0.5 rounded-md bg-violet-600/30 text-violet-300 text-xs font-mono">
                      {selectedHistory.organization_type}
                    </span>
                  )}
                  {selectedHistory.location && (
                    <span className="text-xs text-slate-300">· 📍 {selectedHistory.location}</span>
                  )}
                </div>
                {selectedHistory.discovery_objective && (
                  <p className="text-xs text-slate-400">
                    <strong className="text-slate-300">Objective:</strong> {selectedHistory.discovery_objective}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono border border-emerald-500/20">
                  {historyResults.length} Leads
                </span>
                <button
                  onClick={() => {
                    setIsHistoryModalOpen(false)
                    setSelectedHistory(null)
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {historyResultsLoading ? (
                <div className="py-20 text-center space-y-3">
                  <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
                  <p className="text-xs text-slate-400">Loading discovered leads from this search run...</p>
                </div>
              ) : historyResults.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <Compass className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Lead Records Linked</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    This search completed with {selectedHistory.results_count} hits.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {historyResults.map((item) => (
                    <DiscoveryCard
                      key={item.id}
                      item={item}
                            onSkip={handleSkip}
                      onAdd={handleOpenAdd}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800/80 bg-[#0E0B1D] flex items-center justify-between text-xs text-slate-400">
              <span>Data Source: {selectedHistory.provider_used || 'Multi-Source Discovery'}</span>
              <span>Executed on {new Date(selectedHistory.timestamp).toLocaleString()}</span>
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
