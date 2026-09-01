export interface StageMetric {
  stage: string;
  count: number;
  total_value: number;
  avg_days_in_stage: number;
  conversion_rate_to_next: number;
}

export interface FunnelReport {
  total_leads: number;
  total_organizations: number;
  total_contacts: number;
  total_emails_sent: number;
  total_calls_logged: number;
  total_meetings_completed: number;
  total_demos_completed: number;
  total_proposals_active: number;
  total_negotiations_active: number;
  total_partnerships_active: number;
  total_customers_active: number;
  total_pipeline_value: number;
  overall_win_rate: number;
  average_sales_cycle_days: number;
  stages: StageMetric[];
  lead_source_breakdown: Record<string, number>;
  rep_performance: Array<{
    rep_name: string;
    role: string;
    accounts_managed: number;
    active_deals: number;
    pipeline_value: number;
  }>;
}
