import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import AdminPagos from './AdminPagos';

const AdminRepartidores = () => {
    const [repartidores, setRepartidores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('gestion');
    const [settlements, setSettlements] = useState([]);
    const [settlementsLoading, setSettlementsLoading] = useState(false);
    const [repFilter, setRepFilter] = useState('Todos');

    const loadRepartidores = async () => {
        setLoading(true);
        try {
            const data = await api.adminGetRepartidores();
            // Sort: Aceptado -> Pendiente -> Rechazado
            const sorted = data.sort((a, b) => {
                const order = { 'Aceptado': 1, 'Pendiente': 2, 'Rechazado': 3 };
                return (order[a.admin_status] || 4) - (order[b.admin_status] || 4);
            });
            setRepartidores(sorted);
        } catch (err) {
            toast.error('Error al cargar repartidores');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRepartidores();
        if (activeTab === 'finanzas') {
            loadSettlements();
        }
        // Polling cada 30 segundos para actualizar actividad en tiempo real
        const interval = setInterval(loadRepartidores, 30000);
        return () => clearInterval(interval);
    }, [activeTab]);

    const loadSettlements = async () => {
        setSettlementsLoading(true);
        try {
            const data = await api.adminGetDriverSettlements();
            setSettlements(data);
        } catch (err) {
            toast.error('Error al cargar liquidaciones');
        } finally {
            setSettlementsLoading(false);
        }
    };

    const handleTogglePaymentStatus = async (pedidoId, currentStatus) => {
        try {
            await api.adminUpdateDriverPaymentStatus(pedidoId, !currentStatus);
            toast.success('Estado de pago actualizado');
            loadSettlements();
        } catch (err) {
            toast.error('Error al actualizar estado de pago');
        }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await api.adminUpdateRepartidorStatus(id, status);
            toast.success(`Repartidor ${status}`);
            loadRepartidores();
        } catch (err) {
            toast.error('Error al actualizar estado');
        }
    };

    const handleToggleEstado = async (id, currentState) => {
        const newState = currentState === 'Inactivo' ? 'Activo' : 'Inactivo';
        if (!window.confirm(`¿Seguro que deseas cambiar el estado a ${newState}?`)) return;
        try {
            await api.adminUpdateRepartidorEstado(id, newState);
            toast.success(`Repartidor marcado como ${newState}`);
            loadRepartidores();
        } catch (err) {
            toast.error('Error al actualizar disponibilidad');
        }
    };

    const isOnline = (rep) => {
        if (!rep.ultima_actividad) return false;
        // La DB guarda en UTC. Comparamos directamente.
        const now = new Date();
        const diff = (now - new Date(rep.ultima_actividad)) / 1000 / 60;
        
        // Consideramos online si reportó actividad en los últimos 5 min y su estado es Activo/Ocupado
        return diff < 5 && (rep.estado === 'Activo' || rep.estado === 'Ocupado');
    };

    const formatLastActive = (date) => {
        if (!date) return 'Nunca';
        // El string viene en UTC desde la DB, JS lo convierte a local automáticamente
        const d = new Date(date);
        return d.toLocaleTimeString('es-AR', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    };

    if (loading) return <div className="loading-state">Cargando repartidores...</div>;

    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header">
                <h2>Gestión de Repartidores</h2>
                <div className="admin-locales-tabs" style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        className={`tab-btn ${activeTab === 'gestion' ? 'active' : ''}`}
                        onClick={() => setActiveTab('gestion')}
                        style={{ padding: '8px 16px', background: activeTab === 'gestion' ? '#e2e8f0' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Gestión de Registros
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'pagos' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pagos')}
                        style={{ padding: '8px 16px', background: activeTab === 'pagos' ? '#e2e8f0' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Solicitudes
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'finanzas' ? 'active' : ''}`}
                        onClick={() => setActiveTab('finanzas')}
                        style={{ padding: '8px 16px', background: activeTab === 'finanzas' ? '#e2e8f0' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Compensación
                    </button>
                </div>
                <button className="btn btn-primary" onClick={loadRepartidores}>Refrescar</button>
            </header>
            
            {activeTab === 'gestion' ? (
                <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Contacto</th>
                            <th>Vehículo</th>
                            <th>Disponibilidad</th>
                            <th>Activo</th>
                            <th>Estado Admin</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {repartidores.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No hay repartidores registrados.</td></tr>
                        ) : (
                            repartidores.map(rep => (
                                <tr key={rep.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <img 
                                                src={rep.foto_url || 'https://placehold.co/40x40'} 
                                                alt="" 
                                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{rep.nombre}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{rep.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{rep.telefono}</td>
                                    <td>
                                        <div>{rep.patente}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{rep.marca_modelo}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--red-600)' }}>
                                                {rep.horario_apertura && rep.horario_cierre 
                                                    ? `${rep.horario_apertura} - ${rep.horario_cierre}` 
                                                    : 'Sin horario'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                {rep.dias_apertura && Array.isArray(rep.dias_apertura) 
                                                    ? rep.dias_apertura.join(', ') 
                                                    : 'Sin días asignados'}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={`badge ${isOnline(rep) ? 'success' : (rep.estado === 'Ocupado' ? 'warning' : 'secondary')}`}>
                                                {isOnline(rep) ? (rep.estado === 'Ocupado' ? 'Ocupado' : 'Online') : 'Offline'}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                Visto: {formatLastActive(rep.ultima_actividad)}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${rep.admin_status?.toLowerCase()}`}>
                                            {rep.admin_status || 'Pendiente'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button 
                                                    className="btn btn-success btn-sm" 
                                                    onClick={() => handleUpdateStatus(rep.id, 'Aceptado')}
                                                    disabled={rep.admin_status === 'Aceptado'}
                                                >
                                                    Aceptar
                                                </button>
                                                <button 
                                                    className="btn btn-danger btn-sm" 
                                                    onClick={() => handleUpdateStatus(rep.id, 'Rechazado')}
                                                    disabled={rep.admin_status === 'Rechazado'}
                                                >
                                                    Rechazar
                                                </button>
                                            </div>
                                            <button 
                                                className={`btn btn-sm ${rep.estado === 'Inactivo' ? 'btn-success' : 'btn-danger'}`}
                                                style={{ fontSize: '0.75rem', padding: '6px', width: '100%', marginTop: '4px' }}
                                                onClick={() => handleToggleEstado(rep.id, rep.estado || 'Inactivo')}
                                            >
                                                {rep.estado === 'Inactivo' ? 'Marcar Activo' : 'Forzar Inactivo'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            ) : activeTab === 'finanzas' ? (
                <div className="table-responsive">
                    <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>Liquidación de Envíos (Solo Entregados)</h3>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>Envíos finalizados pendientes de compensación</p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <select 
                                className="filter-select" 
                                value={repFilter} 
                                onChange={(e) => setRepFilter(e.target.value)}
                                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                            >
                                <option value="Todos">Todos los repartidores</option>
                                {repartidores.filter(r => r.admin_status === 'Aceptado').map(r => (
                                    <option key={r.id} value={r.id}>{r.nombre}</option>
                                ))}
                            </select>
                            <button className="btn btn-sm btn-primary" onClick={loadSettlements} disabled={settlementsLoading}>
                                {settlementsLoading ? 'Cargando...' : 'Refrescar'}
                            </button>
                        </div>
                    </header>

                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Pedido</th>
                                <th>Repartidor</th>
                                <th style={{ textAlign: 'right' }}>Monto Envío</th>
                                <th>Estado Cobro</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settlements
                                .filter(s => repFilter === 'Todos' || s.repartidor_id === repFilter)
                                .map(settle => (
                                <tr key={settle.id}>
                                    <td style={{ fontSize: '0.85rem' }}>{new Date(settle.created_at).toLocaleDateString()}</td>
                                    <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>#{settle.id.substring(0, 8)}</td>
                                    <td>{settle.repartidores?.nombre || settle.repartidor_id || 'N/A'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                        ${Number(settle.precio_envio || 0).toLocaleString('es-AR')}
                                    </td>
                                    <td>
                                        <span className={`badge ${settle.cobro_repartidor_procesado ? 'success' : 'warning'}`}>
                                            {settle.cobro_repartidor_procesado ? 'Saldado' : 'Pendiente'}
                                        </span>
                                    </td>
                                    <td>
                                        <button 
                                            className={`btn btn-sm ${settle.cobro_repartidor_procesado ? 'btn-secondary' : 'btn-primary'}`}
                                            onClick={() => handleTogglePaymentStatus(settle.id, settle.cobro_repartidor_procesado)}
                                        >
                                            {settle.cobro_repartidor_procesado ? 'Revertir' : 'Marcar Saldado'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot style={{ background: '#f8fafc', fontWeight: 800 }}>
                            <tr>
                                <td colSpan="3">TOTAL SELECCIONADO</td>
                                <td style={{ textAlign: 'right', color: '#10b981' }}>
                                    ${settlements
                                        .filter(s => repFilter === 'Todos' || s.repartidor_id === repFilter)
                                        .reduce((sum, s) => sum + Number(s.precio_envio || 0), 0)
                                        .toLocaleString('es-AR')}
                                </td>
                                <td colSpan="2" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    Pendiente: ${settlements
                                        .filter(s => (repFilter === 'Todos' || s.repartidor_id === repFilter) && !s.cobro_repartidor_procesado)
                                        .reduce((sum, s) => sum + Number(s.precio_envio || 0), 0)
                                        .toLocaleString('es-AR')}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ) : (
                <AdminPagos tipo="Repartidor" />
            )}
        </div>
    );
};

export default AdminRepartidores;
