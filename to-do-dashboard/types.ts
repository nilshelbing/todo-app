export interface TaskDocument {
  id: number;
  task_id: number;
  original_name: string;
  content_type: string | null;
  size: number;
  created_at: string;
  download_url: string; // z.B. "/documents/1"
}

export interface Task {
  id: number;
  title: string;
  done: boolean;
  priority: number; // 1-5
  due_date: string | null; // "YYYY-MM-DD" or null
  created_at: string;
  updated_at: string;
  notes: string | null;
  tags: string[];
}

export type TaskFilter = 'all' | 'open' | 'today' | 'overdue';

export interface TaskFormData {
  title: string;
  priority: number;
  due_date: string;
  notes: string;
  tags: string; // Comma separated for input
}
