import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { showcaseService } from '../../services/showcase'
import type { Project } from '../../types/project'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sparkles,
  ExternalLink,
  RotateCw,
  CheckCircle2,
  TrendingUp,
  Target,
  Users,
  Building2,
  HelpCircle,
  ShieldCheck,
  Layers,
  ArrowRight,
} from 'lucide-react'

export const ProjectPresentationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [currentSlide, setCurrentSlide] = useState<number>(0)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

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

  const totalSlides = 8

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1))
  }, [totalSlides])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0))
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault()
        nextSlide()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevSlide()
      } else if (e.key === 'Escape') {
        if (id) navigate(`/business-development/showcase/${id}`)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nextSlide, prevSlide, id, navigate])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => console.error(err))
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch((err) => console.error(err))
      setIsFullscreen(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05040D] flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <RotateCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Preparing presentation deck...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#05040D] flex items-center justify-center p-6 text-white">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-lg font-bold text-white">Unable to launch presentation</h2>
          <p className="text-xs text-slate-400">{error || 'Project data unavailable.'}</p>
          <button
            onClick={() => navigate('/business-development/showcase')}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
          >
            Back to Showcase
          </button>
        </div>
      </div>
    )
  }

  const renderSlideContent = () => {
    switch (currentSlide) {
      // Slide 1: Title & Introduction
      case 0:
        return (
          <div className="space-y-8 text-center max-w-4xl mx-auto animate-fade-in">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-4 h-4" />
              <span>{project.category} Solution</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
                {project.name}
              </h1>
              <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto font-light leading-relaxed">
                {project.short_description}
              </p>
            </div>

            <div className="pt-4 flex items-center justify-center space-x-3">
              <button
                onClick={nextSlide}
                className="px-8 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition shadow-2xl shadow-violet-600/40 flex items-center space-x-2"
              >
                <span>Begin Overview</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )

      // Slide 2: The Problem
      case 1:
        return (
          <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
            <div className="space-y-2 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-rose-400 font-mono">
                Industry Challenge
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                The Operational Bottleneck
              </h2>
            </div>

            <div className="p-8 sm:p-12 rounded-3xl bg-[#110B2E] border border-rose-500/20 shadow-2xl space-y-6">
              <div className="flex items-center space-x-3 text-rose-300">
                <HelpCircle className="w-6 h-6 shrink-0" />
                <h3 className="text-lg font-bold text-white">What Core Problem Do We Solve?</h3>
              </div>
              <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
                {project.business_value?.problem_solved ||
                  'Disconnected operational systems create communication delays, capacity shortages, and resource bottlenecks across departments.'}
              </p>
            </div>
          </div>
        )

      // Slide 3: Our Solution
      case 2:
        return (
          <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
            <div className="space-y-2 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400 font-mono">
                Our Solution
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Empowering Intelligent Healthcare Operations
              </h2>
            </div>

            <div className="p-8 sm:p-12 rounded-3xl bg-[#110B2E] border border-teal-500/20 shadow-2xl space-y-6">
              <div className="flex items-center space-x-3 text-teal-300">
                <Sparkles className="w-6 h-6 shrink-0" />
                <h3 className="text-lg font-bold text-white">{project.name}</h3>
              </div>
              <p className="text-base sm:text-lg text-slate-200 leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          </div>
        )

      // Slide 4: Key Capabilities
      case 3:
        return (
          <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
            <div className="space-y-2 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-violet-400 font-mono">
                Platform Architecture
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Core Capabilities & Modules
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {project.key_features && project.key_features.length > 0 ? (
                project.key_features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-[#110B2E] border border-slate-800 flex items-start space-x-3.5 shadow-xl"
                  >
                    <div className="p-2 rounded-xl bg-violet-600/20 text-violet-300 shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-200 leading-normal">
                      {feat}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 text-slate-400 text-sm">
                  Full multi-module platform capabilities.
                </div>
              )}
            </div>
          </div>
        )

      // Slide 5: Business Value & ROI
      case 4:
        return (
          <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
            <div className="space-y-2 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 font-mono">
                Business Impact
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Measurable Value & ROI
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl bg-[#110B2E] border border-emerald-500/20 shadow-xl space-y-3">
                <div className="flex items-center space-x-2 text-emerald-300 font-bold text-sm">
                  <TrendingUp className="w-5 h-5" />
                  <span>Value Proposition</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {project.business_value?.value_proposition ||
                    'Substantial operational efficiency, shortened turnaround times, and reduced clinician administrative burden.'}
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-[#110B2E] border border-blue-500/20 shadow-xl space-y-3">
                <div className="flex items-center space-x-2 text-blue-300 font-bold text-sm">
                  <Building2 className="w-5 h-5" />
                  <span>Target Organizations</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {project.business_value?.target_organizations ||
                    'Mid-market companies, enterprise clients, growth-stage startups, and regional providers.'}
                </p>
              </div>
            </div>
          </div>
        )

      // Slide 6: Use Cases
      case 5:
        return (
          <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
            <div className="space-y-2 text-center sm:text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400 font-mono">
                Practical Execution
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Real-World Scenarios
              </h2>
            </div>

            <div className="space-y-4">
              {project.business_use_cases && project.business_use_cases.length > 0 ? (
                project.business_use_cases.map((uc, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-3xl bg-[#110B2E] border border-slate-800 shadow-xl space-y-2"
                  >
                    <div className="flex items-center space-x-2 text-amber-300 font-bold text-sm">
                      <Target className="w-4 h-4" />
                      <span>{uc.title}</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{uc.description}</p>
                    {uc.target_outcome && (
                      <p className="text-xs text-teal-300 font-medium pt-1">
                        Impact: {uc.target_outcome}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-6 rounded-2xl bg-[#110B2E] border border-slate-800 text-slate-400 text-sm">
                  Flexible hospital operational workflows.
                </div>
              )}
            </div>
          </div>
        )

      // Slide 7: Live Demo
      case 6:
        return (
          <div className="space-y-8 text-center max-w-3xl mx-auto animate-fade-in">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-4 h-4" />
              <span>Interactive Experience</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Live Interactive Demonstration
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Ready to experience the platform interface live? Open our approved interactive
                demonstration portal.
              </p>
            </div>

            <div className="pt-6">
              {project.demo_url ? (
                <a
                  href={project.demo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-base transition shadow-2xl shadow-violet-600/40 hover:scale-105"
                >
                  <span>Open Platform Demo</span>
                  <ExternalLink className="w-5 h-5" />
                </a>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  Live demo environment is configured upon request.
                </p>
              )}
            </div>
          </div>
        )

      // Slide 8: Next Steps & Business Discussion
      case 7:
        return (
          <div className="space-y-8 text-center max-w-3xl mx-auto animate-fade-in">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" />
              <span>Next Steps</span>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Advancing the Discussion
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Thank you for your time. Let’s discuss how we can tailor our solution to your
                organization’s operational goals.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[#110B2E] border border-slate-800 max-w-md mx-auto text-left space-y-3 text-xs text-slate-300">
              <div className="font-bold text-white text-sm pb-1 border-b border-slate-800">
                Recommended Next Actions:
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Executive Q&A on Departmental Integration</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Schedule Dedicated Clinical / IT Overview</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Custom Feasibility & Scope Alignment</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate(`/business-development/showcase/${project.id}`)}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Exit Presentation Mode
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[#05040D] text-[#F0ECFF] flex flex-col justify-between select-none relative overflow-hidden">
      {/* ── Top Bar ── */}
      <header className="px-6 py-4 flex items-center justify-between z-50 border-b border-slate-900/60 bg-[#05040D]/80 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <Link
            to={`/business-development/showcase/${project.id}`}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#110B2E] hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition"
          >
            <X className="w-4 h-4" />
            <span>Exit</span>
          </Link>
          <span className="text-xs font-bold text-white hidden sm:inline">{project.name}</span>
        </div>

        {/* Slide Counter */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-slate-400">
            Slide <span className="font-bold text-white">{currentSlide + 1}</span> of {totalSlides}
          </span>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-[#110B2E] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* ── Main Slide Viewport ── */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-12 z-20">
        {renderSlideContent()}
      </main>

      {/* ── Bottom Controls & Progress Bar ── */}
      <footer className="px-6 py-4 z-50 border-t border-slate-900/60 bg-[#05040D]/80 backdrop-blur-md space-y-3">
        {/* Progress Bar */}
        <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full transition-all duration-300"
            style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#110B2E] hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {/* Dots Indicator */}
          <div className="hidden sm:flex items-center space-x-1.5">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  currentSlide === idx
                    ? 'w-6 bg-violet-400'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            onClick={nextSlide}
            disabled={currentSlide === totalSlides - 1}
            className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-md shadow-violet-600/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  )
}
export default ProjectPresentationPage
