import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { showcaseService } from '../../services/showcase'
import type { Project } from '../../types/project'
import {
  Sparkles,
  Search,
  Layers,
  ExternalLink,
  Presentation,
  ArrowRight,
  RotateCw,
  AlertCircle,
  Tag,
  CheckCircle2,
  Clock,
  Archive,
  Eye,
  SlidersHorizontal,
  X,
  UploadCloud,
  Plus,
  FileText,
  FileUp,
  Globe,
} from 'lucide-react'
import { PresentationDeckUpload } from '../../components/showcase/PresentationDeckUpload'

const allCategories: string[] = [
  'All',
  'Healthcare',
  'Artificial Intelligence',
  'Communication',
  'Automation',
  'Data Science',
  'Business',
]

export const ShowcaseListPage: React.FC = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchInput, setSearchInput] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('All')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [availableTags, setAvailableTags] = useState<string[]>([])

  // Upload Modals State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false)
  const [quickUploadProject, setQuickUploadProject] = useState<Project | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // New Project Form State
  const [newName, setNewName] = useState<string>('')
  const [newShortDesc, setNewShortDesc] = useState<string>('')
  const [newDesc, setNewDesc] = useState<string>('')
  const [newCategory, setNewCategory] = useState<string>('Healthcare')
  const [newStatus, setNewStatus] = useState<string>('Active')
  const [newPresentationUrl, setNewPresentationUrl] = useState<string>('')
  const [newDemoUrl, setNewDemoUrl] = useState<string>('')
  const [newWebsiteUrl, setNewWebsiteUrl] = useState<string>('')
  const [newFeatures, setNewFeatures] = useState<string>('')
  const [newTags, setNewTags] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Quick single deck upload state
  const [isQuickUploading, setIsQuickUploading] = useState<boolean>(false)
  const [quickUploadError, setQuickUploadError] = useState<string | null>(null)
  const cardFileInputRef = useRef<HTMLInputElement>(null)
  const [activeProjectForFileInput, setActiveProjectForFileInput] = useState<Project | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await showcaseService.getProjects({
        search: searchInput.trim() || undefined,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        tag: selectedTag || undefined,
        page_size: 50,
      })
      setProjects(data.items)
    } catch (err: any) {
      setError(err.detail || err.message || 'Unable to load project showcase.')
    } finally {
      setLoading(false)
    }
  }, [searchInput, selectedCategory, selectedStatus, selectedTag])

  // Fetch category & tag metadata
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const meta = await showcaseService.getCategoriesAndTags()
        setAvailableTags(meta.tags)
      } catch (err) {
        console.error(err)
      }
    }
    loadMeta()
  }, [])

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects()
    }, 300)
    return () => clearTimeout(timer)
  }, [fetchProjects])

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toastMessage])

  const clearFilters = () => {
    setSelectedCategory('All')
    setSearchInput('')
    setSelectedStatus('All')
    setSelectedTag('')
  }

  const hasActiveFilters =
    selectedCategory !== 'All' || searchInput || selectedStatus !== 'All' || selectedTag

  const getStatusBadge = (st: string) => {
    switch (st?.toLowerCase()) {
      case 'active':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>Active</span>
          </span>
        )
      case 'coming soon':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            <span>Coming Soon</span>
          </span>
        )
      case 'archived':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
            <Archive className="w-3 h-3" />
            <span>Archived</span>
          </span>
        )
      default:
        return null
    }
  }

  // Handle Quick File Upload from Project Card
  const handleCardFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeProjectForFileInput) return

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!['.pdf', '.ppt', '.pptx'].includes(ext)) {
      alert('Only .pdf, .ppt, and .pptx presentation decks are supported.')
      return
    }

    try {
      setToastMessage(`Uploading ${file.name} to ${activeProjectForFileInput.name}...`)
      const updated = await showcaseService.uploadPresentation(activeProjectForFileInput.id, file)
      setProjects((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, presentation_url: updated.presentation_url } : p))
      )
      setToastMessage(`Presentation deck attached successfully to ${updated.name}!`)
    } catch (err: any) {
      alert(err.message || 'Failed to upload presentation deck.')
    } finally {
      if (cardFileInputRef.current) {
        cardFileInputRef.current.value = ''
      }
      setActiveProjectForFileInput(null)
    }
  }

  // Handle Create Showcase Project Submission
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newShortDesc.trim() || !newDesc.trim()) {
      setFormError('Please provide a project name, summary, and description.')
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      const keyFeatures = newFeatures
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0)

      const tags = newTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      const payload = {
        name: newName.trim(),
        short_description: newShortDesc.trim(),
        description: newDesc.trim(),
        category: newCategory,
        status: newStatus,
        presentation_url: newPresentationUrl || null,
        demo_url: newDemoUrl || null,
        website_url: newWebsiteUrl || null,
        key_features: keyFeatures,
        tags: tags,
      }

      const created = await showcaseService.createProject(payload)
      setToastMessage(`Project "${created.name}" created and published to Showcase!`)
      setIsUploadModalOpen(false)

      // Reset form
      setNewName('')
      setNewShortDesc('')
      setNewDesc('')
      setNewPresentationUrl('')
      setNewDemoUrl('')
      setNewWebsiteUrl('')
      setNewFeatures('')
      setNewTags('')

      fetchProjects()
    } catch (err: any) {
      setFormError(err.detail || err.message || 'Failed to create showcase project.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />

      {/* Hidden File Input for quick card uploads */}
      <input
        type="file"
        ref={cardFileInputRef}
        onChange={handleCardFileSelected}
        accept=".pdf,.ppt,.pptx"
        className="hidden"
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl bg-[#110B2E] border border-emerald-500/40 text-emerald-300 shadow-2xl flex items-center space-x-2.5 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* ── Hero Banner with Prominent Upload Action ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-900/40 via-[#110B2E] to-indigo-950/40 border border-slate-800/90 p-6 sm:p-10 shadow-2xl">
          <div className="absolute right-0 top-0 -mt-12 -mr-12 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Business Development Product Suite</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Company Project Showcase
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Explore and present our company’s intelligence platforms, workflow engines,
                and technology suites during executive meetings and client presentations.
              </p>
            </div>

            {/* ── UPLOAD BUTTON ── */}
            <div className="shrink-0 flex items-center gap-3">
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center space-x-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-xl shadow-violet-600/30 hover:scale-[1.02] border border-violet-400/20"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Project & Deck</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Category Chips & Search Bar ── */}
        <div className="space-y-4">
          {/* Category Chips */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                    : 'bg-[#110B2E] text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search & Secondary Filter Bar */}
          <div className="bg-[#110B2E] border border-slate-800/90 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search projects by name, features, or keywords..."
                className="w-full pl-10 pr-4 py-2 bg-[#1A1040] border border-slate-700/80 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-[#1A1040] border border-slate-700/80 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-violet-500 w-full sm:w-auto"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Coming Soon">Coming Soon</option>
              <option value="Archived">Archived</option>
            </select>

            {/* Tag Filter */}
            {availableTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="px-3 py-2 bg-[#1A1040] border border-slate-700/80 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-violet-500 w-full sm:w-auto"
              >
                <option value="">All Tags</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            )}

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center justify-center space-x-1 border border-slate-700 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Main Content Grid ── */}
        {loading ? (
          <div className="py-24 text-center space-y-4">
            <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Loading showcase projects...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-3 bg-[#110B2E] border border-rose-500/20 rounded-3xl p-8">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h2 className="text-sm font-bold text-white">Error loading showcase</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">{error}</p>
            <button
              onClick={fetchProjects}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="py-20 text-center space-y-4 bg-[#110B2E] border border-slate-800/80 rounded-3xl p-8">
            <div className="w-12 h-12 rounded-2xl bg-violet-600/10 text-violet-400 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">No projects available</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'No projects match your current search or category filter.'
                  : 'Get started by uploading your first project and presentation deck.'}
              </p>
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload New Project</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/business-development/showcase/${project.id}`)}
                className="rounded-3xl bg-[#110B2E] border border-slate-800/90 hover:border-violet-500/50 transition-all duration-300 cursor-pointer shadow-xl flex flex-col justify-between overflow-hidden group hover:shadow-violet-950/20"
              >
                {/* Visual Header / Thumbnail Box */}
                <div className="relative h-44 bg-gradient-to-br from-violet-950/60 via-[#1A1040] to-slate-900 flex items-center justify-center p-6 border-b border-slate-800/80 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#110B2E] via-transparent to-transparent opacity-80" />
                  <div className="relative z-10 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 mx-auto shadow-inner group-hover:scale-110 transition duration-300">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <span className="inline-block px-3 py-1 rounded-full bg-[#110B2E]/80 backdrop-blur-md border border-slate-700 text-[10px] font-mono uppercase tracking-wider text-violet-300">
                      {project.category}
                    </span>
                  </div>

                  <div className="absolute top-3.5 right-3.5 z-20">
                    {getStatusBadge(project.status)}
                  </div>

                  {/* Deck Status Pill */}
                  <div className="absolute top-3.5 left-3.5 z-20">
                    {project.presentation_url ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 backdrop-blur-md">
                        <FileText className="w-3 h-3 text-indigo-400" />
                        <span>Deck Ready</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700 backdrop-blur-md">
                        <span>No Deck</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-bold text-white text-base group-hover:text-violet-300 transition line-clamp-1">
                      {project.name}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                      {project.short_description}
                    </p>
                  </div>

                  {/* Tags */}
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {project.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-[#1A1040] border border-slate-800 text-[10px] text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}
                      {project.tags.length > 3 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-slate-500">
                          +{project.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div
                  className="px-6 py-4 bg-[#1A1040]/60 border-t border-slate-800/80 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/business-development/showcase/${project.id}/presentation`}
                      className="flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold transition"
                      title="Launch Presentation Mode"
                    >
                      <Presentation className="w-3.5 h-3.5" />
                      <span>Present</span>
                    </Link>

                    {/* Quick Deck Upload Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveProjectForFileInput(project)
                        cardFileInputRef.current?.click()
                      }}
                      className="flex items-center space-x-1 py-1.5 px-2.5 rounded-xl bg-[#110B2E] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs transition"
                      title={project.presentation_url ? "Replace Presentation Deck" : "Upload Presentation Deck"}
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{project.presentation_url ? 'Replace Deck' : 'Upload Deck'}</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    {project.demo_url && (
                      <a
                        href={project.demo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-[#110B2E] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                        title="Open Interactive Demo"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <Link
                      to={`/business-development/showcase/${project.id}`}
                      className="inline-flex items-center space-x-1 py-1.5 px-3 rounded-xl bg-[#110B2E] hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-800 hover:border-slate-700 transition"
                    >
                      <span>Details</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── UPLOAD PROJECT & PRESENTATION DECK MODAL ── */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#110B2E] border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-violet-400">
                  <UploadCloud className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Showcase Uploader</span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Upload Showcase Project & Presentation Deck
                </h2>
                <p className="text-xs text-slate-400">
                  Attach your company pitch deck (.PDF, .PPT, .PPTX) and publish this solution to the BD Showcase.
                </p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-2 rounded-xl bg-[#1A1040] hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-5">
              {/* 1. Presentation Deck Upload Area */}
              <div className="p-4 rounded-2xl bg-[#1A1040]/70 border border-violet-800/40 space-y-2">
                <PresentationDeckUpload
                  value={newPresentationUrl}
                  onChange={(url) => setNewPresentationUrl(url)}
                />
              </div>

              {/* 2. Project Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Project Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. AI Workflow Engine"
                    className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                  >
                    <option value="Healthcare">Healthcare</option>
                    <option value="Artificial Intelligence">Artificial Intelligence</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="Communication">Communication</option>
                    <option value="Automation">Automation</option>
                    <option value="Data Science">Data Science</option>
                    <option value="Business">Business</option>
                  </select>
                </div>
              </div>

              {/* 3. Short Description / Elevator Pitch */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Short Elevator Pitch / Summary <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newShortDesc}
                  onChange={(e) => setNewShortDesc(e.target.value)}
                  placeholder="Concise 1-2 sentence overview for cards and client teasers..."
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* 4. Full Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Comprehensive Business Description <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detailed breakdown of the architecture, workflow capabilities, and enterprise value..."
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* 5. Key Features */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Key Capabilities / Features (one per line)
                </label>
                <textarea
                  rows={2}
                  value={newFeatures}
                  onChange={(e) => setNewFeatures(e.target.value)}
                  placeholder="Real-time multi-agent orchestration&#10;Enterprise grade SOC2 encryption&#10;One-click analytics export"
                  className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* 6. Demo URL & Website */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Interactive Demo URL</label>
                  <input
                    type="url"
                    value={newDemoUrl}
                    onChange={(e) => setNewDemoUrl(e.target.value)}
                    placeholder="https://demo.mycompany.com"
                    className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Solution Website URL</label>
                  <input
                    type="url"
                    value={newWebsiteUrl}
                    onChange={(e) => setNewWebsiteUrl(e.target.value)}
                    placeholder="https://mycompany.com/product"
                    className="w-full px-3.5 py-2.5 bg-[#1A1040] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload & Publish Project</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default ShowcaseListPage
