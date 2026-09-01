import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { campaignService } from '../../services/campaigns';
import { gmailService } from '../../services/gmail';
import type { Campaign, GmailAccount } from '../../types/campaign';
import Navbar from '../../components/layout/Navbar';
import { 
  Send, 
  Plus, 
  Search, 
  Play, 
  Pause, 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  TrendingUp, 
  Users, 
  Building2, 
  Clock,
  ExternalLink,
  Sparkles
} from 'lucide-react';

export const CampaignsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cData, gData] = await Promise.all([
        campaignService.list(statusFilter !== 'All' ? { status: statusFilter } : undefined),
        gmailService.listAccounts().catch(() => []),
      ]);
      setCampaigns(cData);
      setGmailAccounts(gData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, c: Campaign) => {
    e.stopPropagation();
    try {
      if (c.status === 'Active') {
        await campaignService.pause(c.id);
      } else {
        await campaignService.start(c.id);
      }
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const [syncing, setSyncing] = useState(false);

  const handleSyncReplies = async () => {
    try {
      setSyncing(true);
      const res = await gmailService.syncReplies();
      alert(`Reply Sync Complete: ${res.replies_detected} new reply(s) detected across ${res.synced_active_threads} active threads.`);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to sync replies.');
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      const { authorization_url } = await gmailService.getAuthUrl();
      window.location.href = authorization_url;
    } catch (err) {
      console.error(err);
    }
  };

  // Aggregate stats
  const totalContacts = campaigns.reduce((acc, c) => acc + (c.stats?.total_contacts || 0), 0);
  const totalSent = campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0);
  const totalReplied = campaigns.reduce((acc, c) => acc + (c.stats?.replied || 0), 0);
  const avgReplyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : '0.0';

  const filtered = campaigns.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.description && c.description.toLowerCase().includes(search.toLowerCase())) ||
    (c.target_industry && c.target_industry.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#080615] text-[#F8F7FF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Send className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl font-bold tracking-tight">Outreach Campaigns</h1>
            </div>
            <p className="text-sm text-gray-400">
              Multi-step AI-personalized outbound sequences with verified contact targeting and reply detection.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncReplies}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl hover:bg-amber-900/50 transition-all disabled:opacity-50"
            >
              <Clock className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Checking Inbox...' : 'Sync Replies'}
            </button>
            {gmailAccounts.length === 0 ? (
              <button
                onClick={handleConnectGmail}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-300 bg-purple-950/40 border border-purple-500/30 rounded-xl hover:bg-purple-900/50 transition-all"
              >
                <Mail className="w-4 h-4 text-purple-400" />
                Connect Gmail
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Gmail: {gmailAccounts[0].email}
              </div>
            )}
            <Link
              to="/business-development/campaigns/new"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg hover:from-purple-500 hover:to-indigo-500 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </Link>
          </div>
        </div>

        {/* Aggregate Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Campaigns</span>
              <Send className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">{campaigns.filter(c => c.status === 'Active').length}</div>
            <div className="text-xs text-gray-400 mt-1">{campaigns.length} total campaigns configured</div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Target Contacts</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{totalContacts}</div>
            <div className="text-xs text-gray-400 mt-1">Enrolled across all sequences</div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Emails Delivered</span>
              <Mail className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">{totalSent}</div>
            <div className="text-xs text-gray-400 mt-1">Via Gmail API</div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Replies & Meetings</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">{totalReplied} <span className="text-sm font-normal text-gray-400">({avgReplyRate}%)</span></div>
            <div className="text-xs text-emerald-400 mt-1">Automated sequence auto-pausing active</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#131127]/60 border border-white/5">
          <div className="flex items-center gap-2 flex-1 max-w-md bg-[#0D0B1E] px-3 py-2 rounded-xl border border-white/5">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search campaigns, targets, or industry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            {['All', 'Active', 'Draft', 'Paused', 'Completed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-gray-400 hover:text-white bg-white/5'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Campaign Cards Grid */}
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading outreach campaigns...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#131127]/40 border border-white/5 space-y-4">
            <Send className="w-10 h-10 text-gray-600 mx-auto" />
            <div className="text-lg font-semibold text-gray-300">No campaigns found</div>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Create your first multi-step outreach sequence to reach enterprise leaders with AI personalized messaging.
            </p>
            <Link
              to="/business-development/campaigns/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-xl hover:bg-purple-500 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create First Campaign
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/business-development/campaigns/${c.id}`)}
                className="group p-6 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 hover:border-purple-500/40 shadow-xl cursor-pointer transition-all relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">{c.name}</h3>
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                        c.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        c.status === 'Paused' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{c.description || 'Targeting commercial enterprise leaders with multi-step sequence.'}</p>
                  </div>

                  <button
                    onClick={(e) => handleToggleStatus(e, c)}
                    title={c.status === 'Active' ? 'Pause Campaign' : 'Activate Campaign'}
                    className={`p-2 rounded-xl border transition-all ${
                      c.status === 'Active'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    {c.status === 'Active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>

                {/* Steps and Industry badges */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex items-center gap-1 text-xs text-purple-300 bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-500/20">
                    <Clock className="w-3 h-3" />
                    {c.sequence_steps.length} Sequence Steps
                  </span>
                  {c.target_industry && (
                    <span className="flex items-center gap-1 text-xs text-blue-300 bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-500/20">
                      <Building2 className="w-3 h-3" />
                      {c.target_industry}
                    </span>
                  )}
                </div>

                {/* Performance stats mini-bar */}
                <div className="grid grid-cols-4 gap-2 pt-4 border-t border-white/5 text-center">
                  <div>
                    <div className="text-xs text-gray-400">Contacts</div>
                    <div className="text-sm font-bold text-white">{c.stats?.total_contacts || 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Sent</div>
                    <div className="text-sm font-bold text-emerald-400">{c.stats?.sent || 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Replies</div>
                    <div className="text-sm font-bold text-amber-400">{c.stats?.replied || 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Reply %</div>
                    <div className="text-sm font-bold text-purple-400">{c.stats?.reply_rate || 0}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CampaignsListPage;
