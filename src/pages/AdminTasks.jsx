import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState('');
    const [loading, setLoading] = useState(true);

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
            const added = await api.createAdminTask(newTask);
            setTasks([added, ...tasks]);
            setNewTask('');
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

    return (
        <div className="panel-card animate-fade-in" style={{ maxWidth: '800px' }}>
            <header className="panel-header">
                <h2>Tareas Pendientes</h2>
            </header>

            <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <input 
                    type="text" 
                    value={newTask} 
                    onChange={(e) => setNewTask(e.target.value)} 
                    placeholder="Escribir una nueva tarea..." 
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.5)', color: 'white' }}
                />
                <button type="submit" className="btn btn-primary">Agregar</button>
            </form>

            <div className="tasks-list">
                {tasks.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No hay tareas por ahora. ✨</p>
                ) : (
                    tasks.map(task => (
                        <div key={task.id} className={`task-item ${task.estado === 'Completado' ? 'completed' : ''}`}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }} onClick={() => handleToggleStatus(task)}>
                                <div className="checkbox">
                                    {task.estado === 'Completado' && '✓'}
                                </div>
                                <span>{task.tarea}</span>
                            </div>
                            <button className="delete-task" onClick={() => handleDeleteTask(task.id)}>✕</button>
                        </div>
                    ))
                )}
            </div>

            <style>{`
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
                .task-item.completed span { text-decoration: line-through; }
                
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
                }
                .task-item.completed .checkbox { background: #6366f1; color: white; }
                
                .delete-task {
                    background: transparent;
                    border: none;
                    color: #ef4444;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 0;
                    margin-left: 1rem;
                }
                .task-item:hover .delete-task { opacity: 1; }
            `}</style>
        </div>
    );
};

export default AdminTasks;
