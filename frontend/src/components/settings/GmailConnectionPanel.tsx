import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dialog, Notice, buttonClass, type NoticeState } from '../ui/Dialog'
import { gmailService, type DeliverabilityHealth } from '../../services/gmail'
import type { GmailAccount } from '../../types/campaign'
import { Loader2, Mail } from 'lucide-react'

const Card: React.FC<{ title: string; children: React.ReactNode; note?: string }> = ({ title, children, note }) => (
  <section className="bg-[#110B2E] border border-slate-800 rounded-xl p-5 space-y-3">
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {note && <p className="text-[11px] text-slate-500 mt-0.5">{note}</p>}
    </div>
    {children}
  </section>
)

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="grid grid-cols-[140px_1fr] gap-3 text-xs">
    <span className="text-slate-400">{label}</span>
    <span className="text-slate-200">{value}</span>
  </div>
)

/** Gmail is connected per person; this is the only place to connect, reconnect or disconnect it. */
export const GmailConnectionPanel: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [accounts, setAccounts] = useState<GmailAccount[] | null>(null)
  const [health, setHealth] = useState<DeliverabilityHealth[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [busy, setBusy] = useState(false)
  const [toDisconnect, setToDisconnect] = useState<GmailAccount | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const list = await gmailService.listAccounts()
      setAccounts(list)
      if (list.length) setHealth(await gmailService.getDeliverability().catch(() => []))
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Gmail status could not be loaded.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Returning from Google's consent screen.
  useEffect(() => {
    const result = searchParams.get('gmail')
    if (!result || result === 'manage') return // 'manage' only opens the panel
    setNotice(
      result === 'connected'
        ? { kind: 'success', text: 'Gmail connected. Outreach and campaign emails will be sent from this account.' }
        : { kind: 'error', text: 'Gmail was not connected. Please try again.' },
    )
    searchParams.delete('gmail')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, setSearchParams])

  const connect = async () => {
    setBusy(true)
    try {
      const { authorization_url } = await gmailService.getAuthUrl()
      window.location.href = authorization_url // same OAuth flow as before; Google returns to ELLY afterwards
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.detail || 'Could not start the Gmail connection. Ask an admin to check the Gmail OAuth setup.' })
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!toDisconnect) return
    setBusy(true)
    try {
      await gmailService.disconnect(toDisconnect.id)
      setNotice({ kind: 'success', text: `${toDisconnect.email} was disconnected. ELLY can’t send email for you until you connect again.` })
      setToDisconnect(null)
      load()
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.detail || 'Gmail was not disconnected.' })
      setToDisconnect(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Gmail" note="Outreach and campaign emails are sent only from your own connected Gmail account.">
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      {error ? (
        <p className="text-xs text-rose-300">
          {error}{' '}
          <button onClick={load} className="underline">
            Retry
          </button>
        </p>
      ) : !accounts ? (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking your Gmail connection…
        </p>
      ) : accounts.length === 0 ? (
        <div className="space-y-3">
          <Row label="Status" value={<span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500" />Not connected</span>} />
          <button onClick={connect} disabled={busy} className={buttonClass.primary}>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {busy ? 'Opening Google…' : 'Connect Gmail'}
            </span>
          </button>
          <p className="text-[11px] text-slate-500">
            Google’s consent screen opens in this tab. ELLY asks only for permission to send email and read replies.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((a) => {
            const h = health.find((x) => x.account_id === a.id)
            return (
              <div key={a.id} className="border border-slate-800 rounded-lg p-3 space-y-2">
                <Row label="Status" value={<span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${a.is_active ? 'bg-emerald-400' : 'bg-amber-400'}`} />{a.is_active ? 'Connected' : 'Connected, but inactive'}</span>} />
                <Row label="Sending as" value={a.email} />
                <Row label="Connected on" value={new Date(a.created_at).toLocaleDateString()} />
                {h && (
                  <Row
                    label="Deliverability"
                    value={`${h.status.replace('_', ' ')} · ${h.sent} sent · ${h.bounce_rate}% bounced · ${h.reply_rate}% replied`}
                  />
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={connect} disabled={busy} className={buttonClass.secondary}>
                    Reconnect
                  </button>
                  <button onClick={() => setToDisconnect(a)} disabled={busy} className="px-4 py-2 rounded-lg border border-rose-500/40 text-rose-200 hover:border-rose-400 text-xs">
                    Disconnect
                  </button>
                </div>
              </div>
            )
          })}
          <p className="text-[11px] text-slate-500">Reconnect if sending stops working or Google asks you to sign in again.</p>
        </div>
      )}
      <Dialog
        open={!!toDisconnect}
        title={`Disconnect ${toDisconnect?.email ?? ''}?`}
        onClose={() => !busy && setToDisconnect(null)}
        footer={
          <>
            <button className={buttonClass.secondary} onClick={() => setToDisconnect(null)} disabled={busy}>
              Cancel
            </button>
            <button className={buttonClass.danger} onClick={disconnect} disabled={busy}>
              {busy ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </>
        }
      >
        <p>ELLY will stop sending outreach and campaign email from this account until you connect again. Sent history is kept.</p>
      </Dialog>
    </Card>
  )
}

export default GmailConnectionPanel
