import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminPagos = ({ tipo = 'Local' }) => {
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null);
    const [viewMode, setViewMode] = useState('solicitudes'); // 'solicitudes' or 'liquidacion'
    const [settlements, setSettlements] = useState([]);
    const [settlementsLoading, setSettlementsLoading] = useState(false);
    const [repFilter, setRepFilter] = useState('Todos');
    const [repartidores, setRepartidores] = useState([]);

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
        if (tipo === 'Repartidor') {
            loadSettlements();
            loadRepartidores();
        }
    }, [tipo]);

    const loadSettlements = async () => {
        setSettlementsLoading(true);
        try {
            const data = await api.adminGetDriverSettlements();
            setSettlements(data);
        } catch (err) {
            console.error(err);
        } finally {
            setSettlementsLoading(false);
        }
    };

    const loadRepartidores = async () => {
        try {
            const data = await api.adminGetRepartidores();
            setRepartidores(data.filter(r => r.admin_status === 'Aceptado'));
        } catch (err) { }
    };

    const handleTogglePaymentStatus = async (pedidoId, currentStatus) => {
        try {
            await api.adminUpdateDriverPaymentStatus(pedidoId, !currentStatus);
            toast.success('Estado actualizado');
            loadSettlements();
        } catch (err) {
            toast.error('Error al actualizar');
        }
    };

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
                <div style={{ display: 'flex', gap: '10px' }}>
                    {tipo === 'Repartidor' && (
                        <div className="btn-group" style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                            <button 
                                className="btn btn-sm" 
                                style={{ background: viewMode === 'solicitudes' ? 'white' : 'transparent', boxShadow: viewMode === 'solicitudes' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                                onClick={() => setViewMode('solicitudes')}
                            >
                                Solicitudes
                            </button>
                            <button 
                                className="btn btn-sm" 
                                style={{ background: viewMode === 'liquidacion' ? 'white' : 'transparent', boxShadow: viewMode === 'liquidacion' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                                onClick={() => setViewMode('liquidacion')}
                            >
                                Liquidación Directa
                            </button>
                        </div>
                    )}
                    <button className="btn btn-primary" onClick={viewMode === 'solicitudes' ? loadSolicitudes : loadSettlements}>
                        Refrescar
                    </button>
                </div>
            </header>

            {viewMode === 'liquidacion' && tipo === 'Repartidor' ? (
                <div className="table-responsive">
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <select 
                            className="filter-select" 
                            value={repFilter} 
                            onChange={(e) => setRepFilter(e.target.value)}
                        >
                            <option value="Todos">Todos los repartidores</option>
                            {repartidores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                        </select>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>* Solo pedidos Entregados</span>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Pedido</th>
                                <th>Repartidor</th>
                                <th style={{ textAlign: 'right' }}>Envío</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settlements.filter(s => repFilter === 'Todos' || s.repartidor_id === repFilter).map(s => (
                                <tr key={s.id}>
                                    <td>{new Date(s.created_at).toLocaleDateString()}</td>
                                    <td>#{s.id.substring(0,8)}</td>
                                    <td>{s.repartidores?.nombre || s.repartidor_id}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>${Number(s.precio_envio).toLocaleString()}</td>
                                    <td>
                                        <span className={`badge ${s.cobro_repartidor_procesado ? 'success' : 'warning'}`}>
                                            {s.cobro_repartidor_procesado ? 'Pagado' : 'Pendiente'}
                                        </span>
                                    </td>
                                    <td>
                                        <button 
                                            className="btn btn-sm btn-light"
                                            onClick={() => handleTogglePaymentStatus(s.id, s.cobro_repartidor_procesado)}
                                        >
                                            {s.cobro_repartidor_procesado ? 'Revertir' : 'Saldar'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
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
                                        <div style={{ fontSize: '0.85rem' }}>Solicitado: {new Date(sol.fecha_solicitud || sol.created_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</div>
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
            )}
        </div>
    );
};

export default AdminPagos;
