import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignService } from '../../services/campaigns';
import { gmailService } from '../../services/gmail';
import { api } from '../../services/api';
import type { CampaignSequenceStep, GmailAccount } from '../../types/campaign';
import Navbar from '../../components/layout/Navbar';
import { 
  Send, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Users, 
  Layers, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export const CampaignNewPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'details' | 'contacts' | 'sequence' | 'review'>('details');
  const [loading, setLoading] = useState(false);
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccount[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [contactSearch, setContactSearch] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    target_industry: 'Healthcare',
    gmail_account_id: '',
    sender_email: '',
  });

  const [sequenceSteps, setSequenceSteps] = useState<CampaignSequenceStep[]>([
    {
      step_number: 1,
      delay_days: 0,
      channel: 'Email',
      subject_template: 'Collaboration with {{organization_name}} & ELLY',
      body_template: `Hi {{first_name}},

{{opening_hook}}

{{relevant_problem}}

{{ai_value_prop}}

{{cta}}

Best regards,
{{sender_name}}
{{sender_email}}`,
    },
    {
      step_number: 2,
      delay_days: 3,
      channel: 'Email',
      subject_template: 'Quick follow-up regarding {{organization_name}}',
      body_template: `Hi {{first_name}},

{{opening_hook}}

{{relevant_problem}}

{{ai_value_prop}}

{{cta}}

Best regards,
{{sender_name}}`,
    },
    {
      step_number: 3,
      delay_days: 7,
      channel: 'Email',
      subject_template: 'Strategic perspective for {{organization_name}}',
      body_template: `Hi {{first_name}},

{{opening_hook}}

{{ai_value_prop}}

{{cta}}

Best regards,
{{sender_name}}`,
    },
  ]);

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    try {
      const [gData, cData] = await Promise.all([
        gmailService.listAccounts().catch(() => []),
        api.get<any>('/business-development/contacts').catch(() => []),
      ]);
      setGmailAccounts(gData);
      if (gData.length > 0) {
        setForm(prev => ({ ...prev, gmail_account_id: gData[0].id, sender_email: gData[0].email }));
      }
      setAllContacts(Array.isArray(cData) ? cData : (cData && cData.items) ? cData.items : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddStep = () => {
    const nextStepNum = sequenceSteps.length + 1;
    const lastDelay = sequenceSteps[sequenceSteps.length - 1]?.delay_days || 0;
    setSequenceSteps([
      ...sequenceSteps,
      {
        step_number: nextStepNum,
        delay_days: lastDelay + 7,
        channel: 'Email',
        subject_template: `Check-in: {{organization_name}} - Step ${nextStepNum}`,
        body_template: `Hi {{first_name}},\n\n{{opening_hook}}\n\n{{cta}}\n\nBest,\n{{sender_name}}`,
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    if (sequenceSteps.length <= 1) return;
    const updated = sequenceSteps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 }));
    setSequenceSteps(updated);
  };

  const handleUpdateStep = (index: number, field: keyof CampaignSequenceStep, val: any) => {
    const updated = [...sequenceSteps];
    updated[index] = { ...updated[index], [field]: val };
    setSequenceSteps(updated);
  };

  const toggleSelectContact = (id: number) => {
    setSelectedContactIds(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleSelectAllContacts = () => {
    if (selectedContactIds.length === filteredContacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredContacts.map(c => c.id));
    }
  };

  const insertPlaceholder = (stepIndex: number, placeholder: string) => {
    const step = sequenceSteps[stepIndex];
    handleUpdateStep(stepIndex, 'body_template', `${step.body_template}\n{{${placeholder}}}`);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      alert('Please enter a campaign name.');
      return;
    }
    try {
      setLoading(true);
      const res = await campaignService.create({
        ...form,
        sequence_steps: sequenceSteps,
        contact_ids: selectedContactIds,
      });
      navigate(`/business-development/campaigns/${res.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create campaign.');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = allContacts.filter(c => 
    (c.first_name && c.first_name.toLowerCase().includes(contactSearch.toLowerCase())) ||
    (c.last_name && c.last_name.toLowerCase().includes(contactSearch.toLowerCase())) ||
    (c.designation && c.designation.toLowerCase().includes(contactSearch.toLowerCase())) ||
    (c.organization_name && c.organization_name.toLowerCase().includes(contactSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#080615] text-[#F8F7FF] pb-24 md:pl-64">
      <Navbar />
      <main className="p-8 max-w-5xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/business-development/campaigns')}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Campaigns
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-300 bg-purple-950/40 px-3 py-1 rounded-full border border-purple-500/20">
              New Campaign Wizard
            </span>
          </div>
        </div>

        {/* Wizard Steps Nav */}
        <div className="grid grid-cols-4 gap-2 p-1.5 rounded-2xl bg-[#131127] border border-white/5">
          {[
            { id: 'details', label: '1. Campaign Details' },
            { id: 'contacts', label: `2. Target Contacts (${selectedContactIds.length})` },
            { id: 'sequence', label: `3. Sequences (${sequenceSteps.length} Steps)` },
            { id: 'review', label: '4. Review & Launch' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: DETAILS */}
        {activeTab === 'details' && (
          <div className="p-6 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 space-y-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              Campaign Basic Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Campaign Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Enterprise AI Outreach - CTOs"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#0D0B1E] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Campaign Description & Objective</label>
                <textarea
                  rows={3}
                  placeholder="Describe target ICP, commercial goals, and primary value angle..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-[#0D0B1E] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Target Industry / Domain</label>
                  <input
                    type="text"
                    placeholder="e.g. Healthcare, SaaS, FinTech, Manufacturing"
                    value={form.target_industry}
                    onChange={(e) => setForm({ ...form, target_industry: e.target.value })}
                    className="w-full bg-[#0D0B1E] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Sender Gmail Account</label>
                  <select
                    value={form.gmail_account_id}
                    onChange={(e) => {
                      const sel = gmailAccounts.find(g => g.id === e.target.value);
                      setForm({ ...form, gmail_account_id: e.target.value, sender_email: sel ? sel.email : '' });
                    }}
                    className="w-full bg-[#0D0B1E] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    {gmailAccounts.length === 0 ? (
                      <option value="">Primary Gmail (Default System Sender)</option>
                    ) : (
                      gmailAccounts.map(g => (
                        <option key={g.id} value={g.id}>{g.email} {g.name ? `(${g.name})` : ''}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setActiveTab('contacts')}
                className="px-6 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-xl hover:bg-purple-500 transition-all"
              >
                Next: Select Target Contacts →
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: TARGET CONTACTS */}
        {activeTab === 'contacts' && (
          <div className="p-6 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Select Target Contacts ({selectedContactIds.length} Selected)
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Enrolls existing verified contacts from your CRM database into this multi-step sequence.</p>
              </div>
              <button
                onClick={toggleSelectAllContacts}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium px-3 py-1.5 rounded-lg bg-purple-950/40 border border-purple-500/20"
              >
                {selectedContactIds.length === filteredContacts.length ? 'Deselect All' : 'Select All Filtered'}
              </button>
            </div>

            <input
              type="text"
              placeholder="Search contacts by name, designation, or hospital/organization..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              className="w-full bg-[#0D0B1E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
            />

            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {filteredContacts.map(c => {
                const isSelected = selectedContactIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleSelectContact(c.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-950/30 border-purple-500/50 shadow-sm'
                        : 'bg-[#0D0B1E]/60 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <div className="text-sm font-semibold text-white">{c.full_name || `${c.first_name} ${c.last_name || ''}`}</div>
                        <div className="text-xs text-gray-400">{c.designation || 'Executive'} • <span className="text-purple-300">{c.organization_name || 'Organization'}</span></div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">{c.email || 'No email'}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <button
                onClick={() => setActiveTab('details')}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                ← Back
              </button>
              <button
                onClick={() => setActiveTab('sequence')}
                className="px-6 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-xl hover:bg-purple-500 transition-all"
              >
                Next: Build Sequence Steps →
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: SEQUENCE BUILDER */}
        {activeTab === 'sequence' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Multi-Step Sequence Schedule
                </h2>
                <p className="text-xs text-gray-400">Configure delays and AI email templates for each follow-up step.</p>
              </div>
              <button
                onClick={handleAddStep}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-950/40 border border-purple-500/30 rounded-xl hover:bg-purple-900/50"
              >
                <Plus className="w-4 h-4" />
                Add Follow-up Step
              </button>
            </div>

            {sequenceSteps.map((step, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                      {step.step_number}
                    </span>
                    <span className="text-sm font-bold text-white">Step {step.step_number} ({step.step_number === 1 ? 'Initial Send' : `Follow-up after ${step.delay_days} days`})</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-[#0D0B1E] px-3 py-1 rounded-lg border border-white/10">
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

                    {sequenceSteps.length > 1 && (
                      <button
                        onClick={() => handleRemoveStep(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-950/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Subject Template</label>
                    <input
                      type="text"
                      value={step.subject_template || ''}
                      onChange={(e) => handleUpdateStep(idx, 'subject_template', e.target.value)}
                      className="w-full bg-[#0D0B1E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-400">Body Template</label>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-gray-500 mr-1">Insert placeholder:</span>
                        {['first_name', 'organization_name', 'contact_role', 'opening_hook', 'ai_value_prop', 'cta'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => insertPlaceholder(idx, tag)}
                            className="px-1.5 py-0.5 text-[10px] font-mono text-purple-300 bg-purple-950/40 rounded border border-purple-500/20 hover:bg-purple-900/50"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      rows={6}
                      value={step.body_template}
                      onChange={(e) => handleUpdateStep(idx, 'body_template', e.target.value)}
                      className="w-full bg-[#0D0B1E] font-mono text-xs border border-white/10 rounded-xl p-4 text-gray-200 focus:outline-none focus:border-purple-500 leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setActiveTab('contacts')}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                ← Back
              </button>
              <button
                onClick={() => setActiveTab('review')}
                className="px-6 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-xl hover:bg-purple-500 transition-all"
              >
                Next: Review & Launch →
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: REVIEW & LAUNCH */}
        {activeTab === 'review' && (
          <div className="p-6 rounded-2xl bg-gradient-to-b from-[#131127] to-[#0D0B1E] border border-white/5 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Campaign Review & Activation
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#0D0B1E] border border-white/5 space-y-2">
                <div className="text-xs text-gray-400 uppercase font-semibold">Campaign Name</div>
                <div className="text-base font-bold text-white">{form.name || 'Untitled Campaign'}</div>
                <div className="text-xs text-gray-400">{form.description || 'No description provided.'}</div>
                <div className="text-xs text-purple-300 font-medium">Domain: {form.target_industry}</div>
              </div>

              <div className="p-4 rounded-xl bg-[#0D0B1E] border border-white/5 space-y-2">
                <div className="text-xs text-gray-400 uppercase font-semibold">Targets & Execution</div>
                <div className="text-base font-bold text-white">{selectedContactIds.length} Enrolled Contacts</div>
                <div className="text-xs text-gray-400">{sequenceSteps.length} Sequence Steps Configured</div>
                <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Human-in-the-Loop review enabled for all sends
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <button
                onClick={() => setActiveTab('sequence')}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                ← Back
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex items-center gap-2 px-8 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg shadow-purple-600/30 hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {loading ? 'Creating Campaign...' : 'Launch Campaign'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CampaignNewPage;
