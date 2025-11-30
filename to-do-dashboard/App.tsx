import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Filter, RefreshCw, XCircle } from 'lucide-react';
import { fetchTasks, createTask, updateTask, deleteTask } from './services/api';
import { Task, TaskFilter, TaskFormData } from './types';
import TaskCard from './components/TaskCard';
import TaskForm from './components/TaskForm';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [currentFilter, setCurrentFilter] = useState<TaskFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  // Load Tasks
  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      // We assume backend handles 'search' and 'tag' efficiently.
      // But for 'Today' and 'Overdue', we filter client side from the 'open' list or 'all' list.
      // To keep it simple, let's fetch ALL (show_done=true) and then filter locally 
      // OR let the backend do the heavy lifting for basic lists.
      // Strategy: Fetch based on search/tag if present, otherwise fetch all and sort/filter client side for speed.
      
      const data = await fetchTasks(true, searchQuery, tagFilter || undefined);
      setTasks(data);
    } catch (err) {
      setError('Verbindung zum Server fehlgeschlagen. Läuft server.py?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search slightly
    const timer = setTimeout(() => {
        loadTasks();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, tagFilter]); 

  // Derived State for Tabs (Overdue/Today)
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Note: The backend already filtered by search and tag if we passed them.
    // We just need to handle the visual tabs (All, Open, Today, Overdue).
    
    const todayStr = new Date().toDateString();
    const now = new Date();
    now.setHours(0,0,0,0);

    switch (currentFilter) {
        case 'open':
            result = result.filter(t => !t.done);
            break;
        case 'today':
            result = result.filter(t => !t.done && t.due_date && new Date(t.due_date).toDateString() === todayStr);
            break;
        case 'overdue':
            result = result.filter(t => !t.done && t.due_date && new Date(t.due_date) < now);
            break;
        case 'all':
        default:
            // No extra filtering
            break;
    }

    // Sort: Open first, then by priority (asc means 1 is top), then due date
    result.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        return b.id - a.id; // Newest first fallback
    });

    return result;
  }, [tasks, currentFilter]);

  // Handlers
  const handleCreate = async (data: TaskFormData) => {
    await createTask(data);
    await loadTasks();
  };

  const handleUpdate = async (data: TaskFormData) => {
    if (editingTask) {
        await updateTask(editingTask.id, data);
        setEditingTask(undefined);
        await loadTasks();
    }
  };

  const handleToggleDone = async (task: Task) => {
    // Optimistic update
    const newStatus = !task.done;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: newStatus } : t));
    
    try {
        await updateTask(task.id, { done: newStatus });
    } catch (e) {
        // Revert on error
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !newStatus } : t));
        alert('Status konnte nicht aktualisiert werden.');
    }
  };

  const handleDelete = async (task: Task) => {
    if (!window.confirm(`"${task.title}" wirklich löschen?`)) return;
    try {
        await deleteTask(task.id);
        setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (e) {
        alert('Löschen fehlgeschlagen.');
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const openCreateModal = () => {
    setEditingTask(undefined);
    setIsFormOpen(true);
  };

  // Stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const open = tasks.filter(t => !t.done).length;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const dueToday = tasks.filter(
      (t) => !t.done && t.due_date && new Date(t.due_date).toDateString() === now.toDateString()
    ).length;
    const overdue = tasks.filter(
      (t) => !t.done && t.due_date && new Date(t.due_date) < now
    ).length;

    return { total, open, done: total - open, dueToday, overdue };
  }, [tasks]);

  return (
    <div className="min-h-screen pb-12 bg-gradient-to-b from-slate-50 via-white to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-white/80 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-semibold flex items-center justify-center shadow-sm">
                Do
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Organisiert bleiben</p>
                <h1 className="text-xl font-bold text-gray-900">To-Do Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadTasks}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={16} className="text-gray-500" />
                Aktualisieren
              </button>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Neue Aufgabe</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Hero */}
        <section className="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-blue-100">Klarer Überblick, weniger Stress</p>
              <h2 className="text-2xl font-semibold mt-1">Gestalte deinen Arbeitstag fokussiert</h2>
              <p className="text-sm text-blue-50 mt-2 max-w-2xl">
                Behalte offene, heutige und überfällige Aufgaben im Blick. Nutze Suche und Tags, um blitzschnell zu finden, was gerade wichtig ist.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-medium">
                {stats.open} offene Aufgaben
              </div>
              <div className="px-4 py-2 rounded-xl bg-white text-blue-700 text-sm font-semibold shadow-sm">
                {stats.dueToday} heute fällig
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[{
            label: 'Gesamt',
            value: stats.total,
            detail: 'Alle Aufgaben',
            color: 'from-slate-50 to-white'
          }, {
            label: 'Offen',
            value: stats.open,
            detail: 'Nicht erledigt',
            color: 'from-blue-50 to-blue-100/40'
          }, {
            label: 'Heute fällig',
            value: stats.dueToday,
            detail: 'Fokus des Tages',
            color: 'from-amber-50 to-orange-100/40'
          }, {
            label: 'Überfällig',
            value: stats.overdue,
            detail: 'Dringend prüfen',
            color: 'from-rose-50 to-red-100/40'
          }].map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border border-gray-100 bg-gradient-to-br ${card.color} p-4 shadow-[0_4px_12px_rgba(15,23,42,0.04)]`}
            >
              <p className="text-xs uppercase tracking-wide text-gray-500">{card.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{card.value}</p>
              <p className="text-sm text-gray-500 mt-1">{card.detail}</p>
            </div>
          ))}
        </section>
        
        {/* Error Banner */}
        {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3 border border-red-200 shadow-sm">
                <XCircle size={20} />
                <div>
                  <p className="font-medium">Verbindung zum Server fehlgeschlagen</p>
                  <p className="text-sm">Läuft server.py? Versuche es erneut.</p>
                </div>
                <button onClick={loadTasks} className="ml-auto text-sm underline hover:no-underline">Erneut versuchen</button>
            </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            {/* Search */}
            <div className="relative w-full md:w-96">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
                placeholder="Titel, Tag oder Notiz suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-2 px-2 text-gray-400 hover:text-gray-600"
                  aria-label="Suche zurücksetzen"
                >
                  <XCircle size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-semibold text-gray-900">{stats.open}</span> offen
              </div>
              <div className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-700">
                <Filter size={14} />
                Filter aktiviert: {currentFilter === 'all' ? 'Keine' : currentFilter}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {tagFilter && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm border border-indigo-100">
                <Filter size={14} />
                Tag: {tagFilter}
                <button onClick={() => setTagFilter(null)} className="hover:text-indigo-900 ml-1"><XCircle size={14} /></button>
              </div>
            )}

            <div className="flex-1" />

            <div className="flex flex-wrap gap-2">
              {[{
                label: 'Alle',
                value: 'all',
              }, {
                label: 'Offen',
                value: 'open'
              }, {
                label: 'Heute fällig',
                value: 'today'
              }, {
                label: 'Überfällig',
                value: 'overdue'
              } as { label: string; value: TaskFilter }].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setCurrentFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    currentFilter === tab.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-200 hover:text-blue-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Result Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-medium text-gray-900">{filteredTasks.length} Aufgaben</p>
            <p className="text-xs text-gray-500">Sortiert nach Status, Priorität und Fälligkeit</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <button
              onClick={() => { setCurrentFilter('all'); setTagFilter(null); setSearchQuery(''); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-200 hover:text-blue-700 transition-colors"
            >
              <RefreshCw size={14} />
              Alles zurücksetzen
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700"
            >
              <Plus size={14} />
              Schnell hinzufügen
            </button>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-3">
            {loading && tasks.length === 0 ? (
                <div className="grid gap-3">
                  {[1,2,3].map((item) => (
                    <div key={item} className="h-28 rounded-xl bg-white border border-gray-100 shadow-sm animate-pulse" />
                  ))}
                </div>
            ) : filteredTasks.length > 0 ? (
                <>
                  {loading && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 px-2">
                      <RefreshCw className="animate-spin" size={14} />
                      Aktualisiere...
                    </div>
                  )}
                  {filteredTasks.map(task => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        onToggleDone={handleToggleDone}
                        onEdit={openEditModal}
                        onDelete={handleDelete}
                        onTagClick={setTagFilter}
                    />
                  ))}
                </>
            ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm">
                    <p className="text-lg font-semibold text-gray-700">Keine Aufgaben gefunden</p>
                    <p className="text-sm text-gray-500 mt-1 max-w-xl mx-auto">Passe die Filter an oder erstelle eine neue Aufgabe, um deinen nächsten Schritt festzuhalten.</p>
                    <div className="mt-4 flex justify-center gap-3">
                      {currentFilter !== 'all' && (
                        <button onClick={() => setCurrentFilter('all')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                            Alle anzeigen
                        </button>
                      )}
                      <button onClick={openCreateModal} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        Neue Aufgabe erstellen
                      </button>
                    </div>
                </div>
            )}
        </div>
      </main>

      <TaskForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingTask(undefined); }}
        onSubmit={editingTask ? handleUpdate : handleCreate}
        initialData={editingTask}
      />
    </div>
  );
}

export default App;
