import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import AdminLocales from './AdminLocales';
import AdminEmails from './AdminEmails';
import AdminTasks from './AdminTasks';
import AdminLogin from './AdminLogin';
import AdminRepartidores from './AdminRepartidores';
import AdminPagos from './AdminPagos';
import AdminPedidos from './AdminPedidos';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const { user, logoutUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('locales');
    const [stats, setStats] = useState({ locales: 0, pendingTasks: 0, users: 0 });

    useEffect(() => {
        if (!user || user.role !== 'admin') return;
        
        // Load some quick stats
        const loadStats = async () => {
            try {
                const locales = await api.adminGetLocales();
                const tasks = await api.getAdminTasks();
                const pendingTasks = tasks.filter(t => t.estado === 'Pendiente').length;
                setStats({
                    locales: locales.length,
                    pendingTasks: pendingTasks,
                    users: '?' // We don't have a direct "get all users" in api yet, but we could add it
                });
            } catch (err) {
                console.error(err);
            }
        };
        loadStats();
    }, [user]);

    if (!user || user.role !== 'admin') {
        return <AdminLogin />;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'locales': return <AdminLocales />;
            case 'repartidores': return <AdminRepartidores />;
            case 'emails': return <AdminEmails />;
            case 'tasks': return <AdminTasks />;
            case 'pedidos': return <AdminPedidos />;
            default: return <AdminLocales />;
        }
    };

    return (
        <div className="admin-container">
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <img src="https://res.cloudinary.com/dw10wkbac/image/upload/v1775234747/gvapffe3wwp4ljgr33le.png" alt="Weep Admin" className="admin-logo" />
                    <h2>Admin Panel</h2>
                </div>
                <nav className="sidebar-nav">
                    <button className={activeTab === 'locales' ? 'active' : ''} onClick={() => setActiveTab('locales')}>
                        <span className="icon">🏪</span> Locales Registrados
                    </button>
                    <button className={activeTab === 'repartidores' ? 'active' : ''} onClick={() => setActiveTab('repartidores')}>
                        <span className="icon">🏍️</span> Repartidores
                    </button>
                    <button className={activeTab === 'emails' ? 'active' : ''} onClick={() => setActiveTab('emails')}>
                        <span className="icon">📧</span> Panel Email
                    </button>
                    <button className={activeTab === 'tasks' ? 'active' : ''} onClick={() => setActiveTab('tasks')}>
                        <span className="icon">📋</span> Tareas Pendientes
                    </button>
                    <button className={activeTab === 'pedidos' ? 'active' : ''} onClick={() => setActiveTab('pedidos')}>
                        <span className="icon">📦</span> Pedidos
                    </button>
                </nav>
                <div className="sidebar-footer">
                    <div className="admin-user-info">
                        <p>{user.name}</p>
                        <span>{user.email}</span>
                    </div>
                    <button className="logout-btn" onClick={logoutUser}>Cerrar Sesión</button>
                </div>
            </aside>

            <main className="admin-main">
                <header className="main-header">
                    <div className="header-stats">
                        <div className="stat-card">
                            <h3>{stats.locales}</h3>
                            <p>Locales</p>
                        </div>
                        <div className="stat-card">
                            <h3>{stats.pendingTasks}</h3>
                            <p>Tareas</p>
                        </div>
                        <div className="stat-card">
                            <h3>ACT</h3>
                            <p>Plataforma</p>
                        </div>
                    </div>
                </header>

                <section className="content-area animate-fade-in">
                    {renderContent()}
                </section>
            </main>
        </div>
    );
};

export default AdminDashboard;
