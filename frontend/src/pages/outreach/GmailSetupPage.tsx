import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { gmailService } from '../../services/gmail'
import type { GmailStatus, DeliverabilityHealth } from '../../services/gmail'
import { Mail, CheckCircle2, AlertCircle, ExternalLink, RotateCw, Shield, Activity } from 'lucide-react'

export default function GmailSetupPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [health, setHealth] = useState<DeliverabilityHealth[]>([])

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    setLoading(true)
    try {
      const s = await gmailService.getStatus()
      setStatus(s)
      if (s.connected) {
        try {
          const h = await gmailService.getDeliverability()
          setHealth(h)
        } catch {
          setHealth([])
        }
      }
    } catch {
      setStatus({ connected: false, sender_email: '', message: 'Failed to check Gmail status.' })
    }
    setLoading(false)
  }

  async function handleConnect() {
    setConnecting(true)
    try {
      const { auth_url } = await gmailService.getAuthUrl()
      // Open OAuth consent in new window
      window.open(auth_url, '_blank', 'width=600,height=700')
      // Poll status after a delay
      setTimeout(loadStatus, 3000)
    } catch (err: any) {
      alert(err.detail || 'Failed to get auth URL. Check GMAIL_CREDENTIALS_FILE in .env')
    }
    setConnecting(false)
  }

  return (
    <div className="min-h-screen bg-[#0A071B] text-[#F0ECFF] flex flex-col md:pl-64">
      <Navbar />

      <header className="px-6 py-4 border-b border-slate-800/80 bg-[#110B2E]">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-600/30">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Gmail Integration</h1>
            <p className="text-xs text-slate-400">Connect your Gmail account to send emails directly from ELLY</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-2xl w-full mx-auto space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RotateCw className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Status Card */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center space-x-3">
                {status?.connected ? (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="w-6 h-6 text-amber-400" />
                  </div>
                )}
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {status?.connected ? 'Gmail Connected' : 'Gmail Not Connected'}
                  </h2>
                  <p className="text-xs text-slate-400">{status?.message}</p>
                </div>
              </div>

              {status?.connected && status.sender_email && (
                <div className="p-3 rounded-xl bg-[#1A1040]/70 border border-slate-800 text-xs">
                  <span className="text-slate-400">Sending as: </span>
                  <span className="text-white font-mono">{status.sender_email}</span>
                </div>
              )}
            </div>

            {/* Deliverability Health */}
            {status?.connected && health.length > 0 && health.map((h) => (
              <div key={h.account_id} className="bg-[#110B2E] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-violet-400" />
                    <h3 className="text-sm font-bold text-white">Deliverability Health</h3>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${
                      h.status === 'healthy'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : h.status === 'at_risk'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {h.status.replace('_', ' ')} · {h.health_score}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 rounded-xl bg-[#1A1040]/70 border border-slate-800">
                    <div className="text-sm font-bold text-white">{h.sent}</div>
                    <div className="text-[10px] text-slate-500">Sent</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#1A1040]/70 border border-slate-800">
                    <div className="text-sm font-bold text-white">{h.bounce_rate}%</div>
                    <div className="text-[10px] text-slate-500">Bounce rate</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#1A1040]/70 border border-slate-800">
                    <div className="text-sm font-bold text-white">{h.reply_rate}%</div>
                    <div className="text-[10px] text-slate-500">Reply rate</div>
                  </div>
                </div>
              </div>
            ))}

            {/* Connect Button */}
            {!status?.connected && (
              <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white">Connect Gmail Account</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Authorize ELLY to send emails on your behalf using your Gmail account.
                  Your credentials are stored locally and never shared.
                </p>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start space-x-2">
                  <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    ELLY requests only <strong>send</strong> and <strong>read</strong> permissions.
                    It cannot modify your inbox, delete emails, or access settings.
                  </span>
                </div>

                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-violet-600/30 disabled:opacity-50"
                >
                  {connecting ? (
                    <RotateCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  <span>{connecting ? 'Opening Google...' : 'Connect Gmail Account'}</span>
                </button>

                <p className="text-[10px] text-slate-500 text-center">
                  A Google OAuth consent screen will open. Sign in with the Gmail account you want to use for outreach.
                </p>
              </div>
            )}

            {/* What you can do */}
            {status?.connected && (
              <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                <h3 className="text-sm font-bold text-white">What ELLY Can Do</h3>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Send personalized outreach emails directly from ELLY</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Track sent emails and check for replies</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Use templates with auto-filled placeholders</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Continue using Google Calendar + Meet integration</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/business-development/outreach')}
                  className="mt-3 w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition"
                >
                  Go to Outreach Workspace
                </button>
              </div>
            )}

            {/* Setup instructions */}
            <div className="bg-[#110B2E] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-white">Setup Instructions (One-Time)</h3>
              <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-violet-400 underline">Google Cloud Console</a></li>
                <li>Create OAuth 2.0 Client ID (Web Application)</li>
                <li>Add <code className="bg-slate-800 px-1.5 py-0.5 rounded text-violet-300">http://localhost:8001/api/gmail/auth/callback</code> to authorized redirect URIs</li>
                <li>Enable Gmail API in the API Library</li>
                <li>Download credentials JSON and set <code className="bg-slate-800 px-1.5 py-0.5 rounded text-violet-300">GMAIL_CREDENTIALS_FILE</code> in <code className="bg-slate-800 px-1.5 py-0.5 rounded text-violet-300">.env</code></li>
                <li>Restart backend and click "Connect Gmail Account" above</li>
              </ol>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
