import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './DriverDashboard.css';

export default function DriverDashboard() {
  const { driver, loginAsDriver, logoutDriver } = useAuth();
  const [authView, setAuthView] = useState('login');
  const [authLoading, setAuthLoading] = useState(false);
  
  // Dashboard state
  const [driverData, setDriverData] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [activeTab, setActiveTab] = useState('disponibles'); // 'disponibles', 'historial'
  const [pedidos, setPedidos] = useState([]);
  const [historial, setHistorial] = useState([]); // Mock temporal o real local
  
  const [sessionGanancias, setSessionGanancias] = useState(0);
  const [localInfo, setLocalInfo] = useState({ nombre: '', direccion: '' });
  const [montoLocal, setMontoLocal] = useState(0);

  // Modals state
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [pinInput, setPinInput] = useState('');

  // On Login/Load
  useEffect(() => {
    if (driver) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver]);

  // Polling para pedidos disponibles
  useEffect(() => {
    let interval;
    if (driver && isActive) {
      // First fetch
      fetchPedidos();
      // Polling cada 30 segundos
      interval = setInterval(fetchPedidos, 30000);
    } else {
      setPedidos([]);
    }
    return () => clearInterval(interval);
  }, [driver, isActive]);

  // Carga de datos del local para viaje en curso
  useEffect(() => {
    const enViaje = pedidos.find(p => p.estado === 'Confirmado' || p.estado === 'Retirado');
    if (enViaje && enViaje.local_id) {
      Promise.all([
        api.getLocalDatos(enViaje.local_id),
        api.getMontoLocalPedido(enViaje.id, enViaje.local_id)
      ]).then(([lData, monto]) => {
        if (lData) setLocalInfo({ nombre: lData.nombre, direccion: lData.direccion });
        setMontoLocal(monto || 0);
      }).catch(e => console.error(e));
    } else {
      setLocalInfo({ nombre: '', direccion: '' });
      setMontoLocal(0);
    }
  }, [pedidos]);

  const loadData = async () => {
    try {
      const d = await api.repartidorGetDatos(driver.id);
      if (d?.success && d.data) {
        setDriverData(d.data);
        setIsActive(d.data.Estado === 'Activo');
      }
    } catch { toast.error('Error al cargar datos'); }
  };

  const fetchPedidos = async () => {
    if (!driver) return;
    try {
      const res = await api.getPedidosDisponibles(driver.id);
      if (res.success) {
        const sorted = res.data.sort((a,b) => a.id.localeCompare(b.id));
        setPedidos(prev => {
          const pendientesNuevos = sorted.filter(p => p.estado === 'Pendiente');
          const pendientesViejos = prev.filter(p => p.estado === 'Pendiente');
          if (pendientesNuevos.length > pendientesViejos.length) {
            api.playNotificationSound();
          }
          return sorted;
        });
      }
    } catch(err) {
      console.error(err);
    }
  };

  // ─── AUTH ACTIONS ───
  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setAuthLoading(true);
    try {
      const d = await api.repartidorLogin(fd.get('email'), fd.get('password'));
      if (d?.success && d.data) {
        loginAsDriver(d.data.ID);
        toast.success('¡Bienvenido!');
      } else toast.error(d?.error || 'Credenciales incorrectas');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setAuthLoading(true);
    try {
      const d = await api.repartidorRegister({
        nombre: fd.get('nombre'), telefono: fd.get('telefono'),
        email: fd.get('email'), password: fd.get('password'),
        patente: fd.get('patente').toUpperCase(), marcaModelo: fd.get('marcaModelo'),
      });
      if (d?.success) {
        toast.success('¡Registro exitoso! Iniciá sesión.');
        setAuthView('login');
      } else toast.error(d?.error || 'Error al registrar');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const toggleEstado = async () => {
    const newState = isActive ? 'Inactivo' : 'Activo';
    setIsActive(!isActive);
    try {
      const d = await api.repartidorActualizarEstado(driver.id, newState);
      if (!d.success) { setIsActive(isActive); toast.error('No se pudo actualizar'); }
      else {
        toast.success(`Modo ${newState}`);
        if(newState === 'Activo') iniciarGPS();
      }
    } catch { setIsActive(isActive); toast.error('Error de conexión'); }
  };

  const handleLogout = () => {
    logoutDriver();
    setDriverData(null);
    setIsActive(false);
    toast.success('Sesión cerrada');
  };

  const iniciarGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => toast.success('GPS activado (Demostración)'),
        () => toast.error('No se pudo activar GPS')
      );
    }
  };

  // ─── PEDIDO ACTIONS ───
  const aceptarPedido = async (pedidoId) => {
    toast.loading('Aceptando...', { id: 'ac' });
    try {
      const res = await api.updateEstadoPedido(pedidoId, 'Confirmado', driver.id);
      if (res.success) {
        toast.success('¡Pedido aceptado!', { id: 'ac' });
        fetchPedidos();
      } else {
        toast.error(res.error || 'Error al aceptar', { id: 'ac' });
      }
    } catch { toast.error('Error de conexión', { id: 'ac' }); }
  };

  const retirarPedido = async (pedidoId) => {
    if(!window.confirm('¿Confirmas que ya RETIRASTE el pedido del local?')) return;
    toast.loading('Actualizando...', { id: 'ret' });
    try {
      const res = await api.updateEstadoPedido(pedidoId, 'Retirado', driver.id);
      if (res.success) {
        toast.success('Pedido marcado como RETIRADO', { id: 'ret' });
        fetchPedidos();
      } else {
        toast.error(res.error || 'Error', { id: 'ret' });
      }
    } catch { toast.error('Error de conexión', { id: 'ret' }); }
  };

  const confirmarEntregaClick = () => {
    setShowEntregaModal(true);
  };

  const finalizarEntrega = async (pedido) => {
    if (!pinInput || pinInput.length !== 4) return toast.error('Ingresa el PIN de 4 dígitos brindado por el cliente');
    toast.loading('Confirmando entrega...', { id: 'ent' });
    try {
      const res = await api.updateEstadoPedido(pedido.id, 'Entregado', driver.id, pinInput);
      if (res.success) {
        toast.success('¡Entrega confirmada!', { id: 'ent' });
        // Modificar stats locales y cerrar modal
        setSessionGanancias(prev => prev + pedido.monto);
        setHistorial([{...pedido, fecha: new Date().toLocaleTimeString()}, ...historial]);
        setDriverData(prev => ({...prev, PedidosHoy: (prev?.PedidosHoy || 0) + 1}));
        setShowEntregaModal(false);
        setPinInput('');
        setActiveTab('historial');
        fetchPedidos();
      } else {
        toast.error(res.error || 'Error', { id: 'ent' });
      }
    } catch { toast.error('Error de conexión', { id: 'ent' }); }
  };

  // ─── RENDERS ───
  const renderAuth = () => (
    <div className="dd-auth-card card animate-fade-in">
      <div className="card-body">
        <h2>Acceso Repartidor</h2>
        <div className="rd-auth-tabs">
          <button className={`btn ${authView === 'login' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setAuthView('login')}>Iniciar Sesión</button>
          <button className={`btn ${authView === 'register' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setAuthView('register')}>Registrarme</button>
        </div>
        {authView === 'login' ? (
          <form onSubmit={handleLogin} className="dd-form">
            <input name="email" type="email" className="form-input" placeholder="Email" required />
            <input name="password" type="password" className="form-input" placeholder="Contraseña" required />
            <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
              {authLoading ? <span className="spinner spinner-white" /> : 'Iniciar Sesión'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="dd-form">
            <input name="nombre" className="form-input" placeholder="Nombre completo" required />
            <input name="telefono" type="tel" className="form-input" placeholder="Teléfono (ej: +54911...)" required />
            <input name="email" type="email" className="form-input" placeholder="Email" required />
            <input name="password" type="password" className="form-input" placeholder="Contraseña" required />
            <input name="patente" className="form-input" placeholder="Patente de la moto" required />
            <input name="marcaModelo" className="form-input" placeholder="Marca y modelo" required />
            <button type="submit" className="btn btn-success btn-full" disabled={authLoading}>
              {authLoading ? <span className="spinner spinner-white" /> : 'Registrarme'}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  const renderDisponibles = () => {
    // Si hay pedidos Confirmado/Retirado, estamos "En Viaje"
    const enViaje = pedidos.find(p => p.estado === 'Confirmado' || p.estado === 'Retirado');
    
    if (enViaje) {
      const isRetirado = enViaje.estado === 'Retirado';
      return (
        <div className="dd-viaje-card animate-slide-up">
          <div className="dd-viaje-header">
            <h4>Viaje en curso</h4>
            <span className="dd-badge bg-light text-dark">{enViaje.estado}</span>
          </div>
          <div className="dd-viaje-body">
            <div className="dd-viaje-details">
              <h5>Pedido #{enViaje.id.split('-').pop()}</h5>
              <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--red-600)', marginBottom: 5 }}>Monto: ${Number(enViaje.monto).toLocaleString('es-AR')}</p>
              
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: 15 }}>
                <p style={{ margin: '3px 0', fontSize: '1.1rem' }}>
                  <strong>💵 A Cobrar al Cliente:</strong> 
                  <span style={{ color: '#2e7d32', fontWeight: 'bold' }}> {enViaje.pago === 'Efectivo' ? `$${Number(enViaje.monto).toLocaleString('es-AR')}` : '$0 (Ya Pagó)'}</span>
                </p>
                <p style={{ margin: '3px 0', fontSize: '1.1rem' }}>
                  <strong>🏪 A Pagar al Local:</strong> 
                  <span style={{ color: '#d32f2f', fontWeight: 'bold' }}> {enViaje.pago === 'Efectivo' ? `$${Number(montoLocal).toLocaleString('es-AR')}` : '$0'}</span>
                </p>
                {enViaje.pago !== 'Efectivo' && <small style={{ color: 'var(--gray-500)', display: 'block', marginTop: 5 }}>Pago online realizado. No cobres ni pagues efectivo.</small>}
              </div>

              <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 15 }}>
                <h5 style={{ color: '#d32f2f', marginBottom: 8 }}>📍 1. RETIRO</h5>
                <p><strong>Local:</strong> {localInfo.nombre || 'Cargando...'}</p>
                <p><strong>Dirección:</strong> {localInfo.direccion || 'Cargando...'}</p>
              </div>

              <div style={{ margin: '15px 0' }}>
                <button 
                  className={`dd-btn-rojo dd-btn-large ${isRetirado ? 'bg-success' : ''}`} 
                  onClick={() => retirarPedido(enViaje.id)}
                  disabled={isRetirado}
                  style={isRetirado ? {backgroundColor: '#27ae60', border:'none'} : {}}
                >
                  {isRetirado ? '🏍️ Retirado ✓' : '🏍️ Marcar como RETIRADO'}
                </button>
              </div>

              <div style={{ borderTop: '1px solid #eee', paddingTop: 15 }}>
                <h5 style={{ color: '#27ae60', marginBottom: 8 }}>📍 2. ENTREGA</h5>
                <p><strong>Cliente UID:</strong> {enViaje.cliente.substring(0,8)}</p>
                <p><strong>Dirección:</strong> {enViaje.direccion}</p>
              </div>

              <div style={{ marginTop: 15 }}>
                <button 
                  className="dd-btn-verde dd-btn-large" 
                  onClick={confirmarEntregaClick}
                  disabled={!isRetirado}
                >
                  🚀 Marcar como ENTREGADO (PIN)
                </button>
              </div>
            </div>
            
            <div className="dd-action-grid" style={{ marginTop: 25, borderTop: '1px solid #eee', paddingTop: 15, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enViaje.direccion)}`} target="_blank" rel="noreferrer" className="dd-btn-outline" style={{ textAlign: 'center', textDecoration: 'none' }}>
                🗺️ GPS Cliente
              </a>
              {localInfo.direccion && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(localInfo.direccion)}`} target="_blank" rel="noreferrer" className="dd-btn-outline" style={{ textAlign: 'center', textDecoration: 'none' }}>
                  🏢 GPS Local
                </a>
              )}
            </div>
          </div>

          {showEntregaModal && (
            <div className="dd-modal-overlay">
              <div className="dd-modal-content animate-slide-down">
                <div className="dd-modal-header">
                  <h5>Prueba de Entrega</h5>
                  <button className="dd-modal-close" onClick={() => setShowEntregaModal(false)}>×</button>
                </div>
                <div className="dd-modal-body">
                  <div style={{marginBottom: 16}}>
                    <label style={{fontWeight:'bold', display:'block', marginBottom:8}}>Ingresa el PIN de 4 dígitos del cliente</label>
                    <input 
                      type="text" 
                      maxLength="4"
                      placeholder="Ej: 1234"
                      className="form-input" 
                      style={{ fontSize: '24px', textAlign: 'center', letterSpacing: '8px', fontWeight: 'bold' }}
                      value={pinInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setPinInput(val);
                      }}
                    />
                  </div>
                </div>
                <div className="dd-modal-footer">
                  <button className="dd-btn-verde dd-btn-large" onClick={() => finalizarEntrega(enViaje)}>Confirmar Entrega</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // List of pending orders (Disponibles)
    const pendientes = pedidos.filter(p => p.estado === 'Pendiente');
    if (pendientes.length === 0) {
      return (
        <div className="empty-state">
          <h3>No hay pedidos pendientes</h3>
          <p>Los pedidos que te asignen aparecerán aquí cuando estés Activo.</p>
        </div>
      );
    }

    // The oldest order is the first one because we sorted by id ascending
    const primerPendienteId = pendientes[0].id;

    return (
      <div className="dd-orders-grid animate-fade-in">
        {pendientes.map(p => {
          const esFirst = p.id === primerPendienteId;
          return (
            <div className="dd-order-card" key={p.id}>
              <div className="dd-order-head">
                <h5>Pedido #{p.id.substring(4, 12)}</h5>
                <span className="dd-badge bg-warning text-dark">Pendiente</span>
              </div>
              <div className="dd-order-amount">${Number(p.monto).toLocaleString('es-AR')}</div>
              <div className="dd-order-info">
                <p>👤 Cliente UID: {p.cliente.substring(0,8)}</p>
                <p>📍 {p.direccion}</p>
              </div>
              <div className="dd-order-pago">
                <span>Pago:</span>
                <span className={`dd-badge ${p.pago === 'Efectivo' ? 'bg-success' : 'bg-primary'}`}>{p.pago}</span>
              </div>
              <div className="dd-order-actions">
                {esFirst ? (
                  <button className="dd-btn-rojo" onClick={() => aceptarPedido(p.id)}>Aceptar pedido →</button>
                ) : (
                  <small style={{color:'var(--gray-500)', textAlign:'center', display:'block'}}>Debes aceptar el pedido más antiguo primero.</small>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderHistorial = () => {
    if (historial.length === 0) {
      return (
        <div className="empty-state">
          <h3>Aún no hay entregas finalizadas en esta sesión</h3>
        </div>
      );
    }
    return (
      <div className="dd-orders-grid animate-fade-in">
        {historial.map((h, i) => (
          <div className="dd-order-card" key={i}>
            <div className="dd-order-head">
              <small style={{color:'var(--gray-500)'}}>{h.fecha}</small>
              <span className="dd-badge bg-success">Entregado</span>
            </div>
            <p style={{margin:'8px 0', fontWeight:'bold'}}>{h.direccion}</p>
            <div className="dd-order-amount" style={{margin:0}}>${Number(h.monto).toLocaleString('es-AR')}</div>
          </div>
        ))}
      </div>
    );
  };

  // ─── MAIN RENDER ───
  return (
    <div className="dd-page">
      <header className="dd-header">
        <Link to="/">
          <img src="https://i.postimg.cc/ncZsRB0r/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(1).png" alt="Weep" className="dd-logo" />
        </Link>
        <h1>Panel de Repartidores</h1>
      </header>

      <main className="dd-main">
        {!driver ? renderAuth() : (
          <>
            <div className="dd-topbar animate-fade-in">
              <div className="dd-topbar-left">
                <label className="toggle" onClick={toggleEstado}>
                  <input type="checkbox" checked={isActive} readOnly />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </label>
                <span className={`dd-status ${isActive ? 'active' : ''}`}>
                  {isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="dd-topbar-actions">
                <button className="btn btn-secondary btn-sm" onClick={iniciarGPS}>📍 GPS</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowChatModal(true)}>💬 Chat</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }} onClick={handleLogout}>Cerrar sesión</button>
              </div>
            </div>

            <div className="dd-stats-box animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h3>Bienvenido, <span>{driverData?.Nombre || '...'}</span></h3>
              <div className="dd-stats-grid">
                <div className="dd-stat-item">
                  <small>Viajes hoy</small>
                  <strong>{driverData?.PedidosHoy || 0}</strong>
                </div>
                <div className="dd-stat-item">
                  <small>Ganancias sesión</small>
                  <strong>${sessionGanancias}</strong>
                </div>
              </div>
            </div>

            <div className="dd-tabs animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <button className={`dd-tab-link ${activeTab === 'disponibles' ? 'active' : ''}`} onClick={() => setActiveTab('disponibles')}>
                Pendientes
              </button>
              <button className={`dd-tab-link ${activeTab === 'historial' ? 'active' : ''}`} onClick={() => setActiveTab('historial')}>
                Historial
              </button>
            </div>

            <div className="dd-tab-content">
              {activeTab === 'disponibles' ? renderDisponibles() : renderHistorial()}
            </div>

            {/* Chat Modal */}
            {showChatModal && (
              <div className="dd-modal-overlay">
                <div className="dd-modal-content animate-slide-down">
                  <div className="dd-modal-header">
                    <h5>Chat Soporte / Cliente</h5>
                    <button className="dd-modal-close" onClick={() => setShowChatModal(false)}>×</button>
                  </div>
                  <div className="dd-modal-body" style={{height: 300, display: 'flex', flexDirection: 'column', gap: 8}}>
                    <div style={{textAlign:'center', color:'var(--gray-400)', margin:'auto'}}>Chat en tiempo real (demo)</div>
                    {chatMessages.map((msg, i) => (
                      <div key={i} style={{textAlign: 'right'}}>
                        <span style={{background:'var(--blue-500)', color:'white', padding:'8px 16px', borderRadius:'16px', display:'inline-block'}}>{msg}</span>
                      </div>
                    ))}
                  </div>
                  <div className="dd-modal-footer">
                    <input 
                      type="text" 
                      className="dd-chat-input" 
                      placeholder="Escribe aquí..." 
                      value={chatInput} 
                      onChange={e=>setChatInput(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter' && chatInput) { setChatMessages([...chatMessages, chatInput]); setChatInput(''); }}}
                    />
                    <button className="dd-btn-rojo" style={{width: 'auto', padding: '10px 16px'}} onClick={() => { if(chatInput) { setChatMessages([...chatMessages, chatInput]); setChatInput(''); }}}>Enviar</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <footer className="footer" style={{background: 'var(--red-600)', color: 'white', borderTop: 'none', padding: 24, textAlign: 'center'}}>
        <p style={{margin:0}}>© 2026 Weep - Todos los derechos reservados</p>
        <p style={{fontSize:'0.8rem', opacity:0.8, margin:'8px 0 0'}}>PWA optimizada para uso en moto • GPS en tiempo real</p>
      </footer>
    </div>
  );
}
