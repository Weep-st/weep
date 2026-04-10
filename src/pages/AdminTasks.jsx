import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState('');
    const [taskType, setTaskType] = useState('GENERAL');
    const [taskPriority, setTaskPriority] = useState('Media');
    const [taskDeadline, setTaskDeadline] = useState('');
    const [loading, setLoading] = useState(true);

    const taskTypes = ['GENERAL', 'MARKETING', 'LOGISTICA', 'SOPORTE', 'URGENTE', 'SISTEMA'];
    const priorities = ['Baja', 'Media', 'Alta'];

    const loadTasks = async () => {
        try {
            const data = await api.getAdminTasks();
            setTasks(data);
        } catch (err) {
            toast.error('Error al cargar tareas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
    }, []);

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTask.trim()) return;
        try {
            const added = await api.createAdminTask(newTask, taskType, taskDeadline || null, taskPriority);
            setTasks([added, ...tasks]);
            setNewTask('');
            setTaskDeadline('');
            setTaskPriority('Media');
            toast.success('Tarea agregada');
        } catch (err) {
            toast.error('Error al agregar tarea');
        }
    };

    const handleToggleStatus = async (task) => {
        const newStatus = task.estado === 'Pendiente' ? 'Completado' : 'Pendiente';
        try {
            await api.updateAdminTaskStatus(task.id, newStatus);
            setTasks(tasks.map(t => t.id === task.id ? { ...t, estado: newStatus } : t));
        } catch (err) {
            toast.error('Error al actualizar estado');
        }
    };

    const handleDeleteTask = async (id) => {
        if (!window.confirm('¿Eliminar esta tarea?')) return;
        try {
            await api.deleteAdminTask(id);
            setTasks(tasks.filter(t => t.id !== id));
            toast.success('Tarea eliminada');
        } catch (err) {
            toast.error('Error al eliminar tarea');
        }
    };

    if (loading) return <div className="loading-state">Cargando tareas...</div>;

    const getBadgeColor = (type) => {
        switch (type) {
            case 'MARKETING': return '#ec4899';
            case 'LOGISTICA': return '#f59e0b';
            case 'SOPORTE': return '#06b6d4';
            case 'URGENTE': return '#ef4444';
            case 'SISTEMA': return '#8b5cf6';
            default: return '#64748b';
        }
    };

    const getPriorityColor = (prio) => {
        switch (prio) {
            case 'Alta': return '#ef4444';
            case 'Media': return '#f59e0b';
            case 'Baja': return '#10b981';
            default: return '#64748b';
        }
    };

    return (
        <div className="panel-card animate-fade-in" style={{ maxWidth: '800px' }}>
            <header className="panel-header">
                <h2>Tareas Pendientes</h2>
            </header>

            <form onSubmit={handleAddTask} className="task-form">
                <div className="form-group">
                    <input 
                        type="text" 
                        value={newTask} 
                        onChange={(e) => setNewTask(e.target.value)} 
                        placeholder="Escribir una nueva tarea..." 
                        className="task-input"
                    />
                    <select 
                        className="task-type-select" 
                        value={taskType} 
                        onChange={(e) => setTaskType(e.target.value)}
                        title="Tipo de tarea"
                    >
                        {taskTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <select 
                        className="task-type-select" 
                        value={taskPriority} 
                        onChange={(e) => setTaskPriority(e.target.value)}
                        title="Prioridad"
                    >
                        {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input 
                        type="date" 
                        value={taskDeadline} 
                        onChange={(e) => setTaskDeadline(e.target.value)}
                        className="task-input"
                        title="Fecha de finalización"
                    />
                    <button type="submit" className="btn btn-primary" style={{ minWidth: '120px' }}>Agregar</button>
                </div>
            </form>

            <div className="tasks-list">
                {tasks.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No hay tareas por ahora. ✨</p>
                ) : (
                    tasks.map(task => (
                        <div key={task.id} className={`task-item ${task.estado === 'Completado' ? 'completed' : ''}`}>
                            <div className="task-content" onClick={() => handleToggleStatus(task)}>
                                <div className="checkbox">
                                    {task.estado === 'Completado' && '✓'}
                                </div>
                                <div className="task-info">
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span 
                                            className="task-type-badge" 
                                            style={{ backgroundColor: getBadgeColor(task.tipo) }}
                                        >
                                            {task.tipo || 'GENERAL'}
                                        </span>
                                        <span 
                                            className="task-priority-badge" 
                                            style={{ border: `1px solid ${getPriorityColor(task.prioridad)}`, color: getPriorityColor(task.prioridad) }}
                                        >
                                            {task.prioridad || 'Media'}
                                        </span>
                                        {task.fecha_finalizacion && (
                                            <span className="task-deadline">
                                                📅 {new Date(task.fecha_finalizacion).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                    <span className="task-text">{task.tarea}</span>
                                </div>
                            </div>
                            <button className="delete-task" onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}>✕</button>
                        </div>
                    ))
                )}
            </div>

            <style>{`
                .task-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .form-group {
                    display: flex;
                    gap: 10px;
                }
                .task-input {
                    flex: 1;
                    padding: 0.75rem;
                    border-radius: 0.75rem;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(15,23,42,0.5);
                    color: white;
                }
                .task-type-select {
                    padding: 0.75rem;
                    border-radius: 0.75rem;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(30,41,59,0.8);
                    color: white;
                    cursor: pointer;
                }
                .task-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    border-radius: 0.75rem;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    margin-bottom: 0.75rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .task-item:hover { background: rgba(255, 255, 255, 0.05); }
                .task-item.completed { opacity: 0.5; }
                
                .task-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex: 1;
                }
                .task-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .task-type-badge {
                    font-size: 0.65rem;
                    font-weight: 800;
                    padding: 2px 8px;
                    border-radius: 4px;
                    width: fit-content;
                    color: white;
                }
                .task-text {
                    font-size: 0.95rem;
                    color: #e2e8f0;
                }
                .task-item.completed .task-text { text-decoration: line-through; }
                
                .checkbox {
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    border: 2px solid #6366f1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1rem;
                    color: #6366f1;
                    flex-shrink: 0;
                }
                .task-item.completed .checkbox { background: #6366f1; color: white; }
                
                .delete-task {
                    background: transparent;
                    border: none;
                    color: #ef4444;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 0.5;
                    margin-left: 1rem;
                }
                .delete-task:hover { opacity: 1; }
                .task-priority-badge {
                    font-size: 0.6rem;
                    font-weight: 700;
                    padding: 1px 6px;
                    border-radius: 4px;
                    text-transform: uppercase;
                }
                .task-deadline {
                    font-size: 0.7rem;
                    color: #94a3b8;
                    font-family: monospace;
                }
                input[type="date"]::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                }
            `}</style>
        </div>
    );
};

export default AdminTasks;
