import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { fundingService } from '../../services/funding'
import { discoveryService } from '../../services/discovery'
import type { InvestorSearchResult, InvestorContact } from '../../services/funding'
import {
  DollarSign,
  Search,
  Loader2,
  Users,
  CheckCircle2,
  Mail,
  ExternalLink,
  ListChecks,
} from 'lucide-react'

type ResultRow = InvestorSearchResult & {
  contacts?: InvestorContact[]
  contactsLoading?: boolean
  contactsError?: string
  adding?: boolean
  addError?: string
}

const emailLabel = (c: InvestorContact) => {
  const s = c.email_status
  if (s === 'verified') return 'verified'
  if (s === 'publicly_found') return 'found on source page, not verified'
  if (s === 'guessed' || s === 'predicted') return 'guessed, not verified'
  return 'unverified'
}

export const FundingPage: React.FC = () => {
  const [sector, setSector] = useState('')
  const [stage, setStage] = useState('')
  const [location, setLocation] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [results, setResults] = useState<ResultRow[]>([])

  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearching(true)
    setSearchError(null)
    try {
      const rows = await fundingService.searchInvestors({ sector, stage, location, limit: 10 })
      setResults(rows)
      setHasSearched(true)
    } catch (err: any) {
      setSearchError(err?.message || 'Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  const handleFindContacts = async (row: ResultRow) => {
    setResults((prev) =>
      prev.map((r) => (r.discovered_org_id === row.discovered_org_id ? { ...r, contactsLoading: true, contactsError: undefined } : r))
    )
    try {
      const contacts = await fundingService.findContacts(row.discovered_org_id)
      setResults((prev) =>
        prev.map((r) =>
          r.discovered_org_id === row.discovered_org_id ? { ...r, contacts, contactsLoading: false } : r
        )
      )
    } catch (err: any) {
      setResults((prev) =>
        prev.map((r) =>
          r.discovered_org_id === row.discovered_org_id
            ? { ...r, contactsLoading: false, contactsError: err?.message || 'Could not find contacts' }
            : r
        )
      )
    }
  }

  // Review step: a result enters the CRM only through the same add flow (and duplicate
  // check) as Find Organizations.
  const handleAddToElly = async (row: ResultRow) => {
    const patch = (p: Partial<ResultRow>) =>
      setResults((prev) => prev.map((r) => (r.discovered_org_id === row.discovered_org_id ? { ...r, ...p } : r)))
    patch({ adding: true, addError: undefined })
    try {
      const org = await discoveryService.addToOrganizations(row.discovered_org_id, { priority: 'Medium' })
      patch({ adding: false, organization_id: org.id })
    } catch (err: any) {
      patch({ adding: false, addError: err?.detail || err?.message || 'Could not add to ELLY' })
    }
  }



  return (
    <div className="min-h-screen bg-[#0e0b1d] text-[#C9C2E3] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight">Find Investors</h1>
            </div>
            <p className="text-sm text-gray-400">
              Search angel investors, VCs and funds and find their partner contacts. Add the ones you want to ELLY for review.
            </p>
          </div>
        </div>

        {/* Guided search form */}
        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-[#0e0b1d]/60 border border-white/5"
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 block">
              Sector
            </label>
            <input
              type="text"
              placeholder="e.g. fintech, healthtech"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full bg-[#0E0B1D] px-3 py-2 rounded-xl border border-white/5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/40"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 block">
              Stage
            </label>
            <input
              type="text"
              placeholder="e.g. seed, series A"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full bg-[#0E0B1D] px-3 py-2 rounded-xl border border-white/5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/40"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 block">
              Location
            </label>
            <input
              type="text"
              placeholder="e.g. Bangalore, India"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-[#0E0B1D] px-3 py-2 rounded-xl border border-white/5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/40"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={searching}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-lg hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searching ? 'Searching...' : 'Search Investors'}
            </button>
          </div>
        </form>

        {searchError && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-sm text-rose-300">
            {searchError}
          </div>
        )}

        {hasSearched && !searching && !searchError && results.length === 0 && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700 text-sm text-gray-300">
            No investors found for this search. If this keeps happening, live web search may not be configured
            (Tavily or Serper API key).
          </div>
        )}

        {/* Results grid */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              {results.length} result{results.length === 1 ? '' : 's'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((row) => (
                <div
                  key={row.discovered_org_id}
                  className="p-5 rounded-2xl bg-gradient-to-b from-[#0e0b1d] to-[#0E0B1D] border border-white/5 shadow-xl space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">{row.name}</div>
                      {row.website && (
                        <a
                          href={row.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          {row.website} <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-400">
                    {[row.city, row.state, row.country].filter(Boolean).join(', ') || 'Location not stated on the source page'}
                  </div>

                  {row.potential_fit && (
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-500/20">
                      Fit: {row.potential_fit}
                    </span>
                  )}

                  {row.organization_id ? (
                    <Link
                      to={`/business-development/organizations/${row.organization_id}`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-white"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> In ELLY — open organization
                    </Link>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-xs text-amber-300">
                        Not in ELLY yet. Check the source page, then add it if it is a real investor.
                      </div>
                      {row.existing_org_id && (
                        <Link
                          to={`/business-development/organizations/${row.existing_org_id}`}
                          className="block text-xs text-amber-200 underline"
                        >
                          Possible match already in ELLY
                        </Link>
                      )}
                      <button
                        onClick={() => handleAddToElly(row)}
                        disabled={row.adding}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-lg hover:bg-emerald-900/50 transition-all disabled:opacity-50"
                      >
                        {row.adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5" />}
                        {row.adding ? 'Adding…' : 'Add to ELLY'}
                      </button>
                      {row.addError && <div className="text-xs text-rose-400">{row.addError}</div>}
                    </div>
                  )}

                  {!row.contacts && (
                    <button
                      onClick={() => handleFindContacts(row)}
                      disabled={row.contactsLoading}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 rounded-lg hover:bg-indigo-900/50 transition-all disabled:opacity-50"
                    >
                      {row.contactsLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Users className="w-3.5 h-3.5" />
                      )}
                      {row.contactsLoading ? 'Finding contacts...' : 'Find Contacts'}
                    </button>
                  )}

                  {row.contactsError && (
                    <div className="text-xs text-rose-400">{row.contactsError}</div>
                  )}

                  {row.contacts && (
                    <div className="space-y-1.5 pt-1 border-t border-white/5">
                      {row.contacts.length === 0 && (
                        <div className="text-xs text-gray-500">No contacts found.</div>
                      )}
                      {row.contacts.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <div>
                            <span className="text-white font-medium">{c.full_name}</span>
                            <span className="text-gray-500"> — {c.job_title}</span>
                          </div>
                          {c.email ? (
                            <span className="flex items-center gap-1 text-emerald-400" title={c.source_url || undefined}>
                              <Mail className="w-3 h-3" /> {c.email}
                              <span className="text-gray-500">({emailLabel(c)})</span>
                            </span>
                          ) : (
                            <span className="text-gray-500">no email</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

export default FundingPage
