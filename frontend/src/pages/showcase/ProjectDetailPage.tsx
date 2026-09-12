import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { showcaseService } from '../../services/showcase'
import type { Project } from '../../types/project'
import {
  Sparkles,
  ArrowLeft,
  Presentation,
  ExternalLink,
  Globe,
  FileText,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Clock,
  Target,
  Users,
  TrendingUp,
  Building2,
  Layers,
  Image as ImageIcon,
  PlayCircle,
  HelpCircle,
  ShieldCheck,
  Download,
} from 'lucide-react'

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProject = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await showcaseService.getProject(id)
      setProject(data)
    } catch (err: any) {
      setError(err.detail || err.message || 'Project not found.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] pb-24 md:pl-64">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* ── Top Back Link ── */}
        <div>
          <Link
            to="/business-development/showcase"
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Project Showcase</span>
          </Link>
        </div>

        {loading ? (
          <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-16 text-center space-y-3">
            <RotateCw className="w-6 h-6 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading project details...</p>
          </div>
        ) : error || !project ? (
          <div className="bg-[#110B2E] border border-red-500/20 rounded-2xl p-12 text-center space-y-4">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <h2 className="text-base font-bold text-white">Project Not Found</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">{error}</p>
            <Link
              to="/business-development/showcase"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-medium"
            >
              Return to Showcase
            </Link>
          </div>
        ) : (
          <>
            {/* ── Project Header Card ── */}
            <div className="bg-[#110B2E] border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2.5 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 text-xs font-semibold uppercase tracking-wider">
                      {project.category}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider">
                      {project.status}
                    </span>
                    {project.is_featured && (
                      <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-semibold uppercase tracking-wider">
                        Featured Solution
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {project.name}
                  </h1>

                  <p className="text-sm text-slate-300 leading-relaxed font-medium">
                    {project.short_description}
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
                  <Link
                    to={`/business-development/showcase/${project.id}/presentation`}
                    className="flex items-center space-x-2 py-2.5 px-5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/30 hover:scale-[1.02]"
                  >
                    <Presentation className="w-4 h-4" />
                    <span>Start Presentation</span>
                  </Link>

                  {project.demo_url && (
                    <a
                      href={project.demo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1.5 py-2.5 px-4 rounded-2xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      <ExternalLink className="w-4 h-4 text-violet-400" />
                      <span>Open Demo</span>
                    </a>
                  )}

                  {project.website_url && (
                    <a
                      href={project.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1.5 py-2.5 px-4 rounded-2xl bg-[#1A1040] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      <Globe className="w-4 h-4 text-slate-400" />
                      <span>Website</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Tags Row */}
              {project.tags && project.tags.length > 0 && (
                <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold mr-1">Tags:</span>
                  {project.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-[#1A1040] border border-slate-800 text-xs text-slate-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Main 2-Column Content ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left 2 Columns: About, Key Features, Use Cases */}
              <div className="lg:col-span-2 space-y-8">
                {/* About the Project */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider text-violet-400 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>About the Project</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {project.description}
                  </p>
                </div>

                {/* Key Features */}
                {project.key_features && project.key_features.length > 0 && (
                  <div className="bg-[#110B2E] border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider text-teal-400 flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      <span>Key Features & Capabilities</span>
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {project.key_features.map((feature, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-[#1A1040] border border-slate-800/90 flex items-start space-x-3"
                        >
                          <div className="p-1 rounded-lg bg-teal-500/10 text-teal-400 shrink-0 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs text-slate-200 font-medium leading-normal">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Business Value & ROI Breakdown */}
                {project.business_value && (
                  <div className="bg-[#110B2E] border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      <span>Business Value & ROI</span>
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {project.business_value.problem_solved && (
                        <div className="p-4 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-1.5">
                          <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-300">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Problem Addressed</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {project.business_value.problem_solved}
                          </p>
                        </div>
                      )}

                      {project.business_value.target_audience && (
                        <div className="p-4 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-1.5">
                          <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-300">
                            <Users className="w-3.5 h-3.5" />
                            <span>Who Can Use It</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {project.business_value.target_audience}
                          </p>
                        </div>
                      )}

                      {project.business_value.value_proposition && (
                        <div className="p-4 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-1.5">
                          <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-300">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Measurable Business Value</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {project.business_value.value_proposition}
                          </p>
                        </div>
                      )}

                      {project.business_value.target_organizations && (
                        <div className="p-4 rounded-2xl bg-[#1A1040] border border-slate-800 space-y-1.5">
                          <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-300">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>Target Organizations</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {project.business_value.target_organizations}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Real-World Use Cases */}
                {project.business_use_cases && project.business_use_cases.length > 0 && (
                  <div className="bg-[#110B2E] border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      <span>Real-World Business Use Cases</span>
                    </h2>

                    <div className="space-y-3.5">
                      {project.business_use_cases.map((uc, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-[#1A1040] border border-slate-800/90 space-y-2"
                        >
                          <h3 className="text-xs sm:text-sm font-bold text-white">{uc.title}</h3>
                          <p className="text-xs text-slate-300 leading-relaxed">{uc.description}</p>
                          {uc.target_outcome && (
                            <div className="pt-2 border-t border-slate-800 text-[11px] text-teal-300 flex items-center gap-1.5 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>Target Impact: {uc.target_outcome}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Presentation Tools, Media, Safe Links */}
              <div className="space-y-8">
                {/* Presentation Card */}
                <div className="bg-gradient-to-br from-violet-900/40 via-[#110B2E] to-indigo-950/40 border border-violet-500/30 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center space-x-2 text-violet-300">
                    <Presentation className="w-5 h-5" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">BD Presentation</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Launch a clean, distraction-free widescreen presentation deck to showcase this
                    product during executive stakeholder meetings.
                  </p>
                  <Link
                    to={`/business-development/showcase/${project.id}/presentation`}
                    className="w-full py-3 px-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition shadow-lg shadow-violet-600/30 flex items-center justify-center space-x-2"
                  >
                    <Presentation className="w-4 h-4" />
                    <span>Launch Presentation Deck</span>
                  </Link>
                </div>

                {/* Approved Links Card */}
                <div className="bg-[#110B2E] border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-violet-400" />
                    <span>Approved Materials</span>
                  </h3>

                  <div className="space-y-2.5">
                    {project.demo_url && (
                      <a
                        href={project.demo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl bg-[#1A1040] hover:bg-violet-600/20 border border-slate-800 hover:border-violet-500/40 transition flex items-center justify-between text-xs text-slate-200 group"
                      >
                        <span className="font-semibold group-hover:text-violet-300">
                          Live Interactive Demo
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-400" />
                      </a>
                    )}

                    {project.website_url && (
                      <a
                        href={project.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl bg-[#1A1040] hover:bg-slate-800 border border-slate-800 transition flex items-center justify-between text-xs text-slate-200 group"
                      >
                        <span>Official Solution Overview</span>
                        <Globe className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" />
                      </a>
                    )}

                    {project.presentation_url && (
                      <a
                        href={
                          project.presentation_url.startsWith('http')
                            ? project.presentation_url
                            : `http://127.0.0.1:8001${project.presentation_url}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl bg-violet-600/15 hover:bg-violet-600/25 border border-violet-500/40 transition flex items-center justify-between text-xs text-violet-200 group shadow-sm"
                      >
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-violet-400" />
                          <span className="font-bold text-white">
                            Executive Presentation Deck ({project.presentation_url.split('.').pop()?.toUpperCase() || 'DECK'})
                          </span>
                        </div>
                        <Download className="w-3.5 h-3.5 text-violet-400 group-hover:scale-110 transition" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Screenshots & Media Preview */}
                {project.images && project.images.length > 0 && (
                  <div className="bg-[#110B2E] border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider text-teal-400 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      <span>Product Preview Gallery</span>
                    </h3>

                    <div className="space-y-3">
                      {project.images.map((img, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl bg-[#1A1040] border border-slate-800 p-3 space-y-2 overflow-hidden"
                        >
                          <div className="h-32 rounded-xl bg-gradient-to-br from-violet-950/40 via-slate-900 to-indigo-950/40 flex items-center justify-center text-slate-500">
                            <Sparkles className="w-6 h-6 text-violet-400/50" />
                          </div>
                          {img.caption && (
                            <p className="text-[11px] text-slate-400 italic text-center">
                              {img.caption}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
export default ProjectDetailPage
