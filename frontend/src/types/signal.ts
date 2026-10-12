export interface SignalItem {
  id: number;
  organization_id: number | null;
  contact_id: number | null;
  campaign_contact_id: number | null;
  signal_type: string;
  description: string;
  score: number;
  metadata: Record<string, any> | null;
  dismissed: boolean;
  created_at: string;
}
