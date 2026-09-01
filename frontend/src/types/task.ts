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
