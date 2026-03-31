import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminPagos = ({ tipo = 'Local' }) => {
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null);

    const loadSolicitudes = async () => {
        setLoading(true);
        try {
            const data = await api.adminGetGestionCobros(tipo);
            setSolicitudes(data);
        } catch (err) {
            toast.error('Error al cargar solicitudes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSolicitudes();
    }, [tipo]);

    const handleUpdateStatus = async (id, status) => {
        let comprobanteUrl = null;
        if (status === 'Pagado') {
            comprobanteUrl = window.prompt('Opcional: Ingresa la URL del comprobante de transferencia:');
        }

        setProcessing(id);
        try {
            await api.adminUpdateCobroStatus(id, status, comprobanteUrl);
            toast.success(`Solicitud marcada como ${status}`);
            loadSolicitudes();
        } catch (err) {
            toast.error('Error al actualizar solicitud');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return <div className="loading-state">Cargando solicitudes de {tipo}...</div>;

    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header">
                <h2>Gestión de Cobros — {tipo}s</h2>
                <button className="btn btn-primary" onClick={loadSolicitudes}>Refrescar</button>
            </header>
            <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>{tipo}</th>
                            <th>Monto</th>
                            <th>Info</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {solicitudes.length === 0 ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No hay solicitudes pendientes.</td></tr>
                        ) : (
                            solicitudes.map(sol => (
                                <tr key={sol.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>
                                            {tipo === 'Local' ? (sol.locales?.nombre || 'Local #' + sol.local_id) : (sol.repartidores?.nombre || 'Rep #' + sol.repartidor_id)}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {sol.id}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 700, color: '#22c55e', fontSize: '1.1rem' }}>
                                            ${Number(sol.monto_neto).toLocaleString('es-AR')}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Ventas: ${Number(sol.total_ventas).toLocaleString('es-AR')}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem' }}>Solicitado: {new Date(sol.fecha_solicitud || sol.created_at).toLocaleDateString()}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            Pedidos: {sol.pedidos_incluidos || '—'}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${sol.estado?.toLowerCase()}`}>
                                            {sol.estado || 'Pendiente'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {sol.estado === 'Pendiente' ? (
                                                <>
                                                    <button 
                                                        className="btn btn-success btn-sm" 
                                                        onClick={() => handleUpdateStatus(sol.id, 'Pagado')}
                                                        disabled={processing === sol.id}
                                                    >
                                                        Marcar Pagado
                                                    </button>
                                                    <button 
                                                        className="btn btn-danger btn-sm" 
                                                        onClick={() => handleUpdateStatus(sol.id, 'Rechazado')}
                                                        disabled={processing === sol.id}
                                                    >
                                                        Rechazar
                                                    </button>
                                                </>
                                            ) : (
                                                sol.comprobante_url && (
                                                    <a href={sol.comprobante_url} target="_blank" rel="noopener noreferrer" className="btn btn-light btn-sm">Ver Comprobante</a>
                                                )
                                            )}
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

export default AdminPagos;
