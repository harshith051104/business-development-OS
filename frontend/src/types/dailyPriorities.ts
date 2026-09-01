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
