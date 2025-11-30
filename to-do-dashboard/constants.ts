const { VITE_API_BASE_URL } = import.meta.env;

export const API_BASE_URL = VITE_API_BASE_URL || 'http://localhost:8000';

export const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-800 border-red-200',
  2: 'bg-orange-100 text-orange-800 border-orange-200',
  3: 'bg-blue-100 text-blue-800 border-blue-200',
  4: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  5: 'bg-slate-100 text-slate-800 border-slate-200',
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Hoch',
  2: 'Erhöht',
  3: 'Normal',
  4: 'Niedrig',
  5: 'Minimal',
};
