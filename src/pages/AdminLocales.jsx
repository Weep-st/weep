import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import AdminPagos from './AdminPagos';
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
    const [salesData, setSalesData] = useState({});
    const [salesLoading, setSalesLoading] = useState(false);
    const [planes, setPlanes] = useState([]);

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
            const data = await api.adminGetMenuCompleto();
            setMenuItems(data || []);
        } catch (err) {
            toast.error('Error al cargar catálogo de menús');
        } finally {
            setMenuLoading(false);
        }
    };

    const loadPlanes = async () => {
        try {
            const data = await api.getDisponibilidadPlanes();
            setPlanes(data);
        } catch (err) {
            console.error('Error al cargar planes:', err);
        }
    };

    const handleUpdatePlan = async (localId, planId) => {
        try {
            await api.suscribirAPlan(localId, planId);
            toast.success('Plan del local actualizado');
            loadLocales();
        } catch (err) {
            toast.error('Error al actualizar plan');
        }
    };

    useEffect(() => {
        loadLocales();
        loadPlanes();
    }, []);

    useEffect(() => {
        if (activeTab === 'menus' && menuItems.length === 0) {
            loadMenuCompleto();
        }
        if (activeTab === 'ventas') {
            loadSales();
        }
    }, [activeTab]);

    const loadSales = async () => {
        setSalesLoading(true);
        try {
            const data = await api.adminGetSalesByLocale();
            setSalesData(data);
        } catch (err) {
            toast.error('Error al cargar datos de ventas');
        } finally {
            setSalesLoading(false);
        }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await api.adminUpdateLocalStatus(id, status);
            toast.success(`Local ${status}`);
            loadLocales();
        } catch (err) {
            toast.error('Error al actualizar estado admin');
        }
    };

    const handleToggleEstado = async (id, currentState) => {
        const newState = currentState === 'Activo' ? 'Inactivo' : 'Activo';
        try {
            await api.adminUpdateLocalEstado(id, newState);
            toast.success(`Local marcado como ${newState === 'Activo' ? 'Abierto' : 'Cerrado'}`);
            loadLocales();
        } catch (err) {
            toast.error('Error al actualizar disponibilidad');
        }
    };

    // Filtering logic
    const filteredMenu = menuItems.filter(item => {
        const matchesSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             item.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesLocal = !selectedLocal || item.local_id === selectedLocal;
        return matchesSearch && matchesLocal;
    });

    const handleUpdateAvailability = async (id, date) => {
        try {
            await api.adminUpdateLocalAvailability(id, date);
            toast.success('Fecha de disponibilidad actualizada');
            loadLocales();
        } catch (err) {
            toast.error('Error al actualizar fecha');
        }
    };

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
                    <button 
                        className={`tab-btn ${activeTab === 'cobros' ? 'active' : ''}`}
                        onClick={() => setActiveTab('cobros')}
                    >
                        Cobros
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'ventas' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ventas')}
                    >
                        Ventas
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
                                <th>Disponible desde</th>
                                <th>Notif.</th>
                                <th>Disponibilidad</th>
                                <th>Estado Admin</th>
                                <th>Plan Actual</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {locales.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No hay locales registrados.</td></tr>
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
                                            <input 
                                                type="date" 
                                                className="admin-date-input"
                                                value={local.disponible_desde || ''}
                                                onChange={(e) => handleUpdateAvailability(local.id, e.target.value)}
                                                style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #e2e8f0',
                                                    fontSize: '0.875rem'
                                                }}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span 
                                                title={local.onesignal_id ? 'Suscribo a Notificaciones' : 'Sin Suscripción'} 
                                                style={{ fontSize: '1.2rem', filter: local.onesignal_id ? 'none' : 'grayscale(1)' }}
                                            >
                                                {local.onesignal_id ? '🔔' : '🔕'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <span className={`badge ${local.estado === 'Activo' ? 'badge-success' : 'badge-danger'}`} style={{ color: local.estado === 'Activo' ? '#4caf50' : '#d32f2f' }}>
                                                    {local.estado === 'Activo' ? 'Abierto' : 'Cerrado'}
                                                </span>
                                                <button 
                                                    className={`btn btn-sm ${local.estado === 'Activo' ? 'btn-danger' : 'btn-success'}`}
                                                    onClick={() => handleToggleEstado(local.id, local.estado || 'Inactivo')}
                                                    style={{ width: '100%' }}
                                                >
                                                    {local.estado === 'Activo' ? 'Cerrar Local' : 'Abrir Local'}
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${local.admin_status?.toLowerCase()}`}>
                                                {local.admin_status || 'Pendiente'}
                                            </span>
                                        </td>
                                        <td>
                                            <select 
                                                className="admin-select-sm"
                                                value={local.plan_id || ''}
                                                onChange={(e) => handleUpdatePlan(local.id, e.target.value)}
                                                style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #e2e8f0',
                                                    fontSize: '0.875rem',
                                                    width: '100%'
                                                }}
                                            >
                                                <option value="">Sin Plan</option>
                                                {planes.map(p => (
                                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                                ))}
                                            </select>
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
            ) : activeTab === 'menus' ? (
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
                            {locales.map(local => (
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
            ) : activeTab === 'ventas' ? (
                <div className="table-responsive">
                    <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>Distribución de Ventas por Local</h3>
                            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '4px 0 0 0' }}>Solo incluye pedidos en estado "Entregado"</p>
                        </div>
                        <button className="btn btn-sm btn-primary" onClick={loadSales} disabled={salesLoading}>
                            {salesLoading ? 'Actualizando...' : 'Refrescar'}
                        </button>
                    </header>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Local</th>
                                <th style={{ textAlign: 'center' }}>Pedidos Entregados</th>
                                <th style={{ textAlign: 'right' }}>Ventas Totales</th>
                                <th style={{ textAlign: 'right' }}>Ticket Promedio</th>
                                <th>Última venta (Simulada)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {locales.filter(l => l.admin_status === 'Aceptado').map(local => {
                                const stats = salesData[local.id] || { total: 0, count: 0 };
                                return (
                                    <tr key={local.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <img 
                                                    src={local.foto_url || 'https://placehold.co/40x40'} 
                                                    alt="" 
                                                    style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} 
                                                />
                                                <span style={{ fontWeight: 600 }}>{local.nombre}</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{stats.count}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                                            ${Number(stats.total).toLocaleString('es-AR')}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            ${stats.count > 0 ? (stats.total / stats.count).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : 0}
                                        </td>
                                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                            {stats.count > 0 ? 'Hoy' : 'Sin ventas'}
                                        </td>
                                    </tr>
                                );
                            })}
                            {locales.filter(l => l.admin_status === 'Aceptado').length === 0 && (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No hay locales aceptados.</td></tr>
                            )}
                        </tbody>
                        <tfoot style={{ background: '#f8fafc', fontWeight: 800 }}>
                            <tr>
                                <td>TOTAL GLOBAL</td>
                                <td style={{ textAlign: 'center' }}>
                                    {Object.values(salesData).reduce((sum, s) => sum + s.count, 0)}
                                </td>
                                <td style={{ textAlign: 'right', color: '#10b981', fontSize: '1.1rem' }}>
                                    ${Object.values(salesData).reduce((sum, s) => sum + s.total, 0).toLocaleString('es-AR')}
                                </td>
                                <td colSpan="2"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ) : (
                <AdminPagos tipo="Local" />
            )}
        </div>
    );
};

export default AdminLocales;
