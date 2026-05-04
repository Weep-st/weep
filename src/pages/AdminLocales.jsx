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
    const [editingLocal, setEditingLocal] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

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

    const handleUpdateCommission = async (localId, habilitada, valor) => {
        try {
            await api.adminUpdateLocalCommission(localId, habilitada, valor);
            toast.success('Configuración de comisión actualizada');
            loadLocales();
        } catch (err) {
            toast.error('Error al actualizar comisión');
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

    const handleUpdateSlug = async (id, slug) => {
        try {
            await api.adminUpdateLocalSlug(id, slug);
            toast.success('Identificador de URL actualizado');
            loadLocales();
        } catch (err) {
            toast.error('Error al actualizar identificador');
        }
    };

    const handleSaveLocalDetails = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const fd = new FormData(e.target);
        
        try {
            const updates = {
                localId: editingLocal.id,
                nombre: fd.get('nombre'),
                rubros: fd.getAll('rubros'), // Get all checked rubros
                horario_apertura: fd.get('horario_apertura'),
                horario_cierre: fd.get('horario_cierre'),
                horario_apertura2: fd.get('horario_apertura2'),
                horario_cierre2: fd.get('horario_cierre2'),
                modo_automatico: fd.get('modo_automatico') === 'true'
            };
            
            await api.updatePerfilLocal(updates);
            toast.success('Local actualizado correctamente');
            setEditingLocal(null);
            loadLocales();
        } catch (err) {
            toast.error('Error al actualizar local');
        } finally {
            setIsSaving(false);
        }
    };

    const isTrialPeriod = (createdAt) => {
        if (!createdAt) return false;
        const created = new Date(createdAt);
        const now = new Date();
        const diffDays = (now - created) / (1000 * 60 * 60 * 24);
        return diffDays < 14;
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
                                <th>Slug / URL</th>
                                <th>Plan Actual</th>
                                <th>Comisión (%)</th>
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
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <input 
                                                    type="text" 
                                                    className="admin-slug-input"
                                                    placeholder="ej: don-pepe"
                                                    defaultValue={local.slug || ''}
                                                    onBlur={(e) => handleUpdateSlug(local.id, e.target.value)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #e2e8f0',
                                                        fontSize: '0.75rem',
                                                        width: '100px'
                                                    }}
                                                />
                                                <button 
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => {
                                                        if (!local.slug) return toast.error('Falta el slug');
                                                        const link = `https://wepi.com.ar/pedir/${local.slug}`;
                                                        navigator.clipboard.writeText(link);
                                                        toast.success('¡Enlace copiado!', { icon: '📋' });
                                                    }}
                                                    style={{ padding: '4px 8px' }}
                                                    title="Copiar enlace directo"
                                                >
                                                    🔗
                                                </button>
                                            </div>
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
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '110px' }}>
                                                {isTrialPeriod(local.created_at) && !local.comision_personalizada_habilitada && (
                                                    <span className="badge" style={{ fontSize: '0.65rem', background: '#fff3e0', color: '#e65100', border: '1px solid #ffe0b2' }}>
                                                        ✨ Período Prueba (8%)
                                                    </span>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        title="Habilitar comisión personalizada"
                                                        checked={local.comision_personalizada_habilitada || false}
                                                        onChange={(e) => handleUpdateCommission(local.id, e.target.checked, local.comision_personalizada_valor)}
                                                    />
                                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                        <input 
                                                            type="number"
                                                            placeholder="%"
                                                            disabled={!local.comision_personalizada_habilitada}
                                                            defaultValue={local.comision_personalizada_valor || ''}
                                                            onBlur={(e) => handleUpdateCommission(local.id, local.comision_personalizada_habilitada, e.target.value)}
                                                            style={{ 
                                                                width: '55px', 
                                                                padding: '2px 4px',
                                                                fontSize: '0.85rem',
                                                                borderRadius: '4px',
                                                                border: '1px solid #e2e8f0',
                                                                textAlign: 'right'
                                                            }}
                                                        />
                                                        <span style={{ marginLeft: '4px', fontSize: '0.85rem', color: '#64748b' }}>%</span>
                                                    </div>
                                                </div>
                                                {local.comision_personalizada_habilitada && (
                                                    <span style={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 600 }}>
                                                        Fija Personalizada
                                                    </span>
                                                )}
                                            </div>
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
                                                <button 
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => setEditingLocal(local)}
                                                    title="Editar Horarios y Perfil"
                                                >
                                                    ⚙️
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
            ) : activeTab === 'cobros' ? (
                <AdminPagos tipo="Local" />
            ) : null}

            {/* Modal de Edición */}
            {editingLocal && (
                <div className="modal-overlay" onClick={() => setEditingLocal(null)}>
                    <div className="modal-content admin-modal" onClick={e => e.stopPropagation()}>
                        <header className="modal-header">
                            <h3>Configuración de {editingLocal.nombre}</h3>
                            <button className="close-btn" onClick={() => setEditingLocal(null)}>✕</button>
                        </header>
                        <form onSubmit={handleSaveLocalDetails} className="admin-edit-form">
                            <div className="form-group">
                                <label>Nombre del Local</label>
                                <input name="nombre" defaultValue={editingLocal.nombre} required />
                            </div>

                            <div className="form-group">
                                <label>Rubros del Negocio</label>
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
                                    gap: '8px', 
                                    background: '#f8fafc', 
                                    padding: '12px', 
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    {['Comida Rápida', 'Panadería', 'Heladería', 'Market', 'Farmacia'].map(r => (
                                        <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                            <input 
                                                type="checkbox" 
                                                name="rubros" 
                                                value={r} 
                                                defaultChecked={editingLocal.rubros?.includes(r) || editingLocal.rubro === r} 
                                            />
                                            {r}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="form-section">
                                <h4>Turno 1</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Apertura</label>
                                        <input name="horario_apertura" type="time" defaultValue={editingLocal.horario_apertura || '09:00'} />
                                    </div>
                                    <div className="form-group">
                                        <label>Cierre</label>
                                        <input name="horario_cierre" type="time" defaultValue={editingLocal.horario_cierre || '14:00'} />
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h4>Turno 2 (Opcional)</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Apertura</label>
                                        <input name="horario_apertura2" type="time" defaultValue={editingLocal.horario_apertura2 || ''} />
                                    </div>
                                    <div className="form-group">
                                        <label>Cierre</label>
                                        <input name="horario_cierre2" type="time" defaultValue={editingLocal.horario_cierre2 || ''} />
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Modo de Apertura</label>
                                <select name="modo_automatico" defaultValue={editingLocal.modo_automatico ? 'true' : 'false'}>
                                    <option value="true">Automático (Según Horario)</option>
                                    <option value="false">Manual (Controlado por Admin/Local)</option>
                                </select>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingLocal(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-success" disabled={isSaving}>
                                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLocales;
