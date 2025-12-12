import React, { useEffect, useState } from 'react';
import {
  Task,
  TaskLabel,
  TaskStats,
  listTasks,
  createTask,
  updateTaskStatus,
  deleteTask,
  getTaskStats,
  listLabels,
  BridgeRequestError,
} from '../generated/api';

const TasksDemo: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  
  // New task form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksData, labelsData, statsData] = await Promise.all([
        listTasks({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        }),
        listLabels(),
        getTaskStats(),
      ]);
      setTasks(tasksData);
      setLabels(labelsData);
      setStats(statsData);
    } catch (err) {
      if (err instanceof BridgeRequestError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError('Failed to load tasks');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    setLoading(true);
    try {
      await createTask({
        title: newTitle,
        description: newDescription || undefined,
        priority: newPriority,
        labelIds: selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
      });
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setSelectedLabelIds([]);
      await loadData();
    } catch (err) {
      if (err instanceof BridgeRequestError) {
        setError(`${err.code}: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId: number, newStatus: string) => {
    try {
      await updateTaskStatus({ taskId, status: newStatus });
      await loadData();
    } catch (err) {
      if (err instanceof BridgeRequestError) {
        setError(`${err.code}: ${err.message}`);
      }
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Delete this task?')) return;
    
    try {
      await deleteTask({ taskId });
      await loadData();
    } catch (err) {
      if (err instanceof BridgeRequestError) {
        setError(`${err.code}: ${err.message}`);
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: '#e74c3c',
      high: '#e67e22',
      medium: '#f1c40f',
      low: '#27ae60',
    };
    return colors[priority] || '#95a5a6';
  };

  const getStatusEmoji = (status: string) => {
    const emojis: Record<string, string> = {
      todo: '📋',
      in_progress: '🔄',
      done: '✅',
      cancelled: '❌',
    };
    return emojis[status] || '📋';
  };

  const toggleLabel = (labelId: number) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  };

  return (
    <div>
      <h2 style={styles.heading}>✅ Task Manager</h2>
      
      {error && <div style={styles.error}>{error}</div>}

      {/* Stats Overview */}
      {stats && (
        <div style={styles.statsGrid}>
          <div style={{ ...styles.statCard, borderColor: '#3498db' }}>
            <span style={styles.statNumber}>{stats.total}</span>
            <span style={styles.statLabel}>Total</span>
          </div>
          <div style={{ ...styles.statCard, borderColor: '#f1c40f' }}>
            <span style={styles.statNumber}>{stats.todo}</span>
            <span style={styles.statLabel}>To Do</span>
          </div>
          <div style={{ ...styles.statCard, borderColor: '#3498db' }}>
            <span style={styles.statNumber}>{stats.inProgress}</span>
            <span style={styles.statLabel}>In Progress</span>
          </div>
          <div style={{ ...styles.statCard, borderColor: '#27ae60' }}>
            <span style={styles.statNumber}>{stats.done}</span>
            <span style={styles.statLabel}>Done</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={styles.filters}>
        <div>
          <label style={styles.filterLabel}>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">All</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label style={styles.filterLabel}>Priority:</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">All</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Create Task Form */}
      <form onSubmit={handleCreateTask} style={styles.form}>
        <h3>Create New Task</h3>
        <div style={styles.formGrid}>
          <input
            type="text"
            placeholder="Task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={styles.input}
            required
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            style={styles.select}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <textarea
          placeholder="Description (optional)"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          style={styles.textarea}
          rows={2}
        />
        <div style={styles.labelSelector}>
          <span style={styles.labelSelectorTitle}>Labels:</span>
          {labels.map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() => toggleLabel(label.id)}
              style={{
                ...styles.labelButton,
                background: selectedLabelIds.includes(label.id)
                  ? label.color
                  : '#eee',
                color: selectedLabelIds.includes(label.id) ? '#fff' : '#333',
              }}
            >
              {label.name}
            </button>
          ))}
        </div>
        <button type="submit" style={styles.createButton} disabled={loading}>
          Create Task
        </button>
      </form>

      {/* Tasks List */}
      <div style={styles.tasksList}>
        {loading && <p>Loading...</p>}
        {tasks.map((task) => (
          <div key={task.id} style={styles.taskCard}>
            <div style={styles.taskHeader}>
              <span style={styles.taskStatus}>
                {getStatusEmoji(task.status ?? 'todo')}
              </span>
              <h4 style={styles.taskTitle}>{task.title}</h4>
              <span
                style={{
                  ...styles.priority,
                  background: getPriorityColor(task.priority ?? 'medium'),
                }}
              >
                {(task.priority ?? 'medium').toUpperCase()}
              </span>
            </div>
            
            {task.description && (
              <p style={styles.taskDescription}>{task.description}</p>
            )}
            
            <div style={styles.taskLabels}>
              {(task.labels ?? []).map((label) => (
                <span
                  key={label.id}
                  style={{
                    ...styles.taskLabel,
                    background: label.color,
                  }}
                >
                  {label.name}
                </span>
              ))}
            </div>
            
            <div style={styles.taskActions}>
              <select
                value={task.status ?? 'todo'}
                onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                style={styles.statusSelect}
              >
                <option value="todo">📋 To Do</option>
                <option value="in_progress">🔄 In Progress</option>
                <option value="done">✅ Done</option>
                <option value="cancelled">❌ Cancelled</option>
              </select>
              <button
                onClick={() => handleDeleteTask(task.id)}
                style={styles.deleteButton}
              >
                🗑️ Delete
              </button>
            </div>
            
            <div style={styles.taskMeta}>
              Created: {new Date(task.createdAt).toLocaleDateString()}
              {task.dueDate && ` • Due: ${task.dueDate}`}
            </div>
          </div>
        ))}
        
        {tasks.length === 0 && !loading && (
          <p style={styles.emptyMessage}>
            No tasks found. Create one above!
          </p>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  heading: {
    marginBottom: '20px',
    color: '#2c3e50',
  },
  error: {
    background: '#fee',
    color: '#c00',
    padding: '10px 15px',
    borderRadius: '4px',
    marginBottom: '15px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '15px',
    marginBottom: '20px',
  },
  statCard: {
    background: '#fff',
    padding: '20px',
    borderRadius: '8px',
    textAlign: 'center',
    borderLeft: '4px solid',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
  },
  statNumber: {
    display: 'block',
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    color: '#7f8c8d',
    fontSize: '14px',
  },
  filters: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
  },
  filterLabel: {
    marginRight: '10px',
    fontWeight: 'bold',
  },
  select: {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  form: {
    background: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 200px',
    gap: '10px',
    marginTop: '10px',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    marginTop: '10px',
    resize: 'vertical',
  },
  labelSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '10px',
  },
  labelSelectorTitle: {
    fontWeight: 'bold',
  },
  labelButton: {
    padding: '4px 10px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  createButton: {
    marginTop: '15px',
    padding: '12px 24px',
    fontSize: '14px',
    background: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  tasksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  taskCard: {
    background: '#fff',
    padding: '15px',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
    border: '1px solid #eee',
  },
  taskHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  taskStatus: {
    fontSize: '20px',
  },
  taskTitle: {
    flex: 1,
    margin: 0,
    fontSize: '16px',
  },
  priority: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#fff',
  },
  taskDescription: {
    color: '#666',
    fontSize: '14px',
    marginBottom: '10px',
  },
  taskLabels: {
    display: 'flex',
    gap: '5px',
    marginBottom: '10px',
  },
  taskLabel: {
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    color: '#fff',
  },
  taskActions: {
    display: 'flex',
    gap: '10px',
    marginBottom: '10px',
  },
  statusSelect: {
    padding: '6px 10px',
    fontSize: '13px',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  deleteButton: {
    padding: '6px 12px',
    fontSize: '13px',
    background: '#fee',
    color: '#c00',
    border: '1px solid #fcc',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  taskMeta: {
    fontSize: '12px',
    color: '#999',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#999',
    padding: '40px',
    fontStyle: 'italic',
  },
};

export default TasksDemo;
