import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './AdminLocales.css';

const AdminLocales = () => {
    const [locales, setLocales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('gestion'); // 'gestion' or 'menus'
    
    // Menu Catalog State
    const [menuItems, setMenuItems] = useState([]);
    const [menuLoading, setMenuLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLocal, setSelectedLocal] = useState('');

    const loadLocales = async () => {
        setLoading(true);
        try {
            const data = await api.adminGetLocales();
            // Sort: Aceptado -> Pendiente -> Rechazado
            const sorted = data.sort((a, b) => {
                const order = { 'Aceptado': 1, 'Pendiente': 2, 'Rechazado': 3 };
                return (order[a.admin_status] || 4) - (order[b.admin_status] || 4);
            });
            setLocales(sorted);
        } catch (err) {
            toast.error('Error al cargar locales');
        } finally {
            setLoading(false);
        }
    };

    const loadMenuCompleto = async () => {
        setMenuLoading(true);
        try {
            const data = await api.getMenuCompleto();
            setMenuItems(data || []);
        } catch (err) {
            toast.error('Error al cargar catálogo de menús');
        } finally {
            setMenuLoading(false);
        }
    };

    useEffect(() => {
        loadLocales();
    }, []);

    useEffect(() => {
        if (activeTab === 'menus' && menuItems.length === 0) {
            loadMenuCompleto();
        }
    }, [activeTab]);

    const handleUpdateStatus = async (id, status) => {
        try {
            await api.adminUpdateLocalStatus(id, status);
            toast.success(`Local ${status}`);
            loadLocales();
        } catch (err) {
            toast.error('Error al actualizar estado');
        }
    };

    // Filtering logic
    const filteredMenu = menuItems.filter(item => {
        const matchesSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             item.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesLocal = !selectedLocal || item.local_id === selectedLocal;
        return matchesSearch && matchesLocal;
    });

    if (loading && activeTab === 'gestion') return <div className="loading-state">Cargando locales...</div>;

    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header">
                <h2>Gestión de Locales</h2>
                <div className="admin-locales-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'gestion' ? 'active' : ''}`}
                        onClick={() => setActiveTab('gestion')}
                    >
                        Gestión de Registros
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'menus' ? 'active' : ''}`}
                        onClick={() => setActiveTab('menus')}
                    >
                        Catálogo de Menús
                    </button>
                </div>
            </header>

            {activeTab === 'gestion' ? (
                <div className="table-responsive">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Dirección</th>
                                <th>Estado Admin</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {locales.length === 0 ? (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No hay locales registrados.</td></tr>
                            ) : (
                                locales.map(local => (
                                    <tr key={local.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <img 
                                                    src={local.foto_url || 'https://placehold.co/40x40'} 
                                                    alt="" 
                                                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
                                                />
                                                {local.nombre}
                                            </div>
                                        </td>
                                        <td>{local.email}</td>
                                        <td>{local.direccion}</td>
                                        <td>
                                            <span className={`badge ${local.admin_status?.toLowerCase()}`}>
                                                {local.admin_status || 'Pendiente'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button 
                                                    className="btn btn-success btn-sm" 
                                                    onClick={() => handleUpdateStatus(local.id, 'Aceptado')}
                                                    disabled={local.admin_status === 'Aceptado'}
                                                >
                                                    Aceptar
                                                </button>
                                                <button 
                                                    className="btn btn-danger btn-sm" 
                                                    onClick={() => handleUpdateStatus(local.id, 'Rechazado')}
                                                    disabled={local.admin_status === 'Rechazado'}
                                                >
                                                    Rechazar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="menu-catalog-container">
                    <div className="catalog-filters">
                        <div className="search-wrapper">
                            <input 
                                type="text" 
                                className="filter-input" 
                                placeholder="Buscar plato..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select 
                            className="filter-select"
                            value={selectedLocal}
                            onChange={(e) => setSelectedLocal(e.target.value)}
                        >
                            <option value="">Todos los locales</option>
                            {locales.filter(l => l.admin_status === 'Aceptado').map(local => (
                                <option key={local.id} value={local.id}>{local.nombre}</option>
                            ))}
                        </select>
                        <button className="btn btn-primary" onClick={loadMenuCompleto}>
                            {menuLoading ? 'Cargando...' : 'Refrescar'}
                        </button>
                    </div>

                    {menuLoading ? (
                        <div className="loading-state">Cargando catálogo...</div>
                    ) : (
                        <div className="menu-catalog-grid">
                            {filteredMenu.length === 0 ? (
                                <div className="empty-catalog">
                                    <p>No se encontraron productos con los filtros seleccionados.</p>
                                </div>
                            ) : (
                                filteredMenu.map(item => (
                                    <div key={item.id} className="menu-admin-card">
                                        <div className="card-img-container">
                                            <img src={item.imagen_url || 'https://placehold.co/400x300'} alt={item.nombre} />
                                            <div className="card-badge-local">{item.local_nombre}</div>
                                        </div>
                                        <div className="card-content">
                                            <div className="card-header">
                                                <h3>{item.nombre}</h3>
                                                <span className="card-price">${Number(item.precio).toLocaleString('es-AR')}</span>
                                            </div>
                                            <span className="card-category">{item.categoria}</span>
                                            <p className="card-desc">{item.descripcion || 'Sin descripción'}</p>
                                            <div className="card-footer">
                                                <div className="status-indicator">
                                                    <div className={`dot ${item.disponibilidad ? 'active' : 'inactive'}`}></div>
                                                    {item.disponibilidad ? 'Disponible' : 'Sin Stock'}
                                                </div>
                                                <div className="card-id" style={{fontSize: '0.7rem', color: '#64748b'}}>#{item.id.split('-').pop()}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminLocales;
