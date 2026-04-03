import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminPedidos = () => {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadPedidos = async () => {
        setLoading(true);
        try {
            const data = await api.adminGetPedidosGeneral();
            setPedidos(data);
        } catch (err) {
            toast.error('Error al cargar pedidos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPedidos();
    }, []);

    const formatFecha = (fechaStr) => {
        if (!fechaStr) return 'N/A';
        const date = new Date(fechaStr);
        return date.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Argentina/Buenos_Aires'
        });
    };

    if (loading) return <div className="loading-state">Cargando pedidos...</div>;

    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header">
                <h2>Historial de Pedidos General</h2>
                <button className="btn btn-primary" onClick={loadPedidos}>Refrescar</button>
            </header>
            <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID / Ref</th>
                            <th>Cliente</th>
                            <th>Dirección / Obs</th>
                            <th>Total</th>
                            <th>Estado</th>
                            <th>Fecha</th>
                            <th>Metodo / Entrega</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pedidos.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No hay pedidos registrados.</td></tr>
                        ) : (
                            pedidos.map(p => (
                                <tr key={p.id}>
                                    <td>
                                        <div style={{ fontWeight: 600, color: 'var(--red-600)' }}>#{p.num_confirmacion || p.id.substring(0, 8)}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ID: {p.id}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{p.nombre_cliente}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.email_cliente}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem' }}>{p.direccion}</div>
                                        {p.observaciones && (
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                                                "{p.observaciones}"
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 700, color: '#1e293b' }}>
                                            ${Number(p.total).toLocaleString('es-AR')}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${p.estado?.toLowerCase()}`}>
                                            {p.estado || 'Pendiente'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem' }}>{formatFecha(p.created_at || p.fecha)}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.75rem' }}>
                                            <div>💳 {p.metodo_pago}</div>
                                            <div>🛵 {p.tipo_entrega}</div>
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

export default AdminPedidos;
