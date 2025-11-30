import { API_BASE_URL } from '../constants';
import { Task, TaskFormData, TaskDocument, TagSummary } from '../types';

export const fetchTasks = async (
  showDone: boolean = true,
  search?: string,
  tag?: string,
  signal?: AbortSignal,
): Promise<Task[]> => {
  const params = new URLSearchParams();
  params.append('show_done', showDone ? 'true' : 'false');
  if (search) params.append('search', search);
  if (tag) params.append('tag', tag);

  const response = await fetch(`${API_BASE_URL}/tasks?${params.toString()}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch tasks');
  return response.json();
};

export const createTask = async (data: TaskFormData): Promise<Task> => {
  // Convert comma separated tags string to array for API
  const tagsArray = data.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
  
  const payload = {
    ...data,
    due_date: data.due_date || null,
    notes: data.notes || null,
    tags: tagsArray
  };

  const response = await fetch(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to create task');
  return response.json();
};

export const updateTask = async (id: number, data: Partial<TaskFormData> | { done: boolean }): Promise<Task> => {
  let payload: any = { ...data };
  
  // If we are updating tags via form data string
  if ('tags' in data && typeof data.tags === 'string') {
     payload.tags = data.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }
  
  // Handle empty strings for optional fields
  if ('due_date' in payload && payload.due_date === '') payload.due_date = null;
  if ('notes' in payload && payload.notes === '') payload.notes = null;

  const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to update task');
  return response.json();
};

export const deleteTask = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete task');
};

export const fetchDocuments = async (taskId: number): Promise<TaskDocument[]> => {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/documents`);
  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }
  return response.json();
};

export const uploadDocument = async (taskId: number, file: File): Promise<TaskDocument> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/documents`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload document');
  }

  return response.json();
};

export const deleteDocument = async (docId: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
};

export const fetchTags = async (): Promise<TagSummary[]> => {
  const response = await fetch(`${API_BASE_URL}/tags`);
  if (!response.ok) {
    throw new Error('Failed to fetch tags');
  }
  return response.json();
};

