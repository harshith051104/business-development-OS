import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { campaignService } from '../../services/campaigns';
import type { Campaign, CampaignContact, CampaignPreviewResponse, CampaignRoiFunnel } from '../../types/campaign';
import Navbar from '../../components/layout/Navbar';
import { 
  Send, 
  ArrowLeft, 
  Play, 
  Pause, 
  Trash2, 
  Clock, 
  Users, 
  Mail, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Building2, 
  User, 
  RefreshCw,
  Eye,
  Check,
  ShieldCheck,
  DollarSign,
  Briefcase,
  Layers,
  ArrowRight,
  Plus,
  Pencil,
  X,
  Save
} from 'lucide-react';

export const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const campaignId = parseInt(id || '0', 10);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [roiFunnel, setRoiFunnel] = useState<CampaignRoiFunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [preview, setPreview] = useState<CampaignPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [editableSubject, setEditableSubject] = useState('');
  const [editableBodyHtml, setEditableBodyHtml] = useState('');
  const [convertingOpp, setConvertingOpp] = useState(false);
  const [editingSequence, setEditingSequence] = useState(false);
  const [editedSteps, setEditedSteps] = useState<any[]>([]);
  const [savingSequence, setSavingSequence] = useState(false);

  useEffect(() => {
    loadCampaign();
  }, [campaignId]);

  const loadCampaign = async () => {
    try {
      setLoading(true);
      const [cData, rData] = await Promise.all([
        campaignService.get(campaignId),
        campaignService.getRoiFunnel(campaignId).catch(() => null),
      ]);
      setCampaign(cData);
      setRoiFunnel(rData);
      if (cData.campaign_contacts && cData.campaign_contacts.length > 0 && !selectedContactId) {
        setSelectedContactId(cData.campaign_contacts[0].contact_id);
        fetchPreview(cData.campaign_contacts[0].contact_id, cData.campaign_contacts[0].current_step_number);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async (contactId: number, stepNum: number = 1, force: boolean = false) => {
    try {
      setPreviewLoading(true);
      const prev = await campaignService.preview(campaignId, contactId, {
        contact_id: contactId,
        step_number: stepNum,
        force_regenerate: force,
      });
      setPreview(prev);
      setEditableSubject(prev.subject);
      setEditableBodyHtml(prev.body_html);
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSelectContact = (c: CampaignContact) => {
    setSelectedContactId(c.contact_id);
    fetchPreview(c.contact_id, c.current_step_number);
  };

  const handleToggleStatus = async () => {
    if (!campaign) return;
    try {
      if (campaign.status === 'Active') {
        await campaignService.pause(campaign.id);
      } else {
        await campaignService.start(campaign.id);
      }
      loadCampaign();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await campaignService.delete(campaignId);
      navigate('/business-development/campaigns');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendReviewed = async () => {
    if (!selectedContactId) return;
    try {
      setSending(true);
      await campaignService.sendStepEmail(campaignId, selectedContactId, {
        subject: editableSubject,
        body_html: editableBodyHtml,
      });
      setSendModalOpen(false);
      loadCampaign();
      if (selectedContactId) {
        fetchPreview(selectedContactId, 1);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  const handleSimulateReply = async (contactId: number) => {
    try {
      await campaignService.simulateReply(contactId, {
        campaign_id: campaignId,
        reply_subject: 'Re: Collaboration Opportunity',
        reply_snippet: 'We reviewed your solution and would like to schedule a demonstration with our evaluation team next week.',
      });
      loadCampaign();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateOpportunity = async (contactId: number) => {
    const cc = campaign?.campaign_contacts?.find(c => c.contact_id === contactId);
    if (!cc) return;
    try {
      setConvertingOpp(true);
      const res = await campaignService.createOpportunity(cc.id);
      alert(`Success! Commercial Opportunity '${res.opportunity_name}' is now active in the Pipeline Board.`);
      loadCampaign();
    } catch (err) {
      console.error(err);
      alert('Failed to create Opportunity from campaign contact.');
    } finally {
      setConvertingOpp(false);
    }
  };

  const startEditSequence = () => {
    setEditedSteps(campaign?.sequence_steps?.map(s => ({ ...s })) || []);
    setEditingSequence(true);
  };

  const handleAddStep = () => {
    const lastDelay = editedSteps[editedSteps.length - 1]?.delay_days || 0;
    setEditedSteps([
      ...editedSteps,
      {
        step_number: editedSteps.length + 1,
        delay_days: lastDelay + 7,
        channel: 'Email',
        subject_template: `Check-in: {{organization_name}} - Step ${editedSteps.length + 1}`,
        body_template: `Hi {{first_name}},\n\n{{opening_hook}}\n\n{{cta}}\n\nBest,\n{{sender_name}}`,
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    if (editedSteps.length <= 1) return;
    setEditedSteps(editedSteps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  const handleUpdateStep = (index: number, field: string, val: any) => {
    const updated = [...editedSteps];
    updated[index] = { ...updated[index], [field]: val };
    setEditedSteps(updated);
  };

  const handleSaveSequence = async () => {
    if (!campaign) return;
    try {
      setSavingSequence(true);
      await campaignService.update(campaign.id, { sequence_steps: editedSteps });
      setEditingSequence(false);
      await loadCampaign();
    } catch (err) {
      console.error(err);
      alert('Failed to save sequence.');
    } finally {
      setSavingSequence(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080615] text-[#F8F7FF] pb-24 md:pl-64">
        <Navbar />
        <div className="p-12 text-center text-gray-400">Loading campaign details...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#080615] text-[#F8F7FF] pb-24 md:pl-64">
        <Navbar />
        <div className="p-12 text-center text-gray-400">Campaign not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080615] text-[#F8F7FF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/business-development/campaigns')}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Campaigns List
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">{campaign.name}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                campaign.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                campaign.status === 'Paused' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                'bg-gray-500/10 text-gray-400 border-gray-500/20'
              }`}>
                {campaign.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{campaign.description || 'Targeting commercial leaders with multi-step sequence.'}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleStatus}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all ${
                campaign.status === 'Active'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              {campaign.status === 'Active' ? <><Pause className="w-4 h-4" /> Pause Campaign</> : <><Play className="w-4 h-4" /> Activate Campaign</>}
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-950/20 border border-white/5 rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Commercial ROI & Full-Funnel Dashboard */}
        {roiFunnel && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[#131127] via-[#100E26] to-[#0D0B1E] border border-purple-500/20 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-bold text-white tracking-wide">Full Commercial Funnel & ROI Attribution</h2>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="text-gray-300">
                  Pipeline Generated: <span className="font-bold text-purple-300">₹{roiFunnel.total_pipeline_value?.toLocaleString()}</span>
                </div>
                <div className="text-gray-300">
                  Revenue Won: <span className="font-bold text-emerald-400">₹{roiFunnel.total_revenue_won?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              <div className="p-3 rounded-xl bg-[#0D0B1E] border border-white/5 text-center">
                <div className="text-[10px] uppercase font-semibold text-gray-400">1. Leads</div>
                <div className="text-base font-bold text-white mt-0.5">{roiFunnel.leads_enrolled}</div>
                <div className="text-[9px] text-gray-500">Enrolled</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0D0B1E] border border-white/5 text-center">
                <div className="text-[10px] uppercase font-semibold text-gray-400">2. Sent</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">{roiFunnel.emails_sent}</div>
                <div className="text-[9px] text-emerald-500/80">Gmail</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0D0B1E] border border-white/5 text-center">
                <div className="text-[10px] uppercase font-semibold text-gray-400">3. Opened</div>
                <div className="text-base font-bold text-blue-400 mt-0.5">{roiFunnel.emails_opened}</div>
                <div className="text-[9px] text-blue-400/80">{roiFunnel.sent_to_open_pct}% open</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0D0B1E] border border-white/5 text-center">
                <div className="text-[10px] uppercase font-semibold text-gray-400">4. Replies</div>
                <div className="text-base font-bold text-amber-400 mt-0.5">{roiFunnel.replies_received}</div>
                <div className="text-[9px] text-amber-400/80">{roiFunnel.open_to_reply_pct}% reply</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0D0B1E] border border-white/5 text-center">
                <div className="text-[10px] uppercase font-semibold text-gray-400">5. Meetings</div>
                <div className="text-base font-bold text-indigo-400 mt-0.5">{roiFunnel.meetings_scheduled}</div>
                <div className="text-[9px] text-indigo-400/80">{roiFunnel.reply_to_meeting_pct}% meet</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0D0B1E] border border-white/5 text-center">
                <div className="text-[10px] uppercase font-semibold text-gray-400">6. Opps</div>
                <div className="text-base font-bold text-purple-400 mt-0.5">{roiFunnel.opportunities_created}</div>
                <div className="text-[9px] text-purple-400/80">Commercial</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0D0B1E] border border-white/5 text-center">
                <div className="text-[10px] uppercase font-semibold text-gray-400">7. Proposals</div>
                <div className="text-base font-bold text-cyan-400 mt-0.5">{roiFunnel.proposals_sent}</div>
                <div className="text-[9px] text-cyan-400/80">Active</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0D0B1E] border border-emerald-500/30 bg-emerald-950/20 text-center">
                <div className="text-[10px] uppercase font-semibold text-emerald-300">8. Won Deals</div>
                <div className="text-base font-bold text-emerald-300 mt-0.5">{roiFunnel.deals_won}</div>
                <div className="text-[9px] text-emerald-400 font-bold">{roiFunnel.overall_lead_to_deal_pct}% close</div>
              </div>
            </div>
          </div>
        )}

        {/* Sequence Steps Timeline */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              Sequence Steps Timeline ({campaign.sequence_steps.length} Steps)
            </h2>
            {!editingSequence ? (
              <button
                onClick={startEditSequence}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-950/40 border border-purple-500/30 rounded-xl hover:bg-purple-900/50"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Sequence
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddStep}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-xl hover:bg-emerald-900/50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Step
                </button>
                <button
                  onClick={() => setEditingSequence(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-400 bg-gray-950/40 border border-gray-500/30 rounded-xl hover:bg-gray-900/50"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveSequence}
                  disabled={savingSequence}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 rounded-xl hover:bg-purple-500 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingSequence ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {!editingSequence ? (
            <div className="flex flex-wrap items-center gap-3">
              {campaign.sequence_steps.map((s, idx) => (
                <div key={s.id || idx} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0D0B1E] border border-white/10 text-xs">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-[10px]">
                      {s.step_number}
                    </span>
                    <span className="font-semibold text-white">
                      {s.step_number === 1 ? 'Initial Send (Day 0)' : `Follow-up (Day +${s.delay_days})`}
                    </span>
                  </div>
                  {idx < campaign.sequence_steps.length - 1 && <span className="text-gray-600">→</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {editedSteps.map((step, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[#0D0B1E] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                        {step.step_number}
                      </span>
                      <span className="text-sm font-bold text-white">
                        Step {step.step_number} ({step.step_number === 1 ? 'Initial Send' : `Follow-up after ${step.delay_days} days`})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-[#080615] px-3 py-1 rounded-lg border border-white/10">
                        <span className="text-xs text-gray-400">Delay:</span>
                        <input
                          type="number"
                          min="0"
                          value={step.delay_days}
                          onChange={(e) => handleUpdateStep(idx, 'delay_days', parseInt(e.target.value) || 0)}
                          className="w-12 bg-transparent text-xs text-purple-300 text-center font-bold outline-none"
                        />
                        <span className="text-xs text-gray-400">days</span>
                      </div>
                      {editedSteps.length > 1 && (
                        <button
                          onClick={() => handleRemoveStep(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-950/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 mb-1">Subject Template</label>
                    <input
                      type="text"
                      value={step.subject_template || ''}
                      onChange={(e) => handleUpdateStep(idx, 'subject_template', e.target.value)}
                      className="w-full bg-[#080615] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 mb-1">Body Template</label>
                    <textarea
                      rows={4}
                      value={step.body_template || ''}
                      onChange={(e) => handleUpdateStep(idx, 'body_template', e.target.value)}
                      className="w-full bg-[#080615] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-purple-500 leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Two Columns: Contact List + Live AI Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Enrolled Contacts */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Target Contacts ({campaign.campaign_contacts?.length || 0})
              </h2>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {campaign.campaign_contacts?.map((cc) => {
                const isSelected = cc.contact_id === selectedContactId;
                return (
                  <div
                    key={cc.id}
                    onClick={() => handleSelectContact(cc)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500 shadow-md'
                        : 'bg-[#131127] border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="text-sm font-bold text-white">{cc.contact_name || 'Contact'}</div>
                        <div className="text-xs text-gray-400">{cc.contact_role || 'Executive'} • <span className="text-purple-300">{cc.organization_name}</span></div>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        cc.status === 'Replied' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                        cc.status === 'Sent' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                        cc.status === 'Ready_For_Review' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      }`}>
                        {cc.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-white/5">
                      <span>Step {cc.current_step_number}</span>
                      <span className="text-purple-300 font-semibold">Score: {cc.personalization_score?.toFixed(0)}%</span>
                      {cc.status === 'Replied' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-medium">Auto-Paused</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateOpportunity(cc.contact_id);
                            }}
                            disabled={convertingOpp}
                            className="px-2 py-0.5 text-[10px] font-bold text-purple-200 bg-purple-900/60 border border-purple-400/40 rounded hover:bg-purple-800 transition-all"
                          >
                            + Create Opp
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSimulateReply(cc.contact_id);
                          }}
                          className="text-[10px] text-gray-500 hover:text-amber-300 underline"
                        >
                          Simulate Reply
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live AI Preview & Review Card */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-6 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-white">Live AI Personalization Preview</h3>
                </div>
                {preview && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Score:</span>
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-lg ${
                      preview.personalization_score >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      preview.personalization_score >= 60 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                      'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {preview.personalization_score.toFixed(0)} / 100
                    </span>
                    <button
                      onClick={() => selectedContactId && fetchPreview(selectedContactId, 1, true)}
                      title="Regenerate with fresh AI context"
                      className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded-lg"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )}
              </div>

              {previewLoading ? (
                <div className="p-12 text-center text-gray-400">Compiling personalized AI preview...</div>
              ) : preview ? (
                <div className="space-y-4">
                  {/* Validation status badge */}
                  {preview.is_valid ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Zero unresolved placeholders detected. Email is fully validated and ready for review.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-300">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>Validation warnings: {preview.validation_errors.join(', ')}</span>
                    </div>
                  )}

                  {/* Subject Line */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Subject</label>
                    <div className="p-3 rounded-xl bg-[#0D0B1E] border border-white/10 text-sm font-semibold text-white">
                      {preview.subject}
                    </div>
                  </div>

                  {/* Body HTML Rendered */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Rendered Email Body</label>
                    <div 
                      className="p-4 rounded-xl bg-white text-gray-900 text-sm shadow-inner overflow-y-auto max-h-72 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: preview.body_html }}
                    />
                  </div>

                  {/* AI Snippets Box */}
                  {preview.showcase_project_used && (
                    <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs space-y-1">
                      <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        Matched ELLY Showcase: {preview.showcase_project_used}
                      </div>
                      <div className="text-gray-400">Value Prop: {preview.ai_generated_fields?.ai_value_prop}</div>
                    </div>
                  )}

                  {/* Human Action Button */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                      Target: <span className="text-white font-semibold">{preview.contact_name}</span> ({preview.organization_name})
                    </div>
                    <button
                      onClick={() => {
                        setEditableSubject(preview.subject);
                        setEditableBodyHtml(preview.body_html);
                        setSendModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg shadow-purple-600/30 hover:from-purple-500 hover:to-indigo-500 transition-all"
                    >
                      <Send className="w-4 h-4" />
                      Review & Send via Gmail
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-400">Select a contact to view live AI personalization.</div>
              )}
            </div>
          </div>
        </div>

        {/* HUMAN-IN-THE-LOOP REVIEW & SEND MODAL */}
        {sendModalOpen && preview && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#131127] border border-purple-500/30 rounded-2xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-bold text-white">Human-in-the-Loop Send Confirmation</h3>
                </div>
                <button
                  onClick={() => setSendModalOpen(false)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Subject Line</label>
                  <input
                    type="text"
                    value={editableSubject}
                    onChange={(e) => setEditableSubject(e.target.value)}
                    className="w-full bg-[#0D0B1E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Email HTML Body (Editable)</label>
                  <textarea
                    rows={8}
                    value={editableBodyHtml}
                    onChange={(e) => setEditableBodyHtml(e.target.value)}
                    className="w-full bg-[#0D0B1E] font-mono text-xs border border-white/10 rounded-xl p-4 text-gray-200 focus:outline-none focus:border-purple-500 leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <button
                  onClick={() => setSendModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendReviewed}
                  disabled={sending}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-lg hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {sending ? 'Sending via Gmail...' : 'Confirm & Send Email'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CampaignDetailPage;
