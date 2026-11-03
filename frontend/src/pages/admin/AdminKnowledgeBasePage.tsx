import React, { useCallback, useEffect, useRef, useState } from 'react'
import AdminNavbar from '../../components/layout/AdminNavbar'
import { Dialog, Notice, buttonClass, type NoticeState } from '../../components/ui/Dialog'
import { knowledgeBaseService } from '../../services/knowledgeBase'
import type { KBDocument, KBSearchResult } from '../../types/knowledgeBase'
import { Upload, Search, Loader2, FileText, Link2 } from 'lucide-react'

function statusOf(doc: KBDocument): { dot: string; label: string; detail: string } {
  const chunks = doc.chunk_count ?? 0
  if (!doc.searchable || chunks === 0) {
    return { dot: 'bg-rose-400', label: 'Not searchable', detail: 'No text was stored. Delete it and upload the file again.' }
  }
  if (doc.search_mode === 'semantic_and_keyword') {
    return { dot: 'bg-emerald-400', label: 'Ready', detail: `${chunks} passages, searchable by meaning and keywords.` }
  }
  if (doc.search_mode === 'partial_semantic') {
    return {
      dot: 'bg-amber-400',
      label: 'Ready (partly)',
      detail: `${chunks} passages; ${doc.embedded_chunk_count} searchable by meaning, all by keywords.`,
    }
  }
  return {
    dot: 'bg-amber-400',
    label: 'Ready, keyword search only',
    detail: `${chunks} passages. Meaning-based search needs a working Gemini embedding key; matching words still work.`,
  }
}

