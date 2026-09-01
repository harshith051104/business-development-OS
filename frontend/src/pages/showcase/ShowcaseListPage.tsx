import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { showcaseService } from '../../services/showcase'
import type { Project, ProjectCategory, ProjectStatus } from '../../types/project'
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
} from 'lucide-react'

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

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-900/40 via-[#110B2E] to-indigo-950/40 border border-slate-800/90 p-6 sm:p-10 shadow-2xl">
          <div className="absolute right-0 top-0 -mt-12 -mr-12 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-3">
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
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Project Cards Grid ── */}
        {loading ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-16 text-center space-y-3">
            <RotateCw className="w-6 h-6 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Loading showcase projects...</p>
          </div>
        ) : error ? (
          <div className="bg-[#110B2E] border border-red-500/20 rounded-2xl p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <h2 className="text-sm font-bold text-white">Error loading showcase</h2>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={fetchProjects}
              className="py-1.5 px-4 rounded-xl bg-violet-600 text-white text-xs font-medium"
            >
              Retry
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <Layers className="w-7 h-7 stroke-[1.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">No projects available</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'No projects match your current search or category filter.'
                  : 'Approved company projects will appear here.'}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Clear Filters
              </button>
            )}
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
                  <Link
                    to={`/business-development/showcase/${project.id}/presentation`}
                    className="flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold transition"
                    title="Launch Presentation Mode"
                  >
                    <Presentation className="w-3.5 h-3.5" />
                    <span>Present</span>
                  </Link>

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
    </div>
  )
}
export default ShowcaseListPage
