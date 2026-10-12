export type TaskPriority = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Todo' | 'In Progress' | 'Completed' | 'Cancelled';

export interface BDTask {
  id: number;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string | null;
  completed_at?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  owner_id?: number | null;
  owner_name?: string | null;
  entity_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BDTaskCreate {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id?: number | null;
  user_name?: string | null;
  body: string;
  created_at: string;
}

export interface TaskDashboard {
  open_count: number;
  overdue_count: number;
  completed_this_week: number;
  by_priority: Record<string, number>;
}
