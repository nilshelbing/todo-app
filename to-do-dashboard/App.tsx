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
    return { total, open, done: total - open };
  }, [tasks]);

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-mono text-sm">Do</span>
              To-Do Dashboard
            </h1>
            <button 
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Neue Aufgabe</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Error Banner */}
        {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3 border border-red-200">
                <XCircle size={20} />
                <p>{error}</p>
                <button onClick={loadTasks} className="ml-auto text-sm underline hover:no-underline">Erneut versuchen</button>
            </div>
        )}

        {/* Filters & Stats */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            {/* Search */}
            <div className="relative w-full sm:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
                    placeholder="Suche..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Active Tag Filter Display */}
            {tagFilter && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                    <Filter size={14} />
                    Tag: {tagFilter}
                    <button onClick={() => setTagFilter(null)} className="hover:text-indigo-900 ml-1"><XCircle size={14} /></button>
                </div>
            )}
            
            <div className="text-sm text-gray-500">
                <span className="font-medium text-gray-900">{stats.open}</span> Offen / {stats.total} Gesamt
            </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {(['all', 'open', 'today', 'overdue'] as TaskFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setCurrentFilter(tab)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${currentFilter === tab 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                {tab === 'all' && 'Alle'}
                {tab === 'open' && 'Offen'}
                {tab === 'today' && 'Heute fällig'}
                {tab === 'overdue' && 'Überfällig'}
              </button>
            ))}
          </nav>
        </div>

        {/* Task List */}
        <div className="space-y-3">
            {loading && tasks.length === 0 ? (
                <div className="flex justify-center py-12 text-gray-400">
                    <RefreshCw className="animate-spin mr-2" /> Lade Aufgaben...
                </div>
            ) : filteredTasks.length > 0 ? (
                filteredTasks.map(task => (
                    <TaskCard 
                        key={task.id} 
                        task={task} 
                        onToggleDone={handleToggleDone} 
                        onEdit={openEditModal}
                        onDelete={handleDelete}
                        onTagClick={setTagFilter}
                    />
                ))
            ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">Keine Aufgaben gefunden.</p>
                    {currentFilter !== 'all' && (
                        <button onClick={() => setCurrentFilter('all')} className="mt-2 text-blue-600 text-sm hover:underline">
                            Alle anzeigen
                        </button>
                    )}
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
