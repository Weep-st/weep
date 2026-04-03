import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminRepartidores = () => {
    const [repartidores, setRepartidores] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadRepartidores = async () => {
        setLoading(true);
        try {
            // Limpieza proactiva de inactivos
            await api.adminCleanupInactiveDrivers();
            
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
        // Polling cada 30 segundos para actualizar actividad en tiempo real
        const interval = setInterval(loadRepartidores, 30000);
        return () => clearInterval(interval);
    }, []);

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
        const diff = (new Date() - new Date(rep.ultima_actividad)) / 1000 / 60;
        // Consideramos online si reportó actividad en los últimos 5 min y su estado es Activo/Ocupado
        return diff < 5 && (rep.estado === 'Activo' || rep.estado === 'Ocupado');
    };

    const formatLastActive = (date) => {
        if (!date) return 'Nunca';
        const d = new Date(date);
        return d.toLocaleTimeString('es-AR', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'America/Argentina/Buenos_Aires'
        });
    };

    if (loading) return <div className="loading-state">Cargando repartidores...</div>;

    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header">
                <h2>Gestión de Repartidores</h2>
                <button className="btn btn-primary" onClick={loadRepartidores}>Refrescar</button>
            </header>
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
        </div>
    );
};

export default AdminRepartidores;
