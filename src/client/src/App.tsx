import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Inbox,
  CheckCircle,
  Search,
  CheckCheck,
  Check,
} from 'lucide-react';
import { Task, Stats, CreateTaskInput } from './types';
import {
  fetchTasks,
  fetchStats,
  markTaskReviewed,
  unmarkTaskReviewed,
  deleteTask,
  createTask,
  subscribeToEvents,
  playNotificationChime,
} from './api';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { TaskCard } from './components/TaskCard';
import { NewTaskModal } from './components/NewTaskModal';

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, reviewed: 0, projects: [] });
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('loopback_sound') !== 'false';
  });
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newArrivalIds, setNewArrivalIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3000);
  };

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('loopback_sound', String(next));
      return next;
    });
  };

  const loadData = useCallback(async () => {
    try {
      const [fetchedTasks, fetchedStats] = await Promise.all([
        fetchTasks('all'),
        fetchStats(),
      ]);
      setTasks(fetchedTasks);
      setStats(fetchedStats);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep window title synced with unreviewed count
  useEffect(() => {
    if (stats.pending > 0) {
      document.title = `(${stats.pending}) Loopback - Tasks to Review`;
    } else {
      document.title = 'Loopback | Agent Task Inbox';
    }
  }, [stats.pending]);

  // Real-time SSE subscription
  useEffect(() => {
    const unsubscribe = subscribeToEvents(({ type, payload }) => {
      setIsConnected(true);

      if (type === 'task_created') {
        const newTask: Task = payload;
        setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
        setNewArrivalIds((prev) => new Set([...prev, newTask.id]));

        if (soundEnabled) {
          playNotificationChime();
        }

        showToast(`New completion: [${newTask.project}] ${newTask.title}`);
        fetchStats().then(setStats).catch(() => {});

        setTimeout(() => {
          setNewArrivalIds((prev) => {
            const next = new Set(prev);
            next.delete(newTask.id);
            return next;
          });
        }, 4000);
      } else if (type === 'task_updated') {
        const updatedTask: Task = payload;
        setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
        fetchStats().then(setStats).catch(() => {});
      } else if (type === 'task_deleted') {
        const { id } = payload;
        setTasks((prev) => prev.filter((t) => t.id !== id));
        fetchStats().then(setStats).catch(() => {});
      }
    });

    setIsConnected(true);
    return () => unsubscribe();
  }, [soundEnabled]);

  const handleMarkReviewed = async (id: string) => {
    try {
      const updated = await markTaskReviewed(id);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setStats((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        reviewed: prev.reviewed + 1,
      }));
      showToast('Marked as verified.');
    } catch (err) {
      console.error('Failed to mark reviewed:', err);
    }
  };

  const handleUnmarkReviewed = async (id: string) => {
    try {
      const updated = await unmarkTaskReviewed(id);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setStats((prev) => ({
        ...prev,
        pending: prev.pending + 1,
        reviewed: Math.max(0, prev.reviewed - 1),
      }));
      showToast('Moved back to pending.');
    } catch (err) {
      console.error('Failed to unmark reviewed:', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Delete this task record?')) return;
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      fetchStats().then(setStats);
      showToast('Task deleted.');
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleCreateTask = async (input: CreateTaskInput) => {
    try {
      const newTask = await createTask(input);
      setTasks((prev) => [newTask, ...prev]);
      fetchStats().then(setStats);
      showToast('Task recorded successfully.');
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  // Filter tasks based on status, project, and search query
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Status match
      if (t.status !== activeTab) return false;

      // Project match
      if (selectedProject !== 'all' && t.project !== selectedProject) return false;

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesProject = t.project.toLowerCase().includes(q);
        const matchesDetails = t.details?.toLowerCase().includes(q);
        const matchesFiles = t.files.some((f) => f.toLowerCase().includes(q));
        if (!matchesTitle && !matchesProject && !matchesDetails && !matchesFiles) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, activeTab, selectedProject, searchQuery]);

  // List of all unique projects
  const projectList = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((t) => {
      if (t.status === 'pending') {
        map.set(t.project, (map.get(t.project) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [tasks]);

  return (
    <div className="app-container">
      <Header
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenNewTaskModal={() => setIsModalOpen(true)}
        isConnected={isConnected}
      />

      <StatsBar stats={stats} />

      <div className="controls-bar">
        <div className="tabs-group">
          <button
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <Inbox size={16} />
            <span>To Verify</span>
            <span className={`tab-badge ${stats.pending > 0 ? 'highlight' : ''}`}>
              {stats.pending}
            </span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'reviewed' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviewed')}
          >
            <CheckCircle size={16} />
            <span>Reviewed History</span>
            <span className="tab-badge">{stats.reviewed}</span>
          </button>
        </div>

        <div className="filter-actions">
          <div className="search-input-wrapper">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search tasks, files, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {projectList.length > 0 && (
        <div className="project-pills-bar">
          <button
            className={`project-pill ${selectedProject === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedProject('all')}
          >
            <span>All Projects</span>
            <span style={{ opacity: 0.7 }}>({stats.pending})</span>
          </button>

          {projectList.map(({ name, count }) => (
            <button
              key={name}
              className={`project-pill ${selectedProject === name ? 'active' : ''}`}
              onClick={() => setSelectedProject(name)}
            >
              <span>{name}</span>
              <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          ))}
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            {activeTab === 'pending' ? <CheckCheck size={28} /> : <Inbox size={28} />}
          </div>
          <h2 className="empty-title">
            {activeTab === 'pending'
              ? 'All caught up! No tasks waiting for verification.'
              : 'No reviewed tasks yet.'}
          </h2>
          <p className="empty-desc">
            {activeTab === 'pending'
              ? 'When background agents complete work, their reports will appear here in real-time ready for your inspection.'
              : 'Verified tasks will be archived here for future reference.'}
          </p>
        </div>
      ) : (
        <div className="task-list">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isNew={newArrivalIds.has(task.id)}
              onMarkReviewed={handleMarkReviewed}
              onUnmarkReviewed={handleUnmarkReviewed}
              onDelete={handleDeleteTask}
            />
          ))}
        </div>
      )}

      <NewTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTask}
      />

      {toastMessage && (
        <div className="toast success">
          <Check size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
