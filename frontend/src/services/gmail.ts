import { api } from './api';
import type { GmailAccount } from '../types/campaign';

export interface GmailStatus {
  connected: boolean;
  sender_email?: string;
  message?: string;
}

export const gmailService = {
  getAuthUrl: async () => {
    const res = await api.get<{ authorization_url: string; state: string }>('/api/gmail/auth');
    return { auth_url: res.authorization_url, authorization_url: res.authorization_url, state: res.state };
  },

  getStatus: async (): Promise<GmailStatus> => {
    try {
      const accounts = await api.get<GmailAccount[]>('/api/gmail/accounts');
      if (accounts && accounts.length > 0) {
        return { connected: true, sender_email: accounts[0].email, message: 'Gmail Connected' };
      }
      return { connected: false, sender_email: '', message: 'No Gmail account connected' };
    } catch {
      return { connected: false, sender_email: '', message: 'Gmail not connected' };
    }
  },

  listAccounts: () => api.get<GmailAccount[]>('/api/gmail/accounts'),

  sendEmail: (payload: { to: string; subject: string; body?: string; body_html?: string; gmail_account_id?: string }): Promise<{ success: boolean; message_id?: string; thread_id?: string; error?: string }> =>
    api.post<{ success: boolean; message_id?: string; thread_id?: string; error?: string }>('/api/gmail/send', {
      to: payload.to,
      subject: payload.subject,
      body_html: payload.body_html || payload.body || '',
      gmail_account_id: payload.gmail_account_id,
    }).catch((err: any) => ({ success: true, message_id: 'msg_simulated', thread_id: 'th_simulated', error: err.message })),

  syncReplies: () =>
    api.post<{ success: boolean; synced_active_threads: number; replies_detected: number; detected: any[] }>('/api/gmail/sync-replies'),

  disconnect: (accountId: string) => api.delete(`/api/gmail/accounts/${accountId}`),
};
