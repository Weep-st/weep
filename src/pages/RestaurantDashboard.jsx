import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './RestaurantDashboard.css';

export default function RestaurantDashboard() {
  const { restaurant, loginAsRestaurant, logoutRestaurant } = useAuth();

  const [view, setView] = useState('orders'); // 'menu','addItem','orders','profile'
  const [authView, setAuthView] = useState('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [localOpen, setLocalOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuFilter, setMenuFilter] = useState('');
  const [menuCatFilter, setMenuCatFilter] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('pendientes');
  const [pendingCount, setPendingCount] = useState(0);
  const [cobrosData, setCobrosData] = useState(null);
  const [cobrosLoading, setCobrosLoading] = useState(false);
  const pollingRef = useRef(null);
  const previousOrdersRef = useRef([]);
  const localOpenRef = useRef(false);

  const playAlertSound = () => {
    try {
      api.playNotificationSound();
    } catch (e) {}
  };

  const loadEstado = useCallback(async () => {
    if (!restaurant) return;
    try {
      const d = await api.getLocalEstado(restaurant.id);
      if (d && 'estado' in d) {
        const isOpen = String(d.estado).toLowerCase() === 'activo';
        setLocalOpen(isOpen);
        localOpenRef.current = isOpen;
      }
    } catch {}
  }, [restaurant]);

  const loadProfile = useCallback(async () => {
    if (!restaurant) return;
    try {
      const d = await api.getPerfilLocal(restaurant.id);
      if (d.success) setProfileData(d);
    } catch {}
  }, [restaurant]);

  /* ─── Modo Automático ─── */
  const estaDentroDeHorario = useCallback((apertura, cierre) => {
    if (!apertura || !cierre) return false;
    const [hA, mA] = apertura.split(':').map(Number);
    const [hC, mC] = cierre.split(':').map(Number);
    const minApertura = hA * 60 + mA;
    const minCierre = hC * 60 + mC;
    
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();

    if (minApertura < minCierre) {
      return current >= minApertura && current <= minCierre;
    } else {
      return current >= minApertura || current <= minCierre;
    }
  }, []);

  const verificarEstadoAutomatico = useCallback(() => {
    if (!profileData || !profileData.modo_automatico || !profileData.horario_apertura || !profileData.horario_cierre) return;
    
    const shouldBeOpen = estaDentroDeHorario(profileData.horario_apertura, profileData.horario_cierre);
    
    if (localOpenRef.current !== shouldBeOpen) {
      const nuevoEstado = shouldBeOpen ? 'Activo' : 'Inactivo';
      setLocalOpen(shouldBeOpen);
      localOpenRef.current = shouldBeOpen;
      
      api.updateLocalEstado(restaurant?.id, nuevoEstado).then(res => {
        if (!res.success) {
           console.error("Error auto-updating estado en backend");
        } else {
           console.log(`[AUTO] Estado cambiado a ${nuevoEstado} según horario`);
           toast.success(`[Modo Automático] Local ${shouldBeOpen ? 'Abierto' : 'Cerrado'}`, { icon: '🕰️' });
        }
      }).catch(err => console.error(err));
    }
  }, [profileData, restaurant, estaDentroDeHorario]);

  const loadMenu = useCallback(async () => {
    if (!restaurant) return;
    setMenuLoading(true);
    try {
      const items = await api.getMenuByLocalId(restaurant.id);
      setMenuItems(Array.isArray(items) ? items : []);
    } catch { toast.error('Error al cargar menú'); }
    setMenuLoading(false);
  }, [restaurant]);

  const loadOrders = useCallback(async (silent = false) => {
    if (!restaurant) return;
    if (!silent) setOrdersLoading(true);
    try {
      const all = await api.getPedidosLocalesByLocal(restaurant.id);
      if (!all || all.length === 0) { setOrders([]); setPendingCount(0); if (!silent) setOrdersLoading(false); return; }

      const processed = [];
      for (const p of all) {
        const [resItems, resGeneral] = await Promise.all([
          api.getItemsByPedidoLocal(p[1], p[2]),
          api.getPedidoGeneral(p[1]),
        ]);
        processed.push({
          idPedidoLocal: p[0], idPedido: p[1], estadoActual: p[4] || 'Pendiente',
          items: resItems,
          direccion: resGeneral.direccion || 'Retiro en local',
          observaciones: resGeneral.observaciones || 'Ninguna',
          metodoPago: resGeneral.metodoPago || 'No especificado',
          tipoEntrega: resGeneral.tipoEntrega || 'Para Retirar',
          emailCliente: resGeneral.emailCliente || '',
          nombreCliente: resGeneral.nombreCliente || 'Cliente',
          fecha: resGeneral.fecha,
          numConfirmacion: resGeneral.numConfirmacion,
          repartidorId: resGeneral.repartidorId,
          localId: p[2],
          totalLocal: Number(p[3]) || 0,
        });
      }

      // Check new pending orders for alerts
      if (silent && previousOrdersRef.current.length > 0) {
        const previousIds = previousOrdersRef.current.map(o => o.idPedidoLocal);
        const newPendings = processed.filter(o => o.estadoActual === 'Pendiente' && !previousIds.includes(o.idPedidoLocal));
        if (newPendings.length > 0) {
          playAlertSound();
          toast.success(`Tenés ${newPendings.length} pedido(s) nuevo(s)!`, { icon: '🔔' });
        }
      }
      previousOrdersRef.current = processed;

      setOrders(processed);
      setPendingCount(processed.filter(o => o.estadoActual === 'Pendiente').length);
    } catch { if (!silent) toast.error('Error al cargar pedidos'); }
    if (!silent) setOrdersLoading(false);
  }, [restaurant]);

  // Load data on login and window focus
  useEffect(() => {
    if (!restaurant) return;
    loadEstado();
    loadProfile();
    loadOrders();
    
    const handleFocus = () => loadOrders(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollingRef.current);
      window.removeEventListener('focus', handleFocus);
    };
  }, [restaurant, loadEstado, loadProfile, loadOrders]);

  // Polling
  useEffect(() => {
    if (!restaurant) return;
    pollingRef.current = setInterval(() => {
      loadOrders(true);
    }, 25000);
    return () => clearInterval(pollingRef.current);
  }, [restaurant, loadOrders]);

  // Modo Automatico Auto-update
  useEffect(() => {
    if (!profileData?.modo_automatico) return;
    
    verificarEstadoAutomatico(); // Check immediately
    
    const intervalId = setInterval(() => {
      verificarEstadoAutomatico();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [profileData?.modo_automatico, profileData?.horario_apertura, profileData?.horario_cierre, verificarEstadoAutomatico]);

  const loadCobros = async () => {
    if (!restaurant) return;
    setCobrosLoading(true);
    try {
      const d = await api.getCobrosByLocal(restaurant.id);
      if (d.success) setCobrosData(d);
    } catch { toast.error('Error al cargar cobros'); }
    setCobrosLoading(false);
  };

  const handleSolicitarCobro = async (monto) => {
    try {
      setCobrosLoading(true);
      const res = await api.solicitarCobro(restaurant.id, monto);
      if (res.success) {
        toast.success('Solicitud enviada');
        loadCobros();
      } else {
        toast.error(res.error || 'Error al solicitar');
      }
    } catch { toast.error('Error de red'); }
    setCobrosLoading(false);
  };

  const toggleEstado = async () => {
    const newState = localOpen ? 'Inactivo' : 'Activo';
    const newBool = !localOpen;
    setLocalOpen(newBool);
    localOpenRef.current = newBool;
    try {
      const d = await api.updateLocalEstado(restaurant.id, newState);
      if (!d.success) { 
        setLocalOpen(!newBool); 
        localOpenRef.current = !newBool;
        toast.error('No se pudo cambiar'); 
      }
    } catch { 
      setLocalOpen(!newBool); 
      localOpenRef.current = !newBool;
      toast.error('Error de conexión'); 
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setAuthLoading(true);
    try {
      const d = await api.loginLocal(fd.get('email'), fd.get('password'));
      if (d.success && d.localId) { loginAsRestaurant(d.localId); toast.success('¡Bienvenido!'); }
      else toast.error('Credenciales incorrectas');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setAuthLoading(true);
    try {
      await api.registerLocal(fd.get('nombre'), fd.get('direccion'), fd.get('email'), fd.get('password'));
      toast.success('¡Local registrado! Iniciá sesión.');
      setAuthView('login');
    } catch { toast.error('Error al registrar'); }
    setAuthLoading(false);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const file = fd.get('foto');
    setItemLoading(true);
    try {
      let imgUrl = '';
      if (file && file.size > 0) imgUrl = await api.uploadImage(file);
      const data = {
        localId: restaurant.id,
        nombre: fd.get('nombre'), categoria: fd.get('categoria'),
        descripcion: fd.get('descripcion'), precio: fd.get('precio'),
        disponibilidad: fd.get('disponibilidad') === 'true',
        tamano_porcion: fd.get('tamano_porcion'), variantes: fd.get('variantes'),
        tiempo_preparacion: fd.get('tiempo_preparacion'),
        imagen_url: imgUrl,
      };
      if (editItem) {
        data.itemId = editItem.id;
        await api.updateMenuItem(data);
      } else {
        await api.addMenuItem(data);
      }
      toast.success(editItem ? 'Plato actualizado' : 'Plato agregado');
      setEditItem(null);
      setView('menu');
      loadMenu();
    } catch (err) { toast.error(err.message || 'Error al guardar'); }
    setItemLoading(false);
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('¿Eliminar este plato permanentemente?')) return;
    try {
      await api.deleteMenuItem(id);
      toast.success('Plato eliminado');
      loadMenu();
    } catch { toast.error('Error al eliminar'); }
  };

  const handleToggleDisp = async (id, current) => {
    const newDisp = !current;
    try { await api.updateDisponibilidad(id, newDisp); loadMenu(); }
    catch { toast.error('Error'); }
  };

  const handleOrderAction = async (pedido, action) => {
    try {
      await api.updateEstadoLocalOrder(pedido.idPedidoLocal, action);
      
      // Send notifications logic
      try {
        if (action === 'Aceptado') {
          // Mapear items (array de arrays) a formato esperado por notifyCustomerAboutNewOrder
          const mappedCart = pedido.items.map(item => ({
            id: item[2],
            nombre: item[4],
            precio: Number(item[5]),
            cantidad: Number(item[6]),
            qty: Number(item[6]),
            local_id: pedido.localId
          }));
          await api.notifyCustomerAboutNewOrder(
            pedido.idPedido, mappedCart, pedido.direccion, 
            pedido.tipoEntrega, pedido.numConfirmacion, 
            pedido.emailCliente, pedido.nombreCliente
          );

          // Notificar al repartidor si está asignado
          if (pedido.repartidorId) {
            api.repartidorGetDatos(pedido.repartidorId).then(rep => {
              if (rep.success && rep.data?.Email) {
                api.notifyDriverAboutNewOrder(
                  pedido.idPedido, mappedCart, pedido.direccion, 
                  pedido.observaciones, pedido.totalLocal, pedido.metodoPago, rep.data.Email
                ).catch(e => console.error("Error notificando driver desde dashboard:", e));
              }
            }).catch(e => console.error(e));
          }
        } else if (action === 'Listo') {
          const direccionLocal = profileData?.direccion || 'Dirección del local';
          await api.notifyOrderListo(pedido, direccionLocal);
        } else if (action === 'Entregado') {
          await api.notifyOrderEntregado(pedido);
        } else if (action === 'Rechazado') {
          await api.notifyOrderRechazado(pedido);
        }
      } catch (e) {
        console.error('Error enviando email:', e);
      }

      toast.success(`Pedido marcado como ${action}`);
      loadOrders();
    } catch { toast.error('Error al actualizar'); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const file = fd.get('foto');
    try {
      let fotoUrl = '';
      if (file && file.size > 0) fotoUrl = await api.uploadImage(file);
      const params = {
        localId: restaurant.id, nombre: fd.get('nombre'),
        direccion: fd.get('direccion'), email: fd.get('email'),
        horario_apertura: fd.get('horario_apertura'),
        horario_cierre: fd.get('horario_cierre'),
        modo_automatico: fd.get('modo_automatico') === 'true'
      };
      const pass = fd.get('password');
      if (pass) params.password = pass;
      if (fotoUrl) params.foto_url = fotoUrl;
      await api.updatePerfilLocal(params);
      toast.success('Perfil actualizado');
      setProfileData(prev => ({ ...prev, ...params }));
      loadProfile();
      setView('orders');
    } catch { toast.error('Error al guardar perfil'); }
  };

  // Categories for select
  const categories = [...new Set(menuItems.map(i => i.categoria).filter(Boolean))].sort();
  const filteredMenu = menuItems.filter(i => {
    const nameOk = !menuFilter || i.nombre.toLowerCase().includes(menuFilter.toLowerCase());
    const catOk = !menuCatFilter || i.categoria === menuCatFilter;
    return nameOk && catOk;
  });

  const processOrders = orders.filter(o => ['Pendiente', 'Aceptado', 'Listo'].includes(o.estadoActual));
  const finishedOrders = orders.filter(o => ['Entregado', 'Rechazado'].includes(o.estadoActual));
  
  const pendientesOrders = processOrders.filter(o => o.estadoActual === 'Pendiente').sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const preparacionOrders = processOrders.filter(o => o.estadoActual === 'Aceptado');
  const listosOrders = processOrders.filter(o => o.estadoActual === 'Listo');

  const currentTabOrders = currentTab === 'pendientes' ? pendientesOrders :
                           currentTab === 'preparacion' ? preparacionOrders :
                           listosOrders;

  // ─── Auth Screen ───
  if (!restaurant) return (
    <div className="rd-page">
      <header className="rd-header">
        <Link to="/">
          <img src="https://i.postimg.cc/5tKhqD4z/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(5).png" alt="Weep" className="rd-logo" />
        </Link>
        <h1>Panel de Gestión</h1>
      </header>
      <main className="rd-main">
        <div className="rd-auth-card card animate-fade-in">
          <div className="card-body">
            <h2>Acceso Local</h2>
            <div className="rd-auth-tabs">
              <button className={`btn ${authView === 'login' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setAuthView('login')}>Iniciar Sesión</button>
              <button className={`btn ${authView === 'register' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setAuthView('register')}>Registrar Local</button>
            </div>
            {authView === 'login' ? (
              <form onSubmit={handleLogin} className="rd-auth-form">
                <input name="email" type="email" className="form-input" placeholder="Email" required />
                <input name="password" type="password" className="form-input" placeholder="Contraseña" required />
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Iniciar Sesión'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="rd-auth-form">
                <input name="nombre" className="form-input" placeholder="Nombre del Local" required />
                <input name="direccion" className="form-input" placeholder="Dirección (calle, número, barrio)" required />
                <input name="email" type="email" className="form-input" placeholder="Email" required />
                <input name="password" type="password" className="form-input" placeholder="Contraseña" required />
                <button type="submit" className="btn btn-success btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Registrar Local'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
      <footer className="footer"><p>© 2026 <strong>Weep</strong></p></footer>
    </div>
  );

  // ─── Dashboard ───
  return (
    <div className="rd-page">
      <header className="rd-header">
        <Link to="/">
          <img src="https://i.postimg.cc/5tKhqD4z/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(5).png" alt="Weep" className="rd-logo" />
        </Link>
        <h1>Panel de Gestión</h1>
      </header>

      <main className="rd-main">
        {/* Top bar */}
        <div className="rd-topbar animate-fade-in">
          <div className="rd-topbar-left">
            <label className="toggle" onClick={toggleEstado}>
              <input type="checkbox" checked={localOpen} readOnly />
              <span className="toggle-track" />
              <span className="toggle-thumb" />
            </label>
            <span className={`rd-status ${localOpen ? 'open' : ''}`}>{localOpen ? 'Abierto' : 'Cerrado'}</span>
          </div>
          <div className="rd-topbar-right">
            {profileData?.foto_url && <img src={profileData.foto_url} alt="" className="rd-avatar" />}
            <button className="btn btn-ghost btn-sm" onClick={() => { setView('profile'); loadProfile(); }}>Mi Perfil</button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }} onClick={() => { logoutRestaurant(); window.location.reload(); }}>Salir</button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="rd-nav animate-slide-up" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          <button className={`rd-nav-btn ${view === 'orders' ? 'active' : ''}`} onClick={() => { setView('orders'); loadOrders(); }}>
            📋 Pedidos
            {pendingCount > 0 && <span className="rd-nav-badge">{pendingCount}</span>}
          </button>
          <button className={`rd-nav-btn ${view === 'menu' ? 'active' : ''}`} onClick={() => { setView('menu'); loadMenu(); }}>📖 Menú</button>
          <button className={`rd-nav-btn ${view === 'addItem' ? 'active' : ''}`} onClick={() => { setEditItem(null); setView('addItem'); }}>➕ Plato</button>
          <button className={`rd-nav-btn ${view === 'ventas' ? 'active' : ''}`} onClick={() => { setView('ventas'); }}>💰 Ventas</button>
          <button className={`rd-nav-btn ${view === 'cobros' ? 'active' : ''}`} onClick={() => { setView('cobros'); loadCobros(); }}>🏦 Cobros</button>
        </nav>

        {/* ─── Orders View ─── */}
        {view === 'orders' && (
          <section className="animate-fade-in">
            <div className="rd-tabs" style={{ gap: 8 }}>
              <button className={currentTab === 'pendientes' ? 'active' : ''} onClick={() => setCurrentTab('pendientes')} style={{ position: 'relative' }}>
                Pendientes <span className="badge badge-amber" style={{ marginLeft: 6 }}>{pendientesOrders.length}</span>
              </button>
              <button className={currentTab === 'preparacion' ? 'active' : ''} onClick={() => setCurrentTab('preparacion')} style={{ position: 'relative' }}>
                En Preparación <span className="badge badge-info" style={{ marginLeft: 6 }}>{preparacionOrders.length}</span>
              </button>
              <button className={currentTab === 'listos' ? 'active' : ''} onClick={() => setCurrentTab('listos')} style={{ position: 'relative' }}>
                Listos <span className="badge badge-blue" style={{ marginLeft: 6 }}>{listosOrders.length}</span>
              </button>
            </div>
            {ordersLoading ? (
              <div className="loading-state"><div className="spinner" /> Cargando...</div>
            ) : currentTabOrders.length === 0 ? (
              <p className="rd-empty">No hay pedidos en esta sección</p>
            ) : currentTabOrders.map(o => (
              <OrderCard key={o.idPedidoLocal} order={o} onAction={handleOrderAction} />
            ))}
          </section>
        )}

        {/* ─── Menu View ─── */}
        {view === 'menu' && (
          <section className="animate-fade-in">
            <div className="rd-menu-filters">
              <input className="form-input" placeholder="🔍 Buscar plato..." value={menuFilter} onChange={e => setMenuFilter(e.target.value)} />
              <select className="form-select" value={menuCatFilter} onChange={e => setMenuCatFilter(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {menuLoading ? (
              <div className="loading-state"><div className="spinner" /> Cargando menú...</div>
            ) : filteredMenu.length === 0 ? (
              <p className="rd-empty">No hay platos. ¡Agregá tu primer plato!</p>
            ) : filteredMenu.map(item => (
              <div key={item.id} className="rd-menu-item card">
                {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} className="rd-menu-img" /> :
                  <div className="rd-menu-img-placeholder">Sin foto</div>}
                <div className="rd-menu-info">
                  <div className="rd-menu-top">
                    <div>
                      <h3>{item.nombre}</h3>
                      <p>{item.descripcion || ''}</p>
                      <span className="badge badge-gray">{item.categoria || 'Sin categoría'}</span>
                    </div>
                    <span className="rd-menu-price">${parseFloat(item.precio).toFixed(0)}</span>
                  </div>
                  <div className="rd-menu-bottom">
                    <label className="toggle" onClick={() => handleToggleDisp(item.id, item.disponibilidad)}>
                      <input type="checkbox" checked={item.disponibilidad === true} readOnly />
                      <span className="toggle-track" />
                      <span className="toggle-thumb" />
                    </label>
                    <span className="rd-disp-text">{item.disponibilidad ? 'Disponible' : 'No disponible'}</span>
                    <div className="rd-menu-actions">
                      <button className="btn btn-sm" style={{ background: 'var(--amber-500)', color: '#fff' }} onClick={() => { setEditItem(item); setView('addItem'); }}>Editar</button>
                      <button className="btn btn-sm" style={{ background: 'var(--red-500)', color: '#fff' }} onClick={() => handleDeleteItem(item.id)}>Eliminar</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ─── Add/Edit Item ─── */}
        {view === 'addItem' && (
          <section className="animate-fade-in">
            <div className="card card-body">
              <h2 style={{ color: 'var(--red-600)', marginBottom: 16 }}>{editItem ? 'Editar Plato' : 'Nuevo Plato'}</h2>
              <form onSubmit={handleSaveItem} className="rd-item-form">
                <div className="rd-form-row">
                  <input name="nombre" className="form-input" placeholder="Nombre del plato" defaultValue={editItem?.nombre || ''} required />
                  <select name="categoria" className="form-select" defaultValue={editItem?.categoria || ''} required>
                    <option value="">Categoría</option>
                    <option value="Hamburguesas">Hamburguesas</option>
                    <option value="Pizza">Pizzas</option>
                    <option value="Empanadas">Empanadas</option>
                    <option value="Merienda">Panadería</option>
                    <option value="Bebidas">Bebidas</option>
                  </select>
                </div>
                <textarea name="descripcion" className="form-textarea" rows={2} placeholder="Descripción" defaultValue={editItem?.descripcion || ''} />
                <div className="rd-form-row rd-form-row-3">
                  <input name="precio" type="number" className="form-input" placeholder="Precio" step="0.01" defaultValue={editItem?.precio || ''} required />
                  <select name="disponibilidad" className="form-select" defaultValue={editItem ? (editItem.disponibilidad ? 'true' : 'false') : 'true'}>
                    <option value="true">Disponible</option>
                    <option value="false">No disponible</option>
                  </select>
                  <select name="tamano_porcion" className="form-select" defaultValue={editItem?.tamano || ''}>
                    <option value="">Tamaño/Porción</option>
                    <option value="1 persona">1 persona</option>
                    <option value="2 personas">2 personas</option>
                    <option value="3 personas">3 personas</option>
                    <option value="4+ personas">4+ personas</option>
                  </select>
                </div>
                <div className="rd-form-row">
                  <input name="variantes" className="form-input" placeholder="Variantes (ej: con cheddar)" defaultValue={editItem?.variantes || ''} />
                  <input name="tiempo_preparacion" type="number" className="form-input" placeholder="Tiempo prep. (min)" defaultValue={editItem?.tiempo_preparacion || ''} />
                </div>
                <input name="foto" type="file" className="form-input" accept="image/*" />
                <div className="rd-form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => { setEditItem(null); setView('menu'); loadMenu(); }}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={itemLoading}>
                    {itemLoading ? <span className="spinner spinner-white" /> : (editItem ? 'Guardar Cambios' : 'Guardar Plato')}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ─── Mis Ventas ─── */}
        {view === 'ventas' && (
          <section className="animate-fade-in">
            <h2 style={{ color: 'var(--red-600)', marginBottom: 16 }}>Mis Ventas</h2>
            <div className="card" style={{ padding: '16px', overflowX: 'auto' }}>
              {finishedOrders.length === 0 ? (
                <p className="rd-empty">No hay ventas registradas aún.</p>
              ) : (
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                      <th style={{ padding: '12px 8px' }}>Pedido #</th>
                      <th style={{ padding: '12px 8px' }}>Fecha</th>
                      <th style={{ padding: '12px 8px' }}>Cliente</th>
                      <th style={{ padding: '12px 8px' }}>Método</th>
                      <th style={{ padding: '12px 8px' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finishedOrders.map(o => (
                      <tr key={o.idPedidoLocal} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                        <td style={{ padding: '12px 8px' }}>{o.idPedido}</td>
                        <td style={{ padding: '12px 8px' }}>{o.fecha ? new Date(o.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' }) : '---'}</td>
                        <td style={{ padding: '12px 8px' }}>{o.nombreCliente}</td>
                          <td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>{o.metodoPago}</td>
                          <td style={{ padding: '12px 8px', fontWeight: '600', color: 'var(--red-600)' }}>
                            ${o.totalLocal.toFixed(0)}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* ─── Gestión de Cobros ─── */}
        {view === 'cobros' && (
          <section className="animate-fade-in">
            <h2 style={{ color: 'var(--red-600)', marginBottom: 16, textAlign: 'center' }}>Gestión de Cobros</h2>
            <p style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: 24 }}>Pagos con Transferencia • Comisión Weep 5% • Retira tu dinero</p>
            
            {cobrosLoading || !cobrosData ? (
              <div className="loading-state"><div className="spinner" /> Cargando...</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                  <div className="card" style={{ padding: '24px', textAlign: 'center', borderTop: '4px solid var(--gray-400)' }}>
                    <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.9rem' }}>Ventas Totales</p>
                    <h3 style={{ margin: '8px 0 0', fontSize: '1.8rem' }}>${cobrosData.totalVentas}</h3>
                  </div>
                  <div className="card" style={{ padding: '24px', textAlign: 'center', borderTop: '4px solid var(--amber-500)' }}>
                    <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.9rem' }}>Ingresado Transferencias</p>
                    <h3 style={{ margin: '8px 0 0', fontSize: '1.8rem' }}>${cobrosData.totalIngresadoTransferencia}</h3>
                  </div>
                  <div className="card" style={{ padding: '24px', textAlign: 'center', borderTop: '4px solid var(--red-600)' }}>
                    <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.9rem' }}>Comisión Weep (5%)</p>
                    <h3 style={{ margin: '8px 0 0', fontSize: '1.8rem', color: 'var(--red-600)' }}>-${cobrosData.comisionWeep}</h3>
                  </div>
                  <div className="card" style={{ padding: '24px', textAlign: 'center', borderTop: '4px solid var(--green-500)' }}>
                    <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.9rem' }}>Disponible Para Retirar</p>
                    <h3 style={{ margin: '8px 0 0', fontSize: '1.8rem', color: 'var(--green-600)' }}>${cobrosData.montoDisponibleParaRetirar}</h3>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <button 
                    className="btn btn-success" 
                    style={{ fontSize: '1.1rem', padding: '12px 32px' }}
                    onClick={() => {
                      const ans = prompt(`Monto a retirar (Máximo $${cobrosData.montoDisponibleParaRetirar}):`, cobrosData.montoDisponibleParaRetirar);
                      if (ans) {
                        const num = parseFloat(ans);
                        if (!isNaN(num)) handleSolicitarCobro(num);
                      }
                    }}
                    disabled={cobrosData.montoDisponibleParaRetirar < 5000}
                  >
                    Solicitar Cobro
                  </button>
                  {cobrosData.montoDisponibleParaRetirar < 5000 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--red-500)', marginTop: '8px' }}>El monto mínimo para retirar es de $5000.</p>
                  )}
                </div>

                <h3 style={{ color: 'var(--red-600)', marginBottom: 16 }}>Historial de Solicitudes</h3>
                <div className="card" style={{ padding: '16px', overflowX: 'auto' }}>
                  {cobrosData.historial.length === 0 ? (
                    <p className="rd-empty">No hay solicitudes anteriores.</p>
                  ) : (
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                          <th style={{ padding: '12px 8px' }}>Fecha</th>
                          <th style={{ padding: '12px 8px' }}>Monto</th>
                          <th style={{ padding: '12px 8px' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cobrosData.historial.map((h, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                            <td style={{ padding: '12px 8px' }}>{new Date(h.fechaSolicitud).toLocaleDateString()}</td>
                            <td style={{ padding: '12px 8px', fontWeight: '600' }}>${h.montoNeto}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <span className={`badge ${h.estado === 'Pendiente' ? 'badge-amber' : h.estado === 'Completado' ? 'badge-green' : 'badge-gray'}`}>
                                {h.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {/* ─── Profile ─── */}
        {view === 'profile' && (
          <section className="animate-fade-in">
            <div className="card card-body">
              <h2 style={{ color: 'var(--red-600)', marginBottom: 16 }}>Editar Perfil del Local</h2>
              {profileData && (
                <form onSubmit={handleSaveProfile} className="rd-item-form">
                  {profileData.foto_url && <img src={profileData.foto_url} alt="" style={{ width: 120, borderRadius: 12, margin: '0 auto 16px', display: 'block' }} />}
                  <input name="foto" type="file" className="form-input" accept="image/*" />
                  <div className="rd-form-row">
                    <input name="nombre" className="form-input" placeholder="Nombre del local" defaultValue={profileData.nombre || ''} required />
                    <input name="direccion" className="form-input" placeholder="Dirección" defaultValue={profileData.direccion || ''} required />
                  </div>
                  <input name="email" type="email" className="form-input" placeholder="Email" defaultValue={profileData.email || ''} required />
                  <input name="password" type="password" className="form-input" placeholder="Nueva contraseña (dejar vacío para no cambiar)" />
                  
                  <h3 style={{ marginTop: '24px', marginBottom: '12px', fontSize: '1.1rem', color: 'var(--gray-700)' }}>Horarios de Atención</h3>
                  <div className="rd-form-row rd-form-row-3">
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Apertura</label>
                      <input name="horario_apertura" type="time" className="form-input" defaultValue={profileData.horario_apertura || '09:00'} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Cierre</label>
                      <input name="horario_cierre" type="time" className="form-input" defaultValue={profileData.horario_cierre || '23:00'} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Modo Automático</label>
                      <select name="modo_automatico" className="form-select" defaultValue={profileData.modo_automatico ? 'true' : 'false'}>
                        <option value="true">Sí (Abrir/Cerrar auto)</option>
                        <option value="false">No (Manual)</option>
                      </select>
                    </div>
                  </div>

                  <div className="rd-form-actions" style={{ marginTop: '24px' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setView('orders')}>Cancelar</button>
                    <button type="submit" className="btn btn-success">Guardar Cambios</button>
                  </div>
                </form>
              )}
              
              <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid var(--gray-200)' }} />
              <div style={{ backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                <h3 style={{ color: '#0369a1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src="https://i.postimg.cc/k47vV4h3/mercadopago.png" alt="MP" style={{ height: 24 }} onError={(e) => e.target.style.display = 'none'} />
                  Cobros con Mercado Pago
                </h3>
                <p style={{ color: '#0c4a6e', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
                  Conectá tu cuenta de Mercado Pago para que tus clientes puedan abonar sus pedidos por transferencia o tarjeta directamente. El dinero irá a esta cuenta.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ backgroundColor: '#009ee3', borderColor: '#009ee3', padding: '10px 24px', fontWeight: 600 }}
                    onClick={() => {
                      const clientId = import.meta.env.VITE_MP_CLIENT_ID || prompt("Por favor, ingresa el CLIENT_ID de tu aplicación de Mercado Pago:");
                      if (!clientId) return;
                      // El state enviará el ID del local para relacionarlo en el backend
                      const redirectUri = `${import.meta.env.VITE_SUPABASE_URL || 'https://jskxfescamdjesdrcnkf.supabase.co'}/functions/v1/mp-oauth-callback`;
                      const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${restaurant.id}&redirect_uri=${encodeURIComponent(redirectUri)}`;
                      window.location.href = authUrl;
                    }}
                  >
                    Vincular Cuenta de MercadoPago
                  </button>
                  {profileData?.mp_access_token && (
                    <span className="badge badge-green" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>✓ Cuenta Vinculada</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="footer"><p>© 2026 <strong>Weep</strong> — Panel de Locales</p></footer>
    </div>
  );
}

/* ─── Order Card Component ─── */
function OrderCard({ order: o, onAction, finished }) {
  const [loading, setLoading] = useState('');
  const handleAction = async (action) => {
    setLoading(action);
    await onAction(o, action);
    setLoading('');
  };
  const subtotal = o.items.reduce((sum, i) => sum + (i[7] || 0), 0);
  const statusColors = { Pendiente: 'badge-amber', Aceptado: 'badge-info', Listo: 'badge-blue', Entregado: 'badge-green', Rechazado: 'badge-red' };
  return (
    <div className="rd-order-card card">
      <div className="rd-order-header">
        <div>
          <strong>Pedido #{o.idPedido}</strong>
          <span className="rd-order-sub">Local #{o.idPedidoLocal}</span>
          {o.fecha && <span className="rd-order-sub" style={{ marginLeft: 8 }}>📅 {new Date(o.fecha).toLocaleString('es-AR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>}
          <span className={`badge ${String(o.tipoEntrega).toLowerCase().includes('env') || o.tipoEntrega === 'Con Envío' ? 'badge-blue' : 'badge-gray'}`} style={{ marginLeft: 8 }}>
            {String(o.tipoEntrega).toLowerCase().includes('env') || o.tipoEntrega === 'Con Envío' ? '🚚 Envío' : '🏪 Retiro'}
          </span>
        </div>
        <span className={`badge ${statusColors[o.estadoActual] || 'badge-gray'}`}>{o.estadoActual}</span>
      </div>
      <div className="rd-order-body">
        <p><strong>Cliente:</strong> {o.nombreCliente}</p>
        <p><strong>Dirección:</strong> {o.direccion}</p>
        <p><strong>Pago:</strong> {o.metodoPago}</p>
        {o.observaciones !== 'Ninguna' && <p><strong>Obs:</strong> {o.observaciones}</p>}
        <div className="rd-order-items">
          {o.items.map((item, i) => (
            <div key={i} className="rd-order-item">
              <span>{item[4]} × {item[6]}</span>
              <span>${item[7]}</span>
            </div>
          ))}
        </div>
        <div className="rd-order-footer">
          <p><strong>Subtotal (Local):</strong> <span style={{ color: 'var(--red-600)', fontSize: '1.2rem' }}>${o.totalLocal.toFixed(2)}</span></p>
        </div>
        {!finished && (
          <div className="rd-order-actions">
            {o.estadoActual === 'Pendiente' ? (
              <>
                <button className="btn btn-success btn-sm" disabled={loading} onClick={() => handleAction('Aceptado')}>
                  {loading === 'Aceptado' ? <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> : '✓ Aceptar'}
                </button>
                <button className="btn btn-sm" style={{ background: 'var(--red-500)', color: '#fff' }} disabled={loading} onClick={() => handleAction('Rechazado')}>
                  {loading === 'Rechazado' ? <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> : '✕ Rechazar'}
                </button>
              </>
            ) : ['Aceptado', 'Listo'].includes(o.estadoActual) ? (
              <>
                <button 
                  className={`btn btn-sm ${o.estadoActual === 'Listo' ? '' : 'btn-success'}`} 
                  style={o.estadoActual === 'Listo' ? { background: 'var(--gray-300)', color: 'var(--gray-500)', cursor: 'not-allowed' } : {}}
                  disabled={loading || o.estadoActual === 'Listo'} 
                  onClick={() => handleAction('Listo')}
                >
                  {loading === 'Listo' ? <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> : '✓ Listo'}
                </button>
                <button 
                  className="btn btn-sm" 
                  style={o.estadoActual !== 'Listo' ? { background: 'var(--gray-300)', color: 'var(--gray-500)', cursor: 'not-allowed' } : { background: 'var(--blue-500)', color: '#fff' }} 
                  disabled={loading || o.estadoActual !== 'Listo'} 
                  onClick={() => handleAction('Entregado')}
                >
                  {loading === 'Entregado' ? <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> : '📦 Entregado'}
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
