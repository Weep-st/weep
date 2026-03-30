import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './MisPedidos.css';

export default function MisPedidos() {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [tab, setTab] = React.useState('curso');
  const [enCurso, setEnCurso] = React.useState([]);
  const [historial, setHistorial] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // Seguimiento modal
  const [seguimiento, setSeguimiento] = React.useState(null);
  const [seguimientoLoading, setSeguimientoLoading] = React.useState(false);

  // Calificación modal
  const [calificar, setCalificar] = React.useState(null);
  const [rating, setRating] = React.useState(0);
  const [comentario, setComentario] = React.useState('');
  const [ratingLoading, setRatingLoading] = React.useState(false);

  // Chat state
  const [activeChatPedidoId, setActiveChatPedidoId] = React.useState(null);
  const [chatMessages, setChatMessages] = React.useState([]);
  const [chatInput, setChatInput] = React.useState('');

  // Realtime Chat Subscription for Customer
  React.useEffect(() => {
    if (!activeChatPedidoId) return;

    const channel = api.supabase
      .channel(`chat_${activeChatPedidoId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_pedidos',
        filter: `id_pedido=eq.${activeChatPedidoId}`
      }, (payload) => {
        setChatMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      api.supabase.removeChannel(channel);
    };
  }, [activeChatPedidoId]);

  const loadPedidos = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.getMisPedidos(user.id);
      setEnCurso(data.enCurso || []);
      setHistorial(data.historial || []);
    } catch {
      toast.error('Error al cargar pedidos');
    }
    setLoading(false);
  }, [user]);

  React.useEffect(() => { loadPedidos(); }, [loadPedidos]);
  
  // Polling cada 30 segundos
  React.useEffect(() => {
    if (!user) return;
    const interval = setInterval(loadPedidos, 30000);
    return () => clearInterval(interval);
  }, [user, loadPedidos]);

  const openSeguimiento = async (pedidoId) => {
    setSeguimientoLoading(true);
    setSeguimiento({ idPedido: pedidoId }); // show modal immediately with loading
    try {
      const data = await api.getOrderDetail(user.id, pedidoId);
      if (data.success) {
        setSeguimiento({ idPedido: pedidoId, ...data.detalle });
      } else {
        toast.error('No se pudo cargar el detalle');
        setSeguimiento(null);
      }
    } catch {
      toast.error('Error de conexión');
      setSeguimiento(null);
    }
    setSeguimientoLoading(false);
  };

  const handleReorder = async (pedidoId) => {
    try {
      const data = await api.reOrderItems(user.id, pedidoId);
      if (data.success && data.items.length > 0) {
        data.items.forEach(item => {
          for (let i = 0; i < (item.qty || 1); i++) {
            cart.addItem(item);
          }
        });
        toast.success('Productos agregados al carrito ✓');
        navigate('/pedir');
      } else {
        toast.error('No se pudieron recuperar los productos');
      }
    } catch {
      toast.error('Error al recuperar pedido');
    }
  };

  const handleCalificar = async () => {
    if (rating < 1) { toast.error('Selecciona una calificación'); return; }
    setRatingLoading(true);
    try {
      await api.rateOrder(user.id, calificar, rating, comentario);
      toast.success('¡Gracias por tu calificación!');
      setCalificar(null);
      setRating(0);
      setComentario('');
      loadPedidos();
    } catch {
      toast.error('Error al enviar calificación');
    }
    setRatingLoading(false);
  };

  const openChat = async (pedidoId) => {
    setActiveChatPedidoId(pedidoId);
    setChatMessages([]);
    setChatInput('');
    try {
      const res = await api.getChatMessages(pedidoId);
      if (res.success) setChatMessages(res.data);
    } catch { toast.error('Error al cargar chat'); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatPedidoId) return;
    const msg = chatInput;
    setChatInput('');
    try {
      await api.sendChatMessage(activeChatPedidoId, user.id, msg);
    } catch { toast.error('Error al enviar mensaje'); }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('es-AR', {
        timeZone: 'UTC',
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return '—'; }
  };

  const getBadgeClass = (estado) => {
    const map = {
      'Pendiente': 'badge-warning',
      'Confirmado': 'badge-info',
      'Preparando': 'badge-info',
      'Listo': 'badge-primary',
      'Retirado': 'badge-green',
      'En camino': 'badge-green',
      'Entregado': 'badge-success',
    };
    return map[estado] || 'badge-default';
  };

  const timelineSteps = [
    { key: 'Pendiente', label: 'Recibido', icon: '📋', text: 'Tu pedido fue recibido' },
    { key: 'Confirmado', label: 'Confirmado', icon: '✔️', text: 'El local confirmó tu pedido' },
    { key: 'Listo', label: 'Listo', icon: '👨‍🍳', text: 'Tu pedido está preparado' },
    { key: 'Retirado', label: 'Retirado', icon: '🛵', text: 'El repartidor retiró el pedido' },
    { key: 'En camino', label: 'En camino', icon: '🚀', text: 'Tu pedido va en camino' },
    { key: 'Entregado', label: 'Entregado', icon: '📦', text: '¡Pedido entregado!' },
  ];

  const getTimelineProgress = (estado) => {
    if (estado === 'Aceptado') return 1;
    if (estado === 'Retirado') return 4;
    const idx = timelineSteps.findIndex(s => s.key === estado);
    return idx >= 0 ? idx : 0;
  };

  if (!user) {
    return (
      <div className="mis-pedidos-app">
        <header className="mp-header">
          <Link to="/pedir" className="mp-back">← Volver</Link>
          <h1>Mis Pedidos</h1>
        </header>
        <div className="mp-empty">
          <p>Debés iniciar sesión para ver tus pedidos</p>
          <Link to="/pedir" className="btn btn-primary">Ir a Pedir</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mis-pedidos-app">
      <header className="mp-header">
        <Link to="/pedir" className="mp-back">← Volver a pedir</Link>
        <h1>Mis Pedidos</h1>
      </header>

      {/* ─── Tabs ─── */}
      <div className="mp-tabs">
        <button className={`mp-tab ${tab === 'curso' ? 'active' : ''}`} onClick={() => setTab('curso')}>
          🟢 En curso
        </button>
        <button className={`mp-tab ${tab === 'historial' ? 'active' : ''}`} onClick={() => setTab('historial')}>
          📦 Historial
        </button>
      </div>

      {/* ─── Content ─── */}
      <main className="mp-content">
        {loading ? (
          <div className="mp-loading"><div className="spinner" /> Cargando pedidos...</div>
        ) : tab === 'curso' ? (
          enCurso.length === 0 ? (
            <div className="mp-empty">
              <span className="mp-empty-icon">📭</span>
              <p>No hay pedidos en curso</p>
              <Link to="/pedir" className="btn btn-primary btn-sm">Hacer un pedido</Link>
            </div>
          ) : (
            <div className="mp-grid">
              {enCurso.map(p => (
                <div key={p.idPedido} className="pedido-card card card-hover animate-fade-in">
                  <div className="pedido-card-top">
                    <h3>{p.nombreLocal}</h3>
                    <span className={`pedido-badge ${getBadgeClass(p.estado)}`}>
                      {p.estado === 'Listo' ? 'Listo para envío' : p.estado}
                    </span>
                  </div>
                  <div className="pedido-items-list">
                    {p.itemsResumen?.map((i, idx) => (
                      <div key={idx} className="pedido-item-row">
                        <span className="pedido-item-qty">{i.cantidad}x</span>
                        <span className="pedido-item-name">{i.nombre}</span>
                      </div>
                    ))}
                  </div>
                  {p.numConfirmacion && p.tipoEntrega?.toLowerCase().includes('env') && p.estado !== 'Entregado' && p.estado !== 'Cancelado' && (
                    <div style={{ background: '#eef2f5', padding: '8px', borderRadius: '6px', marginBottom: '12px', textAlign: 'center' }}>
                      <strong style={{ color: '#d32f2f' }}>PIN de Recepción: {p.numConfirmacion}</strong>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#666' }}>
                        Ingresa o dicte el número al repartidor.
                      </p>
                    </div>
                  )}
                  <div className="pedido-card-bottom">
                    <span className="pedido-total">${Number(p.total || 0).toLocaleString('es-AR')}</span>
                    <span className="pedido-date">{formatDate(p.fecha)}</span>
                  </div>
                  <div className="pedido-card-actions-row" style={{ gap: 8 }}>
                    <button className="btn btn-primary btn-sm btn-full" onClick={() => openSeguimiento(p.idPedido)}>
                      Ver seguimiento →
                    </button>
                    {p.repartidorId && 
                     ['Retirado', 'En camino'].includes(p.estado) && (
                      <button className="btn btn-secondary btn-sm" onClick={() => openChat(p.idPedido)} style={{ flex: '0 0 auto', padding: '0 12px' }}>
                        💬 Chat
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          historial.length === 0 ? (
            <div className="mp-empty">
              <span className="mp-empty-icon">📭</span>
              <p>No hay pedidos completados</p>
            </div>
          ) : (
            <div className="mp-grid">
              {historial.map(p => (
                <div key={p.idPedido} className="pedido-card card card-hover animate-fade-in">
                  <div className="pedido-card-top">
                    <h3>{p.nombreLocal}</h3>
                    <span className={`pedido-badge ${getBadgeClass(p.estado)}`}>{p.estado}</span>
                  </div>
                  <div className="pedido-items-list">
                    {p.itemsResumen?.map((i, idx) => (
                      <div key={idx} className="pedido-item-row">
                        <span className="pedido-item-qty">{i.cantidad}x</span>
                        <span className="pedido-item-name">{i.nombre}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pedido-card-bottom">
                    <span className="pedido-total">${Number(p.total || 0).toLocaleString('es-AR')}</span>
                    <span className="pedido-date">{formatDate(p.fecha)}</span>
                  </div>
                  <div className="pedido-card-actions-row">
                    <button className="btn btn-primary btn-sm" onClick={() => handleReorder(p.idPedido)}>
                      Pedir de nuevo
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setCalificar(p.idPedido); setRating(0); setComentario(''); }}>
                      ⭐ Calificar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>

      {/* ─── Seguimiento Modal ─── */}
      {seguimiento && (
        <div className="modal-overlay" onClick={() => setSeguimiento(null)}>
          <div className="modal-box modal-lg animate-fade-in" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSeguimiento(null)}>✕</button>
            <h2>Seguimiento del pedido</h2>
            <p className="modal-subtitle">#{seguimiento.idPedido}</p>

            {seguimientoLoading ? (
              <div className="mp-loading"><div className="spinner" /> Cargando...</div>
            ) : (
              <>
                {/* Timeline */}
                <div className="timeline">
                  {timelineSteps.map((step, i) => {
                    const progress = getTimelineProgress(seguimiento.estadoGeneral || 'Pendiente');
                    const isDone = i <= progress;
                    return (
                      <div key={step.key} className={`timeline-step ${isDone ? 'done' : ''}`}>
                        <div className="timeline-icon">{step.icon}</div>
                        <div className="timeline-info">
                          <strong>{step.label}</strong>
                          <small>{step.text}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Map placeholder */}
                <div className="map-placeholder">
                  🗺️ Mapa del repartidor — próximamente
                </div>

                {/* Order details */}
                <div className="order-details">
                  <h3>Datos del pedido</h3>
                  <div className="detail-row"><span>Local</span><span>{seguimiento.locales?.[0]?.nombreLocal || '—'}</span></div>
                  <div className="detail-row"><span>Repartidor</span><span>{seguimiento.repartidor?.nombre || 'Sin asignar'}</span></div>
                  {seguimiento.repartidor?.telefono && (
                    <div className="detail-row"><span>Teléfono Repartidor</span><span>{seguimiento.repartidor.telefono}</span></div>
                  )}
                  {seguimiento.repartidor?.marca_modelo && (
                    <div className="detail-row"><span>Vehículo</span><span>{seguimiento.repartidor.marca_modelo} {seguimiento.repartidor.patente && `(${seguimiento.repartidor.patente})`}</span></div>
                  )}
                  <div className="detail-row"><span>Dirección</span><span>{seguimiento.direccion || '—'}</span></div>
                  <div className="detail-row"><span>Pago</span><span>{seguimiento.metodoPago || '—'}</span></div>
                  <div className="detail-row"><span>Entrega</span><span>{seguimiento.tipoEntrega || '—'}</span></div>
                  {seguimiento.numConfirmacion && seguimiento.tipoEntrega?.toLowerCase().includes('env') && (
                    <div className="detail-row"><span style={{color: '#d32f2f', fontWeight: 'bold'}}>PIN de Recepción</span><span style={{color: '#d32f2f', fontWeight: 'bold', fontSize: '1.2rem'}}>{seguimiento.numConfirmacion}</span></div>
                  )}
                </div>

                <button className="btn btn-ghost btn-full" style={{ marginTop: 16 }} onClick={() => toast('Función próximamente disponible')}>
                  ❗ Reportar problema
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Calificación Modal ─── */}
      {calificar && (
        <div className="modal-overlay" onClick={() => setCalificar(null)}>
          <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setCalificar(null)}>✕</button>
            <h2>Calificar pedido</h2>
            <p style={{ textAlign: 'center', color: 'var(--gray-600)', marginBottom: 16 }}>¿Cómo fue tu experiencia?</p>
            <div className="stars-row">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  className={`star-btn ${n <= rating ? 'active' : ''}`}
                  onClick={() => setRating(n)}
                >
                  {n <= rating ? '★' : '☆'}
                </button>
              ))}
            </div>
            <textarea
              className="form-textarea"
              placeholder="Comentario (opcional)"
              rows={3}
              value={comentario}
              onChange={e => setComentario(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary btn-full" onClick={() => setCalificar(null)}>Cancelar</button>
              <button className="btn btn-primary btn-full" onClick={handleCalificar} disabled={ratingLoading}>
                {ratingLoading ? <span className="spinner spinner-white" /> : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Chat Modal ─── */}
      {activeChatPedidoId && (
        <div className="modal-overlay" onClick={() => setActiveChatPedidoId(null)}>
          <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()} style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
            <button className="modal-close" onClick={() => setActiveChatPedidoId(null)}>✕</button>
            <h2>Chat con Repartidor</h2>
            <div className="chat-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', padding: '10px 0', borderTop: '1px solid #eee' }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', margin: 'auto' }}>Aún no hay mensajes.</div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} style={{ 
                    textAlign: msg.sender_id === user.id ? 'right' : 'left',
                    marginBottom: 4
                  }}>
                    <div style={{ 
                      background: msg.sender_id === user.id ? 'var(--blue-500)' : '#f0f0f0', 
                      color: msg.sender_id === user.id ? 'white' : '#333', 
                      padding: '8px 12px', 
                      borderRadius: '12px', 
                      display: 'inline-block',
                      maxWidth: '80%',
                      fontSize: '0.9rem',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      {msg.message}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '2px' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
            <form className="chat-footer" onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid #eee' }}>
              <input
                className="form-input"
                style={{ flex: 1, marginBottom: 0 }}
                placeholder="Escribe un mensaje..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0 16px' }}>Enviar</button>
            </form>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>© 2026 <strong>Weep</strong> — Plataforma de Pedidos</p>
      </footer>
    </div>
  );
}
