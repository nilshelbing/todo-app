import React, { useState, useEffect } from 'react';
import { Task, TaskFormData } from '../types';
import { X } from 'lucide-react';

interface TaskFormProps {
  initialData?: Task;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskFormData) => Promise<void>;
}

const TaskForm: React.FC<TaskFormProps> = ({ initialData, isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    priority: 3,
    due_date: '',
    notes: '',
    tags: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          title: initialData.title,
          priority: initialData.priority,
          due_date: initialData.due_date || '',
          notes: initialData.notes || '',
          tags: initialData.tags.join(', '),
        });
      } else {
        // Reset for new task
        setFormData({
          title: '',
          priority: 3,
          due_date: '',
          notes: '',
          tags: '',
        });
      }
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error(error);
      alert('Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            {initialData ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
            Nutze prägnante Titel und setze ein Datum für klare Prioritäten. Tags helfen dir beim schnellen Filtern im Dashboard.
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Titel</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
              placeholder="Was muss erledigt werden?"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <p className="text-xs text-gray-500">Formuliere klar, z. B. "Präsentation finalisieren".</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Priorität</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              >
                <option value={1}>1 - Hoch</option>
                <option value={2}>2 - Erhöht</option>
                <option value={3}>3 - Normal</option>
                <option value={4}>4 - Niedrig</option>
                <option value={5}>5 - Minimal</option>
              </select>
              <p className="text-xs text-gray-500">Wähle 1-2 für wichtige Aufgaben.</p>
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Fälligkeitsdatum</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
              <p className="text-xs text-gray-500">Lass das Feld leer, wenn es keinen festen Termin gibt.</p>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Tags (kommagetrennt)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              placeholder="arbeit, haushalt, wichtig"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
            <p className="text-xs text-gray-500">Beispiele: "meeting", "privat", "schnell".</p>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Notizen</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none shadow-sm"
              rows={3}
              placeholder="Details zur Aufgabe..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
            <p className="text-xs text-gray-500">Halte Kontext, Links oder Zwischenschritte fest.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Speichere...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;
