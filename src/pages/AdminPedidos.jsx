import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminPedidos = () => {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    
    // Modal state
    const [selectedPedido, setSelectedPedido] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [pedidoDetalle, setPedidoDetalle] = useState(null);

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

    const handleOpenDetail = async (id) => {
        setModalLoading(true);
        setSelectedPedido(id);
        try {
            const detalle = await api.adminGetPedidoDetalle(id);
            setPedidoDetalle(detalle);
        } catch (err) {
            toast.error('Error al cargar detalle del pedido');
            setSelectedPedido(null);
        } finally {
            setModalLoading(false);
        }
    };

    const handleCloseModal = () => {
        setSelectedPedido(null);
        setPedidoDetalle(null);
    };

    const handleUpdateStatus = async (pedidoId, newStatus) => {
        if (!window.confirm(`¿Cambiar estado a ${newStatus}?`)) return;
        try {
            // we should have this in api, if not we add it
            await api.supabase.from('pedidos_general').update({ estado: newStatus }).eq('id', pedidoId);
            toast.success('Estado actualizado');
            setPedidoDetalle(prev => ({ ...prev, estado: newStatus }));
            loadPedidos();
        } catch (err) {
            toast.error('Error al actualizar estado');
        }
    };

    const formatFecha = (fechaStr) => {
        if (!fechaStr) return 'N/A';
        const date = new Date(fechaStr);
        return date.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredPedidos = pedidos.filter(p => {
        const matchesSearch = 
            p.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.num_confirmacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.id.includes(searchTerm);
        const matchesStatus = statusFilter === 'Todos' || p.estado === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (loading) return <div className="loading-state">Cargando pedidos...</div>;

    const estadosPosibles = ['Pendiente', 'Confirmado', 'Preparando', 'Listo', 'En camino', 'Entregado', 'Rechazado', 'Cancelado'];

    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header">
                <div className="header-info">
                    <h2>Historial de Pedidos</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{filteredPedidos.length} pedidos encontrados</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input 
                        type="text" 
                        placeholder="Buscar ID o Cliente..." 
                        className="filter-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select 
                        className="filter-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="Todos">Todos los estados</option>
                        {estadosPosibles.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={loadPedidos}>Refrescar</button>
                </div>
            </header>

            <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Nro / ID</th>
                            <th>Cliente</th>
                            <th>Total</th>
                            <th>Estado</th>
                            <th>Repartidor</th>
                            <th>Fecha</th>
                            <th>Pago / Entrega</th>
                            <th>Detalle</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPedidos.length === 0 ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No hay pedidos que coincidan.</td></tr>
                        ) : (
                            filteredPedidos.map(p => (
                                <tr key={p.id}>
                                    <td>
                                        <div style={{ fontWeight: 700, color: 'var(--red-600)' }}>#{p.num_confirmacion || p.id.substring(0, 6)}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{p.id.substring(0, 13)}...</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{p.nombre_cliente}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.email_cliente}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>${Number(p.total).toLocaleString('es-AR')}</div>
                                    </td>
                                    <td>
                                        <span className={`badge ${p.estado?.toLowerCase().replace(' ', '-')}`}>
                                            {p.estado || 'Pendiente'}
                                        </span>
                                    </td>
                                    <td>
                                        {p.repartidores ? (
                                            <div style={{ fontSize: '0.8rem' }}>
                                                <div style={{ fontWeight: 600, color: '#166534' }}>{p.repartidores.nombre}</div>
                                                <div style={{ color: '#64748b' }}>{p.repartidores.telefono}</div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No asignado</div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem' }}>{formatFecha(p.created_at || p.fecha)}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.75rem' }}>
                                            <div>{p.metodo_pago === 'mercadopago' ? '💳 MP' : '💵 EF'}</div>
                                            <div style={{ color: '#64748b' }}>{p.tipo_entrega}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <button className="btn btn-sm btn-outline" onClick={() => handleOpenDetail(p.id)}>
                                            Ver más
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Detalle */}
            {selectedPedido && (
                <div className="admin-modal-overlay" onClick={handleCloseModal}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={handleCloseModal}>×</button>
                        
                        {modalLoading ? (
                            <div className="loading-state">Cargando detalles...</div>
                        ) : pedidoDetalle ? (
                            <div className="pedido-deep-detail">
                                <header className="detail-header">
                                    <div className="badge-status-large">
                                        <span className={`badge ${pedidoDetalle.estado?.toLowerCase().replace(' ', '-')}`}>
                                            {pedidoDetalle.estado}
                                        </span>
                                    </div>
                                    <h3>Pedido #{pedidoDetalle.num_confirmacion || pedidoDetalle.id.substring(0, 8)}</h3>
                                    <p>{formatFecha(pedidoDetalle.created_at)}</p>
                                </header>

                                <div className="detail-grid">
                                    <section className="detail-section">
                                        <h4>👤 Cliente</h4>
                                        <p><strong>Nombre:</strong> {pedidoDetalle.nombre_cliente}</p>
                                        <p><strong>Email:</strong> {pedidoDetalle.email_cliente}</p>
                                        <p><strong>Dirección:</strong> {pedidoDetalle.direccion}</p>
                                        {pedidoDetalle.observaciones && (
                                            <p className="obs-box"><strong>Obs:</strong> {pedidoDetalle.observaciones}</p>
                                        )}
                                    </section>

                                    <section className="detail-section">
                                        <h4>💳 Pago y Entrega</h4>
                                        <p><strong>Método:</strong> {pedidoDetalle.metodo_pago.toUpperCase()}</p>
                                        <p><strong>Entrega:</strong> {pedidoDetalle.tipo_entrega}</p>
                                        <p><strong>Total:</strong> <span className="total-price">${Number(pedidoDetalle.total).toLocaleString('es-AR')}</span></p>
                                        <p><strong>PIN de Entrega:</strong> <span style={{ color: 'var(--red-600)', fontWeight: 'bold', fontSize: '1.1rem' }}>{pedidoDetalle.num_confirmacion || 'N/A'}</span></p>
                                        {pedidoDetalle.repartidores && (
                                            <div className="driver-info-box" style={{ marginTop: '10px', padding: '10px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                                                <p style={{ margin: 0, fontWeight: 700, color: '#166534' }}>🛵 Repartidor Asignado:</p>
                                                <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}><strong>Nombre:</strong> {pedidoDetalle.repartidores.nombre}</p>
                                                <p style={{ margin: '2px 0 0 0', fontSize: '0.9rem' }}><strong>Teléfono:</strong> {pedidoDetalle.repartidores.telefono || 'No disponible'}</p>
                                            </div>
                                        )}
                                        {pedidoDetalle.mercadopago_payment_id && (
                                            <div className="mp-info">
                                                <p><strong>MP ID:</strong> {pedidoDetalle.mercadopago_payment_id}</p>
                                                {pedidoDetalle.payment_metadata && (
                                                    <p><strong>Tarjeta:</strong> {pedidoDetalle.payment_metadata.card_brand} **** {pedidoDetalle.payment_metadata.last_four}</p>
                                                )}
                                            </div>
                                        )}
                                    </section>
                                </div>

                                <section className="detail-section">
                                    <h4>🏢 Locales del Pedido</h4>
                                    <div className="locales-list">
                                        {pedidoDetalle.locales_info && pedidoDetalle.locales_info.map(li => (
                                            <div key={li.id} className="local-item-detail" style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
                                                <strong>{li.locales?.nombre}</strong> 
                                                <span style={{ marginLeft: '10px', fontSize: '0.85rem' }} className={`badge ${li.estado?.toLowerCase().replace(' ', '-')}`}>{li.estado}</span>
                                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Total Local: ${Number(li.total).toLocaleString('es-AR')}</div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="detail-section items-section">
                                    <h4>📦 Productos</h4>
                                    <table className="items-table">
                                        <thead>
                                            <tr>
                                                <th>Cant</th>
                                                <th>Producto</th>
                                                <th>Local</th>
                                                <th>Unit.</th>
                                                <th>Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pedidoDetalle.items.map(item => {
                                                const local = (pedidoDetalle.locales_info || []).find(l => l.local_id === item.local_id);
                                                return (
                                                    <tr key={item.id}>
                                                        <td>{item.cantidad}x</td>
                                                        <td>{item.nombre || item.nombre_item}</td>
                                                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{local?.locales?.nombre || '—'}</td>
                                                        <td>${Number(item.precio_unitario).toLocaleString('es-AR')}</td>
                                                        <td>${Number(item.subtotal).toLocaleString('es-AR')}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            {pedidoDetalle.precio_envio > 0 && (
                                              <tr style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                                  <td colSpan="3">ENVÍO</td>
                                                  <td>${Number(pedidoDetalle.precio_envio).toLocaleString('es-AR')}</td>
                                              </tr>
                                            )}
                                            <tr>
                                                <td colSpan="3">TOTAL</td>
                                                <td>${Number(pedidoDetalle.total).toLocaleString('es-AR')}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </section>

                                <footer className="detail-footer">
                                    <h4>Acciones de Estado</h4>
                                    <div className="action-buttons">
                                        {estadosPosibles.map(est => (
                                            <button 
                                                key={est} 
                                                className={`btn btn-sm ${pedidoDetalle.estado === est ? 'btn-primary' : 'btn-outline'}`}
                                                onClick={() => handleUpdateStatus(pedidoDetalle.id, est)}
                                                disabled={pedidoDetalle.estado === est}
                                            >
                                                {est}
                                            </button>
                                        ))}
                                    </div>
                                </footer>
                            </div>
                        ) : (
                            <p>No se pudo cargar la información.</p>
                        )}
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .btn-outline {
                    background: transparent;
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 0.75rem;
                }
                .btn-outline:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                }
                .admin-modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                    padding: 20px;
                }
                .admin-modal-content {
                    background: white;
                    border-radius: 12px;
                    width: 100%;
                    max-width: 800px;
                    max-height: 90vh;
                    overflow-y: auto;
                    position: relative;
                    padding: 30px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                }
                .modal-close-btn {
                    position: absolute;
                    top: 15px; right: 15px;
                    border: none; background: #f1f5f9;
                    width: 30px; height: 30px;
                    border-radius: 50%; cursor: pointer;
                    font-size: 1.2rem; display: flex;
                    align-items: center; justify-content: center;
                }
                .pedido-deep-detail h3 { margin: 0; color: #1e293b; }
                .detail-header { text-align: center; margin-bottom: 25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; }
                .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
                .detail-section h4 { 
                    font-size: 0.8rem; text-transform: uppercase; 
                    letter-spacing: 0.05em; color: #94a3b8; 
                    margin-bottom: 12px; border-bottom: 2px solid #f8fafc;
                    display: inline-block;
                }
                .detail-section p { margin: 6px 0; font-size: 0.95rem; color: #334155; }
                .obs-box { background: #fffbeb; padding: 10px; border-radius: 6px; border: 1px solid #fef3c7; font-style: italic; }
                .total-price { font-size: 1.2rem; font-weight: 800; color: #10b981; }
                .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .items-table th { text-align: left; font-size: 0.75rem; color: #64748b; padding: 10px; border-bottom: 1px solid #f1f5f9; }
                .items-table td { padding: 10px; border-bottom: 1px solid #f8fafc; font-size: 0.9rem; }
                .items-table tfoot td { font-weight: 800; padding-top: 15px; border-bottom: none; }
                .action-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
                .mp-info { margin-top: 10px; padding: 10px; background: #f0f9ff; border-radius: 6px; border: 1px solid #e0f2fe; font-size: 0.85rem; }
            `}} />
        </div>
    );
};

export default AdminPedidos;
