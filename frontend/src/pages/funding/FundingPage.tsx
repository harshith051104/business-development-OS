import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { fundingService } from '../../services/funding'
import type { InvestorSearchResult, InvestorContact } from '../../services/funding'
import {
  DollarSign,
  Search,
  Loader2,
  Users,
  CheckCircle2,
  Mail,
  Sparkles,
  Send,
  ExternalLink,
  ListChecks,
} from 'lucide-react'

type ResultRow = InvestorSearchResult & {
  contacts?: InvestorContact[]
  contactsLoading?: boolean
  contactsError?: string
}

export const FundingPage: React.FC = () => {
  const [sector, setSector] = useState('')
  const [stage, setStage] = useState('')
  const [location, setLocation] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [results, setResults] = useState<ResultRow[]>([])

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [template, setTemplate] = useState('')
  const [useAiTemplate, setUseAiTemplate] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearching(true)
    setSearchError(null)
    setSendResult(null)
    try {
      const rows = await fundingService.searchInvestors({ sector, stage, location, limit: 10 })
      setResults(rows)
      setSelected(new Set())
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

  const toggleSelected = (row: ResultRow) => {
    if (!row.organization_id) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(row.organization_id!)) {
        next.delete(row.organization_id!)
      } else {
        next.add(row.organization_id!)
      }
      return next
    })
  }

  const selectableRows = results.filter(
    (r) => r.organization_id && r.contacts && r.contacts.some((c) => c.email)
  )

  const handleSend = async () => {
    if (selected.size === 0) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fundingService.sendOutreach({
        organization_ids: Array.from(selected),
        template: useAiTemplate ? undefined : template,
        use_ai_template: useAiTemplate,
      })
      setSendResult(`Sent to ${res.sent} contact(s). ${res.failed ? `${res.failed} failed.` : ''}`)
      setSelected(new Set())
    } catch (err: any) {
      setSendResult(err?.message || 'Send failed. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080615] text-[#F8F7FF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight">Find Investors</h1>
            </div>
            <p className="text-sm text-gray-400">
              Search angel investors, VCs and funds, find their partner contacts, then send outreach immediately — no review step.
            </p>
          </div>
          <Link
            to="/business-development/funding/campaigns"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-xl hover:bg-emerald-900/50 transition-all"
          >
            <ListChecks className="w-4 h-4" />
            View Funding Campaigns
          </Link>
        </div>

        {/* Guided search form */}
        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-[#131127]/60 border border-white/5"
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
              className="w-full bg-[#0D0B1E] px-3 py-2 rounded-xl border border-white/5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/40"
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
              className="w-full bg-[#0D0B1E] px-3 py-2 rounded-xl border border-white/5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/40"
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
              className="w-full bg-[#0D0B1E] px-3 py-2 rounded-xl border border-white/5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/40"
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
                  className="p-5 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 shadow-xl space-y-3"
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
                    {row.organization_id && row.contacts && row.contacts.some((c) => c.email) && (
                      <input
                        type="checkbox"
                        checked={selected.has(row.organization_id)}
                        onChange={() => toggleSelected(row)}
                        className="w-4 h-4 accent-emerald-500 mt-1"
                        title="Select for outreach"
                      />
                    )}
                  </div>

                  {row.potential_fit && (
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-500/20">
                      Fit: {row.potential_fit}
                    </span>
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
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Mail className="w-3 h-3" /> {c.email}
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

        {/* Send panel */}
        {selectableRows.length > 0 && (
          <div className="p-5 rounded-2xl bg-[#131127]/60 border border-emerald-500/20 space-y-4">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">
                Send Funding Outreach — sends immediately to {selected.size} selected contact
                {selected.size === 1 ? '' : 's'}, no review step
              </h2>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={useAiTemplate}
                onChange={(e) => setUseAiTemplate(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Generate message with AI personalization
            </label>

            {!useAiTemplate && (
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="Hi {{first_name}},\n\nWrite your outreach message here..."
                rows={5}
                className="w-full bg-[#0D0B1E] px-3 py-2 rounded-xl border border-white/5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/40"
              />
            )}

            <button
              onClick={handleSend}
              disabled={sending || selected.size === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-lg hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {sending ? 'Sending...' : `Send Now to ${selected.size}`}
            </button>

            {sendResult && <div className="text-sm text-emerald-300">{sendResult}</div>}
          </div>
        )}
      </main>
    </div>
  )
}

export default FundingPage
