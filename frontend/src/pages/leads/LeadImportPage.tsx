import React, { useEffect, useState } from 'react'
import Navbar from '../../components/layout/Navbar'
import { leadImportService, TARGET_FIELD_LABELS } from '../../services/leadImport'
import type { LeadUploadPreview, LeadImportResult, LeadImportBatchSummary } from '../../services/leadImport'
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, ArrowRight, History } from 'lucide-react'

type Step = 'upload' | 'map' | 'result'

export const LeadImportPage: React.FC = () => {
  const [step, setStep] = useState<Step>('upload')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<LeadUploadPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string | null>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<LeadImportResult | null>(null)
  const [history, setHistory] = useState<LeadImportBatchSummary[]>([])
  const [showAllFields, setShowAllFields] = useState(false)

  useEffect(() => {
    leadImportService.listImports().then(setHistory).catch(() => {})
  }, [])

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const data = await leadImportService.upload(file)
      setPreview(data)
      setMapping(data.suggested_mapping)
      setStep('map')
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleImport = async () => {
    if (!preview) return
    setImporting(true)
    setError(null)
    try {
      const res = await leadImportService.confirmImport(preview.upload_id, mapping)
      setResult(res)
      setStep('result')
      leadImportService.listImports().then(setHistory).catch(() => {})
    } catch (err: any) {
      setError(err?.message || 'Import failed. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setStep('upload')
    setPreview(null)
    setMapping({})
    setResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-[#080615] text-[#F8F7FF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-5xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UploadCloud className="w-6 h-6 text-sky-400" />
            <h1 className="text-2xl font-bold tracking-tight">Lead List Import</h1>
          </div>
          <p className="text-sm text-gray-400">
            Upload a lead list you've found elsewhere (CSV or XLSX, any column headers), map its columns to
            Organizations &amp; Contacts, and sync it straight into the CRM.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {step === 'upload' && (
          <label className="flex flex-col items-center justify-center gap-3 p-16 rounded-2xl border-2 border-dashed border-white/10 bg-[#131127]/60 cursor-pointer hover:border-sky-500/40 transition-all">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8 text-gray-500" />
            )}
            <span className="text-sm text-gray-400">
              {uploading ? 'Parsing file…' : 'Click to choose a .csv or .xlsx lead list (max 10MB)'}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xlsm"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </label>
        )}

        {step === 'map' && preview && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-[#131127]/60 border border-white/5 text-sm text-gray-300">
              <span className="font-semibold text-white">{preview.filename}</span> — {preview.total_rows} row(s)
              detected. Map each CRM field to a column from your file, or leave it unmapped to skip it.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-[#131127]/60 border border-white/5">
              {preview.target_fields
                .filter((field) => showAllFields || mapping[field] || field === 'org_name')
                .map((field) => (
                  <div key={field}>
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 block">
                      {TARGET_FIELD_LABELS[field] || field}
                    </label>
                    <select
                      value={mapping[field] || ''}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [field]: e.target.value || null }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#0c0a1f] border border-white/10 text-sm focus:outline-none focus:border-sky-500/50"
                    >
                      <option value="">— Not mapped —</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
            {!showAllFields && (
              <button
                onClick={() => setShowAllFields(true)}
                className="text-xs text-sky-400 hover:text-sky-300 transition-all"
              >
                + Map more fields ({preview.target_fields.filter((f) => !mapping[f] && f !== 'org_name').length} unmapped)
              </button>
            )}

            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-xs">
                <thead className="bg-[#131127]">
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview_rows.map((row, i) => (
                    <tr key={i} className="border-t border-white/5">
                      {preview.headers.map((h) => (
                        <td key={h} className="px-3 py-2 whitespace-nowrap text-gray-300">
                          {row[h] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleImport}
                disabled={importing || !mapping.org_name}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold transition-all"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {importing ? 'Importing…' : `Import ${preview.total_rows} row(s)`}
              </button>
              <button
                onClick={reset}
                disabled={importing}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              {!mapping.org_name && (
                <span className="text-xs text-amber-400">Map "Organization Name" to continue.</span>
              )}
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Import complete — synced to the CRM (and Google Sheets, if configured).
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                ['Total Rows', result.total_rows],
                ['Orgs Created', result.organizations_created],
                ['Orgs Matched', result.organizations_matched],
                ['Contacts Created', result.contacts_created],
                ['Skipped', result.skipped_count],
              ].map(([label, value]) => (
                <div key={label as string} className="p-4 rounded-xl bg-[#131127]/60 border border-white/5 text-center">
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-gray-400 mt-1">{label}</div>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-300 space-y-1 max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-semibold transition-all"
            >
              Import Another List
            </button>
          </div>
        )}

        {history.length > 0 && (
          <div className="space-y-3 pt-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
              <History className="w-4 h-4" />
              Past Imports
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-xs">
                <thead className="bg-[#131127]">
                  <tr>
                    {['File', 'Rows', 'Orgs Created', 'Contacts Created', 'Skipped', 'When'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((b) => (
                    <tr key={b.id} className="border-t border-white/5 text-gray-300">
                      <td className="px-3 py-2 whitespace-nowrap">{b.filename}</td>
                      <td className="px-3 py-2">{b.total_rows}</td>
                      <td className="px-3 py-2">{b.organizations_created}</td>
                      <td className="px-3 py-2">{b.contacts_created}</td>
                      <td className="px-3 py-2">{b.skipped_count}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default LeadImportPage
