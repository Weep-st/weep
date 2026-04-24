import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminPruebas = () => {
    const [locales, setLocales] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    
    // Order Form State
    const [selectedLocalId, setSelectedLocalId] = useState('');
    const [cart, setCart] = useState([]);
    const [metodoPago, setMetodoPago] = useState('Transferencia');
    const [tipoEntrega, setTipoEntrega] = useState('Con Envío');
    const [cliente, setCliente] = useState({
        nombre: 'Cliente de Prueba',
        email: 'prueba@weep.com.ar',
        direccion: 'Av. Corrientes 1234, CABA',
        telefono: '1122334455'
    });

    // Created Pedido State
    const [createdPedido, setCreatedPedido] = useState(null);
    const [pedidoDetalle, setPedidoDetalle] = useState(null);
    const [detalleLoading, setDetalleLoading] = useState(false);

    useEffect(() => {
        const loadInitial = async () => {
            setLoading(true);
            try {
                const resLocales = await api.adminGetLocales();
                setLocales(resLocales.filter(l => l.admin_status === 'Aceptado' || l.admin_status === 'Pendiente'));
                
                const resMenu = await api.adminGetMenuCompleto();
                setMenuItems(resMenu);
            } catch (err) {
                toast.error('Error al cargar datos iniciales');
            } finally {
                setLoading(false);
            }
        };
        loadInitial();
    }, []);

    const handleLocalChange = (localId) => {
        setSelectedLocalId(localId);
        setCart([]); // Reset cart when local changes
    };

    const addToCart = (item) => {
        const existing = cart.find(i => i.id === item.id);
        if (existing) {
            setCart(cart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
        } else {
            setCart([...cart, { ...item, qty: 1 }]);
        }
        toast.success(`${item.nombre} añadido`);
    };

    const removeFromCart = (itemId) => {
        setCart(cart.filter(i => i.id !== itemId));
    };

    const updateQty = (itemId, delta) => {
        setCart(cart.map(i => {
            if (i.id === itemId) {
                const newQty = Math.max(1, i.qty + delta);
                return { ...i, qty: newQty };
            }
            return i;
        }));
    };

    const calculateTotal = () => {
        const subtotal = cart.reduce((sum, item) => sum + (item.precio * item.qty), 0);
        const envio = tipoEntrega === 'Con Envío' ? 2500 : 0; // Mock delivery fee for tests
        return subtotal + envio;
    };

    const handleCreateOrder = async () => {
        if (cart.length === 0) {
            toast.error('Añade al menos un producto');
            return;
        }
        if (!selectedLocalId) {
            toast.error('Selecciona un local');
            return;
        }

        setCreating(true);
        try {
            const orderData = {
                userId: 'USR-PRUEBA-' + Date.now(),
                direccion: cliente.direccion,
                metodoPago: metodoPago.toLowerCase(),
                observaciones: 'PEDIDO DE PRUEBA DESDE ADMIN',
                tipoEntrega: tipoEntrega,
                items: cart.map(i => ({
                    id: i.id,
                    local_id: i.local_id,
                    nombre: i.nombre,
                    precio: i.precio,
                    cantidad: i.qty
                })),
                emailCliente: cliente.email,
                nombreCliente: cliente.nombre,
                estadoInicial: (metodoPago === 'MercadoPago' || metodoPago === 'Transferencia') ? 'Pendiente de Pago' : 'Pendiente',
                totalCalculado: calculateTotal(),
                lat: -34.6037, // Mocked CABA coords
                lng: -58.3816,
                precioEnvio: tipoEntrega === 'Con Envío' ? 2500 : 0
            };

            const res = await api.crearPedido(orderData);
            if (res.success) {
                toast.success('Pedido de prueba creado con éxito!');
                setCreatedPedido(res.pedidoId);
                refreshPedidoDetalle(res.pedidoId);
            }
        } catch (err) {
            console.error(err);
            toast.error('Error al crear pedido: ' + err.message);
        } finally {
            setCreating(false);
        }
    };

    const refreshPedidoDetalle = async (id) => {
        setDetalleLoading(true);
        try {
            const detail = await api.adminGetPedidoDetalle(id);
            setPedidoDetalle(detail);
        } catch (err) {
            toast.error('Error al cargar detalle del pedido');
        } finally {
            setDetalleLoading(false);
        }
    };

    const handleUpdateQuickStatus = async (status) => {
        if (!createdPedido) return;
        try {
            await api.adminUpdatePedidoStatus(createdPedido, status);
            toast.success(`Estado actualizado a: ${status}`);
            refreshPedidoDetalle(createdPedido);
        } catch (err) {
            toast.error('Error al actualizar estado');
        }
    };

    const formatPrice = (p) => `$${Number(p).toLocaleString('es-AR')}`;

    if (loading) return <div className="loading-state">Preparando entorno de pruebas...</div>;

    const filteredMenu = menuItems.filter(i => i.local_id === selectedLocalId);

    return (
        <div className="admin-pruebas-container animate-fade-in">
            <div className="pruebas-grid">
                {/* Panel Izquierdo: Configuración del Pedido */}
                <div className="pruebas-pane config-pane">
                    <section className="pane-section">
                        <h3>1. Datos del Cliente (Mock)</h3>
                        <div className="input-group">
                            <label>Nombre</label>
                            <input type="text" value={cliente.nombre} onChange={e => setCliente({...cliente, nombre: e.target.value})} />
                        </div>
                        <div className="input-group">
                            <label>Email</label>
                            <input type="email" value={cliente.email} onChange={e => setCliente({...cliente, email: e.target.value})} />
                        </div>
                        <div className="input-group">
                            <label>Dirección</label>
                            <input type="text" value={cliente.direccion} onChange={e => setCliente({...cliente, direccion: e.target.value})} />
                        </div>
                    </section>

                    <section className="pane-section">
                        <h3>2. Configuración</h3>
                        <div className="config-row">
                            <div className="input-group">
                                <label>Local</label>
                                <select value={selectedLocalId} onChange={e => handleLocalChange(e.target.value)}>
                                    <option value="">Seleccionar Local...</option>
                                    {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="config-row dvoj">
                            <div className="input-group">
                                <label>Método Pago</label>
                                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                                    <option value="Transferencia">Transferencia (Manual)</option>
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="MercadoPago">MercadoPago (Simular Link)</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Tipo Entrega</label>
                                <select value={tipoEntrega} onChange={e => setTipoEntrega(e.target.value)}>
                                    <option value="Con Envío">Con Envío</option>
                                    <option value="Retiro en Local">Retiro en Local</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    <section className="pane-section">
                        <h3>3. Selección de Productos</h3>
                        <div className="menu-selector-box">
                            {!selectedLocalId ? (
                                <p className="placeholder-text">Selecciona un local para ver su menú</p>
                            ) : (
                                <div className="menu-mini-list">
                                    {filteredMenu.map(item => (
                                        <div key={item.id} className="menu-mini-item">
                                            <div className="item-info">
                                                <strong>{item.nombre}</strong>
                                                <span>{formatPrice(item.precio)}</span>
                                            </div>
                                            <button className="btn-add" onClick={() => addToCart(item)}>+</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Panel Derecho: Carrito y Resultado */}
                <div className="pruebas-pane status-pane">
                    <section className="pane-section cart-section">
                        <h3>Detalle del Pedido Actual</h3>
                        <div className="cart-list">
                            {cart.length === 0 ? (
                                <p className="placeholder-text">Carrito vacío</p>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="cart-item">
                                        <div className="qty-controls">
                                            <button onClick={() => updateQty(item.id, -1)}>-</button>
                                            <span>{item.qty}</span>
                                            <button onClick={() => updateQty(item.id, 1)}>+</button>
                                        </div>
                                        <div className="item-detail">
                                            <strong>{item.nombre}</strong>
                                            <span>{formatPrice(item.precio * item.qty)}</span>
                                        </div>
                                        <button className="btn-remove" onClick={() => removeFromCart(item.id)}>×</button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="cart-summary">
                            {tipoEntrega === 'Con Envío' && <div className="summary-line"><span>Envío</span> <span>$2.500</span></div>}
                            <div className="summary-total">
                                <span>TOTAL</span>
                                <span>{formatPrice(calculateTotal())}</span>
                            </div>
                        </div>
                        <button 
                            className="btn btn-primary btn-block create-btn" 
                            disabled={creating || cart.length === 0}
                            onClick={handleCreateOrder}
                        >
                            {creating ? 'Creando...' : '🚀 Lanzar Pedido de Prueba'}
                        </button>
                    </section>

                    {pedidoDetalle && (
                        <section className="pane-section result-section animate-slide-up">
                            <div className="result-header">
                                <h4>✅ Pedido ID: #{pedidoDetalle.num_confirmacion || pedidoDetalle.id.substring(0,8)}</h4>
                                <span className={`badge ${pedidoDetalle.estado.toLowerCase().replace(' ', '-')}`}>
                                    {pedidoDetalle.estado}
                                </span>
                            </div>

                            <div className="status-timeline">
                                <h5>Simular Estados (Pipeline)</h5>
                                <div className="pipeline-btns">
                                    {(pedidoDetalle.estado === 'Pendiente de Pago' || pedidoDetalle.estado === 'Buscando Repartidor') && (
                                        <button className="btn btn-block btn-confirm-pay" onClick={() => handleUpdateQuickStatus('Confirmado')}>
                                            ✅ Recibir Pago y Marcar como CONFIRMADO
                                        </button>
                                    )}
                                    <div className="step-group">
                                        <button className="btn btn-sm" onClick={() => handleUpdateQuickStatus('Buscando Repartidor')} disabled={pedidoDetalle.estado === 'Buscando Repartidor'}>🔍 Buscando...</button>
                                        <button className="btn btn-sm" onClick={() => handleUpdateQuickStatus('Confirmado')} disabled={pedidoDetalle.estado === 'Confirmado'}>✔️ Confirmado</button>
                                        <button className="btn btn-sm" onClick={() => handleUpdateQuickStatus('Preparando')} disabled={pedidoDetalle.estado === 'Preparando'}>🍳 Preparando</button>
                                        <button className="btn btn-sm" onClick={() => handleUpdateQuickStatus('Listo')} disabled={pedidoDetalle.estado === 'Listo'}>📦 Listo</button>
                                        <button className="btn btn-sm" onClick={() => handleUpdateQuickStatus('En camino')} disabled={pedidoDetalle.estado === 'En camino'}>🏍️ En camino</button>
                                        <button className="btn btn-sm btn-success" onClick={() => handleUpdateQuickStatus('Entregado')} disabled={pedidoDetalle.estado === 'Entregado'}>🏁 Entregado</button>
                                    </div>
                                </div>
                            </div>

                            <div className="order-health-check">
                                <h5>Estado en Hojas (Tablas)</h5>
                                <div className="health-grid">
                                    <div className="health-item">
                                        <span className="label">En pedidos_general:</span>
                                        <span className="value status-pill">{pedidoDetalle.estado}</span>
                                    </div>
                                    <div className="health-item">
                                        <span className="label">En pedidos_locales:</span>
                                        <span className="value status-pill">{pedidoDetalle.locales_info?.[0]?.estado || 'N/A'}</span>
                                    </div>
                                </div>
                                <div style={{marginTop: '10px', fontSize: '0.75rem', color: '#64748b'}}>
                                    * La app de tickets debe detectar el cambio a <strong>Confirmado</strong> en ambas tablas.
                                </div>
                                <button className="btn btn-link" onClick={() => refreshPedidoDetalle(pedidoDetalle.id)}>
                                    🔄 Sincronizar / Refrescar
                                </button>
                            </div>
                        </section>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .btn-confirm-pay {
                    background: #10b981;
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    font-weight: 800;
                    margin-bottom: 5px;
                    box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.4);
                }
                .admin-pruebas-container {
                    padding: 20px;
                    background: #f8fafc;
                    min-height: 100%;
                }
                .pruebas-grid {
                    display: grid;
                    grid-template-columns: 1fr 1.2fr;
                    gap: 25px;
                }
                .pruebas-pane {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .pane-section {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                    border: 1px solid #e2e8f0;
                }
                .pane-section h3 {
                    margin-top: 0;
                    font-size: 1.1rem;
                    color: #1e293b;
                    border-bottom: 2px solid #f1f5f9;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                }
                .input-group {
                    margin-bottom: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                .input-group label {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #64748b;
                }
                .input-group input, .input-group select {
                    padding: 10px;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .input-group input:focus, .input-group select:focus {
                    border-color: #ef4444;
                }
                .config-row {
                    display: grid;
                    gap: 15px;
                }
                .config-row.dvoj { grid-template-columns: 1fr 1fr; }

                .menu-selector-box {
                    max-height: 300px;
                    overflow-y: auto;
                    border: 1px solid #f1f5f9;
                    border-radius: 8px;
                    background: #fbfbfc;
                }
                .menu-mini-list {
                    display: flex;
                    flex-direction: column;
                }
                .menu-mini-item {
                    padding: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #f1f5f9;
                }
                .menu-mini-item:last-child { border-bottom: none; }
                .item-info { display: flex; flex-direction: column; }
                .item-info strong { font-size: 0.9rem; }
                .item-info span { font-size: 0.8rem; color: #ef4444; font-weight: 700; }
                .btn-add {
                    background: #f1f5f9;
                    border: none;
                    width: 30px;
                    height: 30px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    color: #475569;
                    transition: all 0.2s;
                }
                .btn-add:hover { background: #ef4444; color: white; }

                .cart-list { margin-bottom: 20px; }
                .cart-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    background: #f8fafc;
                    border-radius: 8px;
                    margin-bottom: 8px;
                }
                .qty-controls {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: white;
                    padding: 2px 8px;
                    border-radius: 20px;
                    border: 1px solid #e2e8f0;
                }
                .qty-controls button {
                    border: none; background: transparent; cursor: pointer; font-size: 1.2rem;
                }
                .item-detail { flex: 1; display: flex; flex-direction: column; }
                .item-detail strong { font-size: 0.85rem; }
                .item-detail span { font-size: 0.75rem; color: #64748b; }
                .btn-remove { border: none; background: transparent; color: #94a3b8; cursor: pointer; font-size: 1.2rem; }
                .btn-remove:hover { color: #ef4444; }

                .cart-summary {
                    border-top: 2px dashed #e2e8f0;
                    padding-top: 15px;
                    margin-bottom: 20px;
                }
                .summary-line { display: flex; justify-content: space-between; font-size: 0.9rem; color: #64748b; margin-bottom: 5px; }
                .summary-total { display: flex; justify-content: space-between; font-weight: 800; font-size: 1.2rem; color: #1e293b; }

                .btn-block { width: 100%; padding: 15px; font-weight: 700; font-size: 1rem; }
                .create-btn { box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.4); }

                .result-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .status-timeline h5 { margin: 0 0 12px 0; font-size: 0.85rem; color: #64748b; text-transform: uppercase; }
                .pipeline-btns { display: flex; flex-direction: column; gap: 15px; }
                .step-group { display: flex; flex-wrap: wrap; gap: 8px; }
                .btn-mp { background: #009ee3; color: white; }
                .btn-transf { background: #1e293b; color: white; }
                
                .order-health-check {
                    margin-top: 25px;
                    padding: 15px;
                    background: #f0fdf4;
                    border-radius: 10px;
                    border: 1px solid #dcfce7;
                }
                .order-health-check h5 { margin: 0 0 10px 0; color: #166534; font-size: 0.8rem; }
                .health-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .health-item { font-size: 0.8rem; display: flex; flex-direction: column; }
                .health-item .label { color: #4b6352; font-weight: 600; }
                .health-item .value { font-family: monospace; font-size: 0.9rem; color: #166534; }
                .status-pill { background: #166534; color: white !important; padding: 2px 6px; border-radius: 4px; display: inline-block; font-weight: bold; }

                .btn-link { background: none; border: none; color: #ef4444; font-size: 0.75rem; text-decoration: underline; margin-top: 10px; cursor: pointer; }

                .placeholder-text { text-align: center; color: #94a3b8; font-style: italic; padding: 20px; }

                @media (max-width: 1024px) {
                    .pruebas-grid { grid-template-columns: 1fr; }
                }
            `}} />
            <WalletStatsDashboard />
        <WalletCampaignManager />
        </div>
    );
};

const WalletCampaignManager = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editCamp, setEditCamp] = useState({
        name: 'Promo 5% Reintegro',
        type: 'earn',
        value: 5,
        min_order_amount: 8000,
        expiry_days: 5,
        active: true
    });

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.adminGetWalletCampaigns();
            setCampaigns(res);
        } catch (err) {
            toast.error("Error al cargar campañas");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleSave = async () => {
        try {
            await api.adminUpsertWalletCampaign(editCamp);
            toast.success("Campaña guardada");
            load();
            setEditCamp({
                name: '', type: 'earn', value: 0, min_order_amount: 0, expiry_days: 7, active: true
            });
        } catch (err) {
            toast.error("Error al guardar");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Eliminar campaña?")) return;
        try {
            await api.adminDeleteWalletCampaign(id);
            toast.success("Eliminado");
            load();
        } catch (err) {
            toast.error("Error al eliminar");
        }
    };

    const handleEdit = (c) => {
        setEditCamp(c);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    return (
        <section className="pane-section wallet-config-box" style={{ marginTop: '25px', background: '#fff' }}>
            <h3>⚙️ Configuración de Créditos (Marketing)</h3>
            
            <div className="campaign-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
                <div className="input-group">
                    <label>Nombre de la Campaña</label>
                    <input type="text" value={editCamp.name} onChange={e => setEditCamp({...editCamp, name: e.target.value})} placeholder="Ej: Promo Reintegro 5%" />
                </div>
                <div className="input-group">
                    <label>Porcentaje Reintegro (%)</label>
                    <input type="number" value={editCamp.value} onChange={e => setEditCamp({...editCamp, value: Number(e.target.value)})} />
                </div>
                <div className="input-group">
                    <label>Mínimo de Compra ($)</label>
                    <input type="number" value={editCamp.min_order_amount} onChange={e => setEditCamp({...editCamp, min_order_amount: Number(e.target.value)})} />
                </div>
                <div className="input-group">
                    <label>Tope máximo de reintegro ($)</label>
                    <input type="number" value={editCamp.max_cap} onChange={e => setEditCamp({...editCamp, max_cap: Number(e.target.value)})} placeholder="Ej: 500" />
                </div>
                <div className="input-group">
                    <label>Días de Vencimiento</label>
                    <input type="number" value={editCamp.expiry_days} onChange={e => setEditCamp({...editCamp, expiry_days: Number(e.target.value)})} />
                </div>
                <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" checked={editCamp.active} onChange={e => setEditCamp({...editCamp, active: e.target.checked})} id="camp-active" />
                    <label htmlFor="camp-active" style={{ marginBottom: 0 }}>Campaña Activa</label>
                </div>
                <div style={{ alignSelf: 'end' }}>
                    <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', padding: '10px' }}>
                        {editCamp.id ? 'Actualizar Campaña' : 'Crear Nueva Campaña'}
                    </button>
                    {editCamp.id && <button className="btn btn-link" onClick={() => setEditCamp({name: '', type: 'earn', value: 0, min_order_amount: 0, expiry_days: 7, active: true})}>Cancelar Edición</button>}
                </div>
            </div>

            <div className="campaigns-list">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                            <th style={{ padding: '10px' }}>Campaña</th>
                            <th>Valor</th>
                            <th>Mínimo</th>
                            <th>Vencimiento</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {campaigns.map(c => (
                            <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px' }}><strong>{c.name}</strong></td>
                                <td>{c.value}%</td>
                                <td>${c.min_order_amount?.toLocaleString()}</td>
                                <td>{c.expiry_days} días</td>
                                <td><span style={{ color: c.active ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>{c.active ? 'ACTIVA' : 'PAUSADA'}</span></td>
                                <td>
                                    <button className="btn-add" onClick={() => handleEdit(c)} style={{ marginRight: '5px' }}>✎</button>
                                    <button className="btn-add" onClick={() => handleDelete(c.id)} style={{ color: '#ef4444' }}>🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

const WalletStatsDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.getAdminWalletStats();
                setStats(res);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return null;

    return (
        <section className="pane-section wallet-admin-box" style={{ marginTop: '25px', border: '1px solid #bbf7d0', background: '#f0fdf4' }}>
            <h3 style={{ borderBottomColor: '#bbf7d0', color: '#166534' }}>📊 Métricas de Billetera (Total Sistema)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px' }}>
                <div className="stat-card">
                    <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 'bold' }}>Crédito Generado (Earn)</span>
                    <p style={{ fontSize: '1.5rem', margin: 0, fontWeight: '800', color: '#166534' }}>${stats.totalEarned.toLocaleString('es-AR')}</p>
                </div>
                <div className="stat-card">
                    <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 'bold' }}>Crédito Usado (Spend)</span>
                    <p style={{ fontSize: '1.5rem', margin: 0, fontWeight: '800', color: '#ef4444' }}>${stats.totalSpent.toLocaleString('es-AR')}</p>
                </div>
                <div className="stat-card">
                    <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 'bold' }}>Saldo en Billeteras</span>
                    <p style={{ fontSize: '1.5rem', margin: 0, fontWeight: '800', color: '#10b981' }}>${stats.balance.toLocaleString('es-AR')}</p>
                </div>
            </div>
            <p style={{ fontSize: '0.7rem', color: '#166534', marginTop: '15px', opacity: 0.8 }}>
                * Estas métricas son globales de todos los usuarios usando el sistema de crédito.
            </p>
        </section>
    );
};

export default AdminPruebas;
