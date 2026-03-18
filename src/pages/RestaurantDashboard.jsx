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
  const [orderFilter, setOrderFilter] = useState('todos');
  const [orderTab, setOrderTab] = useState('proceso');
  const [pendingCount, setPendingCount] = useState(0);
  const pollingRef = useRef(null);

  // Load data on login
  useEffect(() => {
    if (!restaurant) return;
    loadEstado();
    loadProfile();
    loadOrders();
    return () => clearInterval(pollingRef.current);
  }, [restaurant]);

  // Polling
  useEffect(() => {
    if (!restaurant) return;
    pollingRef.current = setInterval(() => {
      loadOrders(true);
    }, 25000);
    return () => clearInterval(pollingRef.current);
  }, [restaurant]);

  const loadEstado = async () => {
    try {
      const d = await api.getLocalEstado(restaurant.id);
      if (d && 'estado' in d) setLocalOpen(String(d.estado).toLowerCase() === 'activo');
    } catch {}
  };

  const loadProfile = async () => {
    try {
      const d = await api.getPerfilLocal(restaurant.id);
      if (d.success) setProfileData(d);
    } catch {}
  };

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
          api.getItemsByPedidoLocal(p[0]),
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
        });
      }
      setOrders(processed);
      setPendingCount(processed.filter(o => o.estadoActual === 'Pendiente').length);
    } catch { if (!silent) toast.error('Error al cargar pedidos'); }
    if (!silent) setOrdersLoading(false);
  }, [restaurant]);

  const toggleEstado = async () => {
    const newState = localOpen ? 'Inactivo' : 'Activo';
    setLocalOpen(!localOpen);
    try {
      const d = await api.updateLocalEstado(restaurant.id, newState);
      if (!d.success) { setLocalOpen(localOpen); toast.error('No se pudo cambiar'); }
    } catch { setLocalOpen(localOpen); toast.error('Error de conexión'); }
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
      };
      const pass = fd.get('password');
      if (pass) params.password = pass;
      if (fotoUrl) params.foto_url = fotoUrl;
      await api.updatePerfilLocal(params);
      toast.success('Perfil actualizado');
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

  const processOrders = orders.filter(o => o.estadoActual === 'Pendiente' || o.estadoActual === 'Listo');
  const finishedOrders = orders.filter(o => o.estadoActual === 'Entregado' || o.estadoActual === 'Rechazado');
  const filteredProcessOrders = orderFilter === 'pendientes' ? processOrders.filter(o => o.estadoActual === 'Pendiente') :
    orderFilter === 'listos' ? processOrders.filter(o => o.estadoActual === 'Listo') : processOrders;

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
        <nav className="rd-nav animate-slide-up">
          <button className={`rd-nav-btn ${view === 'orders' ? 'active' : ''}`} onClick={() => { setView('orders'); loadOrders(); }}>
            📋 Mis Pedidos
            {pendingCount > 0 && <span className="rd-nav-badge">{pendingCount}</span>}
          </button>
          <button className={`rd-nav-btn ${view === 'menu' ? 'active' : ''}`} onClick={() => { setView('menu'); loadMenu(); }}>📖 Mi Menú</button>
          <button className={`rd-nav-btn ${view === 'addItem' ? 'active' : ''}`} onClick={() => { setEditItem(null); setView('addItem'); }}>➕ Agregar Plato</button>
        </nav>

        {/* ─── Orders View ─── */}
        {view === 'orders' && (
          <section className="animate-fade-in">
            <div className="rd-tabs">
              <button className={orderTab === 'proceso' ? 'active' : ''} onClick={() => setOrderTab('proceso')}>En Proceso</button>
              <button className={orderTab === 'finalizados' ? 'active' : ''} onClick={() => setOrderTab('finalizados')}>Finalizados</button>
            </div>
            {orderTab === 'proceso' && (
              <>
                <div className="rd-filters">
                  {['todos', 'pendientes', 'listos'].map(f => (
                    <button key={f} className={`btn btn-sm ${orderFilter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOrderFilter(f)}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                {ordersLoading ? (
                  <div className="loading-state"><div className="spinner" /> Cargando...</div>
                ) : filteredProcessOrders.length === 0 ? (
                  <p className="rd-empty">No hay pedidos en este filtro</p>
                ) : filteredProcessOrders.map(o => (
                  <OrderCard key={o.idPedidoLocal} order={o} onAction={handleOrderAction} />
                ))}
              </>
            )}
            {orderTab === 'finalizados' && (
              finishedOrders.length === 0 ? (
                <p className="rd-empty">No hay pedidos finalizados</p>
              ) : finishedOrders.map(o => (
                <OrderCard key={o.idPedidoLocal} order={o} finished />
              ))
            )}
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
                  <div className="rd-form-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setView('orders')}>Cancelar</button>
                    <button type="submit" className="btn btn-success">Guardar Cambios</button>
                  </div>
                </form>
              )}
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
  const statusColors = { Pendiente: 'badge-amber', Listo: 'badge-blue', Entregado: 'badge-green', Rechazado: 'badge-red' };
  return (
    <div className="rd-order-card card">
      <div className="rd-order-header">
        <div>
          <strong>Pedido #{o.idPedido}</strong>
          <span className="rd-order-sub">Local #{o.idPedidoLocal}</span>
          <span className={`badge ${o.tipoEntrega === 'Con Envío' ? 'badge-blue' : 'badge-gray'}`} style={{ marginLeft: 8 }}>
            {o.tipoEntrega === 'Con Envío' ? '🚚 Envío' : '🏪 Retiro'}
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
        <div className="rd-order-total">Subtotal: ${subtotal.toFixed(0)}</div>
        {!finished && (
          <div className="rd-order-actions">
            <button className="btn btn-success btn-sm" disabled={loading || ['Listo','Entregado','Rechazado'].includes(o.estadoActual)} onClick={() => handleAction('Listo')}>
              {loading === 'Listo' ? <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> : '✓ Listo'}
            </button>
            <button className="btn btn-sm" style={{ background: 'var(--blue-500)', color: '#fff' }} disabled={loading || ['Entregado','Rechazado'].includes(o.estadoActual)} onClick={() => handleAction('Entregado')}>
              {loading === 'Entregado' ? <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> : '📦 Entregado'}
            </button>
            <button className="btn btn-sm" style={{ background: 'var(--red-500)', color: '#fff' }} disabled={loading || o.estadoActual === 'Rechazado'} onClick={() => handleAction('Rechazado')}>
              {loading === 'Rechazado' ? <span className="spinner spinner-white" style={{ width: 16, height: 16 }} /> : '✕ Rechazar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