export const AdminKnowledgeBasePage: React.FC = () => {
  const [documents, setDocuments] = useState<KBDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>(null)

  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KBSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [toDelete, setToDelete] = useState<KBDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setDocuments(await knowledgeBaseService.list())
    } catch (err: any) {
      setLoadError(err.detail || err.message || 'Sources could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !file) return
    setUploading(true)
    setNotice(null)
    try {
      const doc = await knowledgeBaseService.upload(title.trim(), file)
      const s = statusOf(doc)
      setNotice({
        kind: doc.searchable ? 'success' : 'error',
        text: doc.searchable
          ? `“${doc.title}” was added. ${s.detail} Ask ELLY can use it now.`
          : `“${doc.title}” was uploaded but no text could be stored, so Ask ELLY can’t use it.`,
      })
      setTitle('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchDocuments()
    } catch (err: any) {
      setNotice({ kind: 'error', text: `Upload failed: ${err.detail || err.message || 'unknown error'}. Check the file is plain text or Markdown under 2 MB.` })
    } finally {
      setUploading(false)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await knowledgeBaseService.delete(toDelete.id)
      setNotice({ kind: 'success', text: `“${toDelete.title}” was removed. Ask ELLY will no longer use it.` })
      setToDelete(null)
      fetchDocuments()
    } catch (err: any) {
      setNotice({ kind: 'error', text: err.detail || err.message || 'The source was not deleted.' })
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError(null)
    try {
      setResults(await knowledgeBaseService.search(query.trim()))
    } catch (err: any) {
      setSearchError(err.detail || err.message || 'Search failed.')
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  const ready = documents.filter((d) => d.searchable).length
  const input = 'px-3 py-2 rounded-lg bg-[#1A1040] border border-slate-700 text-white text-xs placeholder:text-slate-500'

  return (
    <div className="min-h-screen bg-[#0B0520] text-[#F0ECFF] md:pl-64">
      <AdminNavbar />
      <main className="p-6 max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-white">Knowledge Base</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Company information that Ask ELLY searches when a question may be answered by internal material, and quotes as its
            source. Everyone with BD access benefits through Ask ELLY; only admins can add or remove sources. Other AI features
            (email drafting, campaign personalisation) don’t read this yet.
          </p>
        </div>

        <Notice notice={notice} onDismiss={() => setNotice(null)} />

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            ['Sources', loading ? '…' : documents.length],
            ['Searchable by Ask ELLY', loading ? '…' : `${ready} of ${documents.length}`],
            ['Searchable by meaning', loading ? '…' : documents.filter((d) => d.search_mode === 'semantic_and_keyword').length],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-[#110B2E] border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">{label}</div>
              <div className="text-xl font-semibold text-white mt-1">{value}</div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <form onSubmit={handleUpload} className="bg-[#110B2E] border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-slate-400" /> Upload a document
            </h2>
            <label className="block text-xs text-slate-400 space-y-1">
              <span>Title</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Company overview 2026" className={`${input} w-full`} />
            </label>
            <label className="block text-xs text-slate-400 space-y-1">
              <span>File (plain text or Markdown, up to 2 MB)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className={`${input} w-full file:mr-3 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-slate-700 file:text-white file:text-xs`}
              />
            </label>
            <button type="submit" disabled={uploading || !title.trim() || !file} className={buttonClass.primary}>
              {uploading ? 'Uploading and indexing…' : 'Upload'}
            </button>
            <p className="text-[11px] text-slate-500">
              Only upload approved company material. PDFs, Word files and recordings aren’t supported.
            </p>
          </form>

          <div className="bg-[#110B2E] border border-slate-800 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-slate-400" /> Website and social links
            </h2>
            <p className="text-xs text-slate-300">Not available yet.</p>
            <p className="text-[11px] text-slate-500">
              Importing a company website or social profiles (such as Instagram) needs URL ingestion on the backend, which is
              being built separately. Until it lands, links can’t be added here and nothing is fetched from the web. To use that
              content now, paste approved text into a .txt or .md file and upload it.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="bg-[#110B2E] border border-slate-800 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">Test what Ask ELLY can find</h2>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Test search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a question someone might ask Ask ELLY"
                className={`${input} w-full pl-9`}
              />
            </div>
            <button type="submit" disabled={searching || !query.trim()} className={buttonClass.secondary}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {searchError && <p className="text-xs text-rose-300">{searchError}</p>}
          {results && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              {results.length === 0 ? (
                <p className="text-xs text-slate-400">No matching passages. Ask ELLY would say this isn’t documented.</p>
              ) : (
                results.map((r, i) => (
                  <div key={i} className="bg-[#1A1040]/70 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1 text-[11px]">
                      <span className="font-medium text-slate-200">{r.document_title || 'Untitled source'}</span>
                      <span className="text-slate-500">match {r.score}</span>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap">{r.chunk_text}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </form>

        <section className="bg-[#110B2E] border border-slate-800 rounded-xl overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold text-white">Sources</h2>
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-slate-400 px-4 pb-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading sources…
            </p>
          ) : loadError ? (
            <p className="text-xs text-rose-300 px-4 pb-4">
              {loadError}{' '}
              <button onClick={fetchDocuments} className="underline">
                Retry
              </button>
            </p>
          ) : documents.length === 0 ? (
            <p className="text-xs text-slate-400 px-4 pb-6">No sources yet. Ask ELLY has no company material to search.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1A1040] text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Title</th>
                    <th className="px-4 py-2.5 font-medium">File</th>
                    <th className="px-4 py-2.5 font-medium">Status for Ask ELLY</th>
                    <th className="px-4 py-2.5 font-medium">Added</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {documents.map((doc) => {
                    const s = statusOf(doc)
                    return (
                      <tr key={doc.id} className="hover:bg-white/5 align-top">
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2 font-medium text-white">
                            <FileText className="w-3.5 h-3.5 text-slate-400" /> {doc.title}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">{doc.source || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-slate-200">
                            <span className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.label}
                          </span>
                          <div className="text-[11px] text-slate-500 max-w-xs">{s.detail}</div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                          {new Date(doc.created_at).toLocaleDateString()}
                          {doc.created_by_name && <div className="text-[11px] text-slate-500">by {doc.created_by_name}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => setToDelete(doc)} className="px-2.5 py-1 rounded-md border border-rose-500/40 text-rose-200 hover:border-rose-400">
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <Dialog
        open={!!toDelete}
        title={`Delete “${toDelete?.title ?? ''}”?`}
        onClose={() => !deleting && setToDelete(null)}
        footer={
          <>
            <button className={buttonClass.secondary} onClick={() => setToDelete(null)} disabled={deleting}>
              Cancel
            </button>
            <button className={buttonClass.danger} onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete source'}
            </button>
          </>
        }
      >
        <p>Its passages are removed and Ask ELLY stops using them straight away. This can’t be undone.</p>
      </Dialog>
    </div>
  )
}
export default AdminKnowledgeBasePage
