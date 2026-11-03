import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import { campaignService } from '../../services/campaigns'
import type { Campaign } from '../../types/campaign'
import { Send, Loader2, Mail, TrendingUp, DollarSign } from 'lucide-react'

export const FundingCampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    campaignService
      .list()
      .then((all) => setCampaigns(all.filter((c) => c.category === 'funding')))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false))
  }, [])

  const totalSent = campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0)
  const totalReplied = campaigns.reduce((acc, c) => acc + (c.stats?.replied || 0), 0)

  return (
    <div className="min-h-screen bg-[#080615] text-[#F8F7FF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight">Funding Campaigns</h1>
            </div>
            <p className="text-sm text-gray-400">
              Investor outreach sent with no approval step, via Find Investors.
            </p>
          </div>
          <Link
            to="/business-development/funding"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-lg hover:from-emerald-500 hover:to-teal-500 transition-all"
          >
            <Send className="w-4 h-4" />
            Find Investors
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#131127]/60 border border-white/5 text-center text-sm text-gray-400">
            No funding campaigns yet. Go to Find Investors to search and send your first outreach.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 shadow-xl">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Emails Sent</span>
                  <Mail className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white">{totalSent}</div>
              </div>
              <div className="p-5 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 shadow-xl">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Replies</span>
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white">{totalReplied}</div>
              </div>
            </div>

            <div className="space-y-2">
              {campaigns.map((c) => (
                <Link
                  key={c.id}
                  to={`/business-development/campaigns/${c.id}`}
                  className="flex items-center justify-between p-4 rounded-xl bg-[#131127]/60 border border-white/5 hover:border-emerald-500/30 transition-all"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{c.name}</div>
                    <div className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {c.stats?.sent || 0} sent · {c.stats?.replied || 0} replied
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default FundingCampaignsPage
