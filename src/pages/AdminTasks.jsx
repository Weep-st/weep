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
    const [currentDate, setCurrentDate] = useState(new Date());

    const taskTypes = ['GENERAL', 'MARKETING', 'LOGISTICA', 'SOPORTE', 'URGENTE', 'SISTEMA', 'OBJETIVO'];
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

    // Calendar logic
    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const totalDays = daysInMonth(year, month);
        const startingDay = startDayOfMonth(year, month);
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        const days = [];
        for (let i = 0; i < startingDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const tasksOnDay = tasks.filter(t => t.fecha_finalizacion === dateStr);
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            days.push(
                <div key={d} className={`calendar-day ${isToday ? 'today' : ''} ${tasksOnDay.length > 0 ? 'has-tasks' : ''}`}>
                    <span className="day-number">{d}</span>
                    <div className="day-tasks-dots">
                        {tasksOnDay.slice(0, 3).map((t, idx) => (
                            <div key={idx} className="task-dot" style={{ backgroundColor: getBadgeColor(t.tipo) }}></div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="admin-calendar-widget">
                <header className="calendar-header">
                    <button onClick={() => setCurrentDate(new Date(year, month - 1))}>&lt;</button>
                    <span>{monthNames[month]} {year}</span>
                    <button onClick={() => setCurrentDate(new Date(year, month + 1))}>&gt;</button>
                </header>
                <div className="calendar-grid">
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => <div key={d} className="calendar-weekday">{d}</div>)}
                    {days}
                </div>
            </div>
        );
    };

    if (loading) return <div className="loading-state">Cargando tareas...</div>;

    return (
        <div className="panel-card animate-fade-in" style={{ maxWidth: '800px' }}>
            <header className="panel-header">
                <h2>Tareas Pendientes</h2>
            </header>

            <div className="admin-tasks-layout">
                <div className="tasks-main-column">
                    <form onSubmit={handleAddTask} className="task-form">
                        <div className="form-group">
                            <input 
                                type="text" 
                                value={newTask} 
                                onChange={(e) => setNewTask(e.target.value)} 
                                placeholder="Escribir una nueva tarea u objetivo..." 
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
                        <h3 className="section-title">Tareas y Operaciones</h3>
                        {tasks.filter(t => t.tipo !== 'OBJETIVO').length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No hay tareas por ahora. ✨</p>
                        ) : (
                            tasks.filter(t => t.tipo !== 'OBJETIVO').map(task => (
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
                </div>

                <div className="tasks-sidebar-column">
                    <section className="sidebar-section">
                        <h3 className="section-title">📅 Calendario</h3>
                        {renderCalendar()}
                    </section>

                    <section className="sidebar-section" style={{ marginTop: '2rem' }}>
                        <h3 className="section-title">🎯 Objetivos Trimestrales</h3>
                        <div className="objectives-container">
                            {tasks.filter(t => t.tipo === 'OBJETIVO').length === 0 ? (
                                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No hay objetivos definidos. Agrega uno seleccionando "OBJETIVO" como tipo.</p>
                            ) : (
                                tasks.filter(t => t.tipo === 'OBJETIVO').map(obj => (
                                    <div key={obj.id} className={`objective-card ${obj.estado === 'Completado' ? 'completed' : ''}`} onClick={() => handleToggleStatus(obj)}>
                                        <div className="obj-header">
                                            <span className="obj-status-dot"></span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{obj.prioridad}</span>
                                        </div>
                                        <p className="obj-text">{obj.tarea}</p>
                                        <div className="obj-footer">
                                            <span>Finaliza: {obj.fecha_finalizacion ? new Date(obj.fecha_finalizacion).toLocaleDateString() : 'Pendiente'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>

            <style>{`
                .admin-tasks-layout {
                    display: grid;
                    grid-template-columns: 1fr 320px;
                    gap: 2rem;
                }
                @media (max-width: 900px) {
                    .admin-tasks-layout { grid-template-columns: 1fr; }
                }
                .section-title {
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #94a3b8;
                    margin-bottom: 1.5rem;
                }
                .admin-calendar-widget {
                    background: rgba(15,23,42,0.8);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 1rem;
                    padding: 1rem;
                }
                .calendar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                    font-weight: 700;
                    color: white;
                }
                .calendar-header button {
                    background: none; border: none; color: white; cursor: pointer; padding: 5px 10px;
                }
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 4px;
                }
                .calendar-weekday {
                    font-size: 0.7rem;
                    color: #64748b;
                    text-align: center;
                    padding-bottom: 8px;
                }
                .calendar-day {
                    aspect-ratio: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    border-radius: 6px;
                    color: #e2e8f0;
                    position: relative;
                }
                .calendar-day.has-tasks { background: rgba(99, 102, 241, 0.1); }
                .calendar-day.today { border: 1px solid #6366f1; color: #6366f1; font-weight: bold; }
                .day-tasks-dots {
                    display: flex;
                    gap: 2px;
                    margin-top: 2px;
                }
                .task-dot { width: 4px; height: 4px; border-radius: 50%; }

                .objective-card {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 1rem;
                    padding: 1rem;
                    margin-bottom: 1rem;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .objective-card:hover { transform: translateY(-2px); }
                .objective-card.completed { opacity: 0.5; border-color: #10b981; }
                .obj-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #94a3b8; }
                .obj-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #6366f1; }
                .obj-text { font-size: 0.9rem; color: #f8fafc; font-weight: 600; margin: 0; }
                .obj-footer { margin-top: 8px; font-size: 0.7rem; color: #64748b; }
                
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
