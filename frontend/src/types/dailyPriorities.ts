export interface PriorityItem {
  category: string;
  title: string;
  target_name: string;
  target_type: string;
  target_id: number;
  priority: string;
  reason_why: string;
  recommended_action: string;
  url: string;
  metadata?: Record<string, any> | null;
}

export interface DailyPrioritiesResponse {
  summary: string;
  total_priority_count: number;
  who_should_i_contact_today?: PriorityItem | null;
  who_needs_followup?: PriorityItem | null;
  which_meeting_is_next?: PriorityItem | null;
  which_opportunity_is_most_important?: PriorityItem | null;
  which_deal_is_stale?: PriorityItem | null;
  which_proposal_needs_attention?: PriorityItem | null;
  which_negotiation_needs_attention?: PriorityItem | null;
  which_customer_needs_attention?: PriorityItem | null;
  what_should_i_do_next: string;
  all_priority_items: PriorityItem[];
}

export interface QueueAction {
  kind: 'task' | 'followup';
  id: number;
  title: string;
  status: string;
  priority?: string | null;
  due_at?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  source_url: string;
}

export interface QueueOrganizationGroup {
  organization_id: number;
  organization_name: string;
  organization_url: string;
  financial_health?: string | null; // from linked SEC filings; null = not linked
  actions: QueueAction[];
}

export interface QueueSection {
  key: 'overdue' | 'today' | 'upcoming' | 'undated';
  label: string;
  organizations: QueueOrganizationGroup[];
}

export interface OrganizationQueueResponse {
  scope: string;
  generated_at: string;
  total_actions: number;
  sections: QueueSection[];
}
