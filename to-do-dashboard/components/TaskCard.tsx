import React, { useState, useEffect } from 'react';
import { Task, TaskDocument } from '../types';
import { PRIORITY_COLORS, PRIORITY_LABELS, API_BASE_URL } from '../constants';
import { Calendar, Tag, Trash2, Edit2, CheckCircle, Circle } from 'lucide-react';
import { fetchDocuments, uploadDocument, deleteDocument } from '../services/api';

interface TaskCardProps {
  task: Task;
  onToggleDone: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onTagClick: (tag: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggleDone, onEdit, onDelete, onTagClick }) => {
  const isOverdue = !task.done && task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0));
  const isDueToday = !task.done && task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();

  const [documents, setDocuments] = useState<TaskDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Dokumente laden, sobald die Karte gemountet wird oder sich die Task-ID ändert
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setDocsLoading(true);
        setDocsError(null);
        const docs = await fetchDocuments(task.id);
        setDocuments(docs);
      } catch (e) {
        setDocsError('Dokumente konnten nicht geladen werden');
      } finally {
        setDocsLoading(false);
      }
    };

    loadDocuments();
  }, [task.id]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setDocsLoading(true);
      setDocsError(null);
      const newDoc = await uploadDocument(task.id, file);
      setDocuments(prev => [newDoc, ...prev]);
    } catch (e) {
      setDocsError('Upload fehlgeschlagen');
    } finally {
      // Input zurücksetzen, damit man dieselbe Datei nochmal wählen kann
      event.target.value = '';
      setDocsLoading(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!window.confirm('Dokument wirklich löschen?')) return;
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      setDocsError('Löschen fehlgeschlagen');
    }
  };


  return (
    <div className={`group bg-white rounded-xl border transition-all duration-200 hover:shadow-lg ${task.done ? 'opacity-70 bg-gray-50 border-gray-100' : 'border-gray-100'} shadow-[0_8px_20px_rgba(15,23,42,0.04)]`}>
      <div className="p-4 sm:p-5 flex gap-4 items-start">
        
        {/* Checkbox / Done Status */}
        <button 
          onClick={() => onToggleDone(task)}
          className={`mt-1 flex-shrink-0 transition-colors ${task.done ? 'text-green-500 hover:text-green-600' : 'text-gray-300 hover:text-blue-500'}`}
        >
          {task.done ? <CheckCircle size={24} fill="currentColor" className="text-white bg-green-500 rounded-full" /> : <Circle size={24} />}
        </button>

        <div className="flex-grow min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                {isOverdue && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">Überfällig</span>}
                {isDueToday && !isOverdue && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">Heute</span>}
                {task.done && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">Erledigt</span>}
              </div>
              <h3 className={`font-semibold text-lg leading-snug pr-2 break-words ${task.done ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {task.title}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${PRIORITY_COLORS[task.priority]}`}>
                  Priorität {task.priority} · {PRIORITY_LABELS[task.priority]}
                </span>
                {documents.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                    📎 {documents.length} Datei{documents.length > 1 ? 'en' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Meta Info Row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-gray-600">
            {task.due_date && (
               <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-600 font-semibold' : isDueToday ? 'text-orange-600 font-semibold' : ''}`}>
                 <Calendar size={14} />
                 <span>
                    {isOverdue ? 'Überfällig: ' : isDueToday ? 'Heute fällig: ' : 'Fällig: '}
                    {new Date(task.due_date).toLocaleDateString('de-DE')}
                 </span>
               </div>
            )}
          </div>

          {/* Notes */}
          {task.notes && (
            <p className="mt-2 text-sm text-gray-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{task.notes}</p>
          )}
      {/* Dokumentenbereich */}
      <div className="mt-3 border border-dashed border-gray-200 rounded-lg p-3 bg-gradient-to-br from-slate-50 to-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="text-blue-600">Dokumente</span>
            {docsLoading && <span className="text-xs text-gray-500">lädt...</span>}
          </div>
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100">
            Datei anhängen
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {docsError && (
          <p className="text-xs text-red-500 mb-1">{docsError}</p>
        )}

        {documents.length > 0 ? (
          <ul className="space-y-1 mt-1">
            {documents.map(doc => (
              <li
                key={doc.id}
                className="flex items-center justify-between text-xs text-gray-700 bg-white border border-gray-100 rounded-md px-2 py-1"
              >
                <a
                  href={`${API_BASE_URL}${doc.download_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate max-w-[220px] hover:text-blue-700"
                >
                  {doc.original_name}
                </a>
                <button
                  onClick={() => handleDeleteDocument(doc.id)}
                  className="ml-2 text-gray-400 hover:text-red-600"
                  title="Dokument löschen"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        ) : !docsLoading ? (
          <p className="text-xs text-gray-400">Noch keine Dateien angehängt</p>
        ) : null}
      </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {task.tags.map(tag => (
                <button
                  key={tag}
                  onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border border-transparent hover:border-blue-200"
                >
                  <Tag size={10} />
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions - hidden on mobile until swipe? No, stick to visible but subtle */}
        <div className="flex flex-col gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(task)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Edit2 size={18} />
            </button>
            <button onClick={() => onDelete(task)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={18} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
