import React, { useEffect, useState } from 'react'
import Navbar from '../../components/layout/Navbar'
import { campaignService } from '../../services/campaigns'
import type { OutreachTrackerResponse } from '../../types/campaign'
import { Activity, Mail, MousePointerClick, MessageSquare, Loader2, AlertCircle, RotateCw } from 'lucide-react'

const StatusPill: React.FC<{ item: OutreachTrackerResponse['items'][number] }> = ({ item }) => {
  if (item.replied_at) {
    return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Replied</span>
  }
  if (item.clicked_at) {
    return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">Clicked</span>
  }
  if (item.opened_at) {
    return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">Opened</span>
  }
  return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-500/15 text-gray-400 border border-gray-500/30">Sent</span>
}

export const OutreachTrackerPage: React.FC = () => {
  const [data, setData] = useState<OutreachTrackerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await campaignService.getOutreachTracker()
      setData(res)
    } catch (err: any) {
      setError(err?.message || 'Failed to load outreach tracker.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#080615] text-[#F8F7FF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight">Outreach Tracker</h1>
            </div>
            <p className="text-sm text-gray-400">
              Sent, opened, clicked and replied status for every campaign email — live from the Gmail
              tracking pixel and click-through links embedded in each send.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-gray-300 hover:text-white transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Sent', value: String(data.summary.total_sent), Icon: Mail, color: 'text-gray-300' },
              { label: 'Opened', value: `${data.summary.opened} (${data.summary.open_rate}%)`, Icon: Mail, color: 'text-sky-300' },
              { label: 'Clicked', value: `${data.summary.clicked} (${data.summary.click_rate}%)`, Icon: MousePointerClick, color: 'text-violet-300' },
              { label: 'Replied', value: `${data.summary.replied} (${data.summary.reply_rate}%)`, Icon: MessageSquare, color: 'text-emerald-300' },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="p-4 rounded-2xl bg-[#131127]/60 border border-white/5">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  {label}
                </div>
                <div className="text-2xl font-bold">{value}</div>
              </div>
            ))}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#131127]/60 border border-white/5 text-center text-sm text-gray-400">
            No campaign emails sent yet. Once a campaign sends, sends show up here with open/click/reply status.
          </div>
        ) : data ? (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-xs">
              <thead className="bg-[#131127]">
                <tr>
                  {['Status', 'Contact', 'Organization', 'Campaign', 'Subject', 'Sent', 'Opened', 'Clicked', 'Replied'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.campaign_contact_id} className="border-t border-white/5 text-gray-300">
                    <td className="px-3 py-2"><StatusPill item={item} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-medium text-white">{item.contact_name || '—'}</div>
                      <div className="text-gray-500">{item.contact_email}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{item.organization_name || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{item.campaign_name || '—'}</td>
                    <td className="px-3 py-2 max-w-[220px] truncate" title={item.subject_preview}>
                      {item.subject_preview || '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{item.sent_at ? new Date(item.sent_at).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {item.opened_at ? `${new Date(item.opened_at).toLocaleString()} (${item.open_count}x)` : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {item.clicked_at ? `${new Date(item.clicked_at).toLocaleString()} (${item.click_count}x)` : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {item.replied_at ? new Date(item.replied_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default OutreachTrackerPage
