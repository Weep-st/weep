import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './CustomerApp.css';

export default function CustomerApp() {
  const { user, loginAsUser, logoutUser: doLogout, updateUserAddress } = useAuth();
  const cart = useCart();

  const [locals, setLocals] = useState([]);
  const [menus, setMenus] = useState([]);
  const [menuTitle, setMenuTitle] = useState('');
  const [showMenus, setShowMenus] = useState(false);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const searchTimeout = useRef(null);

  // Load locals on mount
  useEffect(() => {
    api.getLocales().then(d => setLocals(d || [])).catch(() => {});
    if (user) api.getFavoritos(user.id).then(d => {
      if (Array.isArray(d)) setFavorites(d);
    }).catch(() => {});
  }, [user]);

  // Search
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (search.length >= 3) {
      searchTimeout.current = setTimeout(() => {
        setLoadingMenus(true);
        api.buscarMenu(search).then(d => {
          setMenus(d || []);
          setMenuTitle(`Resultados para "${search}"`);
          setShowMenus(true);
        }).catch(() => toast.error('Error en búsqueda')).finally(() => setLoadingMenus(false));
      }, 500);
    } else if (search === '') {
      setShowMenus(false);
    }
  }, [search]);

  const fetchMenusByLocal = useCallback((localId) => {
    setLoadingMenus(true);
    const local = locals.find(l => l.id === localId);
    api.getMenuByLocalId(localId).then(d => {
      // Map to expected format
      const mapped = (d || []).map(i => ({
        ...i, local_nombre: local?.nombre || 'Local', local_logo: local?.logo || '',
      }));
      setMenus(mapped);
      setMenuTitle(`Menú de ${local?.nombre || 'Local'}`);
      setShowMenus(true);
    }).catch(() => toast.error('No pudimos cargar el menú')).finally(() => setLoadingMenus(false));
  }, [locals]);

  const fetchByCategory = useCallback((cat) => {
    setLoadingMenus(true);
    api.getMenuByCategoria(cat).then(d => {
      setMenus(d || []);
      setMenuTitle(cat);
      setShowMenus(true);
    }).catch(() => toast.error('Error al cargar')).finally(() => setLoadingMenus(false));
  }, []);

  const toggleFav = useCallback(async (menuId) => {
    if (!user) { setModal('login'); return; }
    const isFav = favorites.includes(menuId);
    try {
      const r = await api.toggleFavorito(user.id, menuId);
      if (r.added) {
        setFavorites(prev => [...prev, menuId]);
        toast.success('♥ Agregado a favoritos');
      } else {
        setFavorites(prev => prev.filter(id => id !== menuId));
        toast.success('Quitado de favoritos');
      }
    } catch { toast.error('Error'); }
  }, [user, favorites]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setAuthLoading(true);
    try {
      const d = await api.loginUsuario(fd.get('email').toLowerCase(), fd.get('password'));
      if (d.success) {
        loginAsUser({ userId: d.userId, name: d.nombre, email: d.email || fd.get('email'), address: d.direccion });
        setModal(null);
        toast.success('¡Bienvenido!');
      } else toast.error('Credenciales incorrectas');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (fd.get('password').length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    setAuthLoading(true);
    try {
      const d = await api.registerUsuario(fd.get('nombre'), fd.get('email').toLowerCase(), fd.get('password'), fd.get('direccion'));
      if (d.success) {
        loginAsUser({ userId: d.userId, name: fd.get('nombre'), email: fd.get('email'), address: fd.get('direccion') });
        setModal(null);
        toast.success('¡Registro exitoso!');
      } else toast.error('Error al registrar');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!user) { setModal('login'); return; }
    if (cart.items.length === 0) { toast.error('Tu carrito está vacío'); return; }
    const fd = new FormData(e.target);
    const dir = fd.get('direccion');
    const metodoPago = fd.get('metodo-pago');
    if (cart.deliveryType === 'envio' && !dir) { toast.error('Ingresá tu dirección'); return; }
    if (!metodoPago) { toast.error('Seleccioná un método de pago'); return; }
    setCheckoutLoading(true);
    try {
      const orderItems = cart.items.map(i => ({
        id: i.id, nombre: i.nombre, precio: Number(i.precio),
        cantidad: i.qty, local_id: i.local_id || '',
      }));
      await api.crearPedido({
        userId: user.id,
        direccion: cart.deliveryType === 'envio' ? dir : 'Retiro en local',
        tipoEntrega: cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar',
        metodoPago, observaciones: fd.get('observaciones') || '',
        items: orderItems,
        emailCliente: user.email, nombreCliente: user.name,
      });
      toast.success('¡Pedido realizado con éxito! 🎉');
      cart.clearCart();
      setCartOpen(false);
    } catch { toast.error('Error al realizar el pedido'); }
    setCheckoutLoading(false);
  };

  const categories = [
    { type: 'Hamburguesas', label: 'Burguers', img: 'https://i.postimg.cc/VLtZ23Km/descarga-(1)-(8).jpg' },
    { type: 'Pizzas', label: 'Pizzas', img: 'https://i.postimg.cc/cJkcvmFw/descarga-(1)-(10).jpg' },
    { type: 'Empanadas', label: 'Empanadas', img: 'https://i.postimg.cc/KYjPhTmk/descarga-(1)-(11).jpg' },
    { type: 'Panadería', label: 'Panadería', img: 'https://i.postimg.cc/HnYWFwgm/descarga-(1)-(13).jpg' },
    { type: 'Bebidas', label: 'Bebidas', img: 'https://i.postimg.cc/KvhCcGkT/descarga-(1)-(14).jpg' },
  ];

  return (
    <div className="customer-app">
      {/* ─── Header ─── */}
      <header className="app-header">
        <Link to="/" className="app-logo-link">
          <img src="https://i.postimg.cc/5tKhqD4z/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(5).png" alt="Weep" className="app-logo" />
        </Link>
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Buscar menús o locales..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        </div>
        <div className="header-actions">
          <button className="profile-btn" onClick={() => user ? setModal('profile') : setModal('login')}>
            <span className="profile-avatar">👤</span>
            <span className="hide-mobile">{user ? 'Mi Perfil' : 'Ingresar'}</span>
          </button>
          <button className="cart-btn" onClick={() => setCartOpen(true)}>
            <span>🛒</span>
            {cart.totalItems > 0 && <span className="cart-badge">{cart.totalItems}</span>}
          </button>
        </div>
      </header>

      <main className="app-main">
        <h1 className="app-greeting animate-fade-in">¿Qué se te antoja?</h1>

        {/* ─── Categories ─── */}
        <div className="categories-scroll animate-slide-up">
          {categories.map(cat => (
            <button key={cat.type} className="category-card" onClick={() => fetchByCategory(cat.type)}>
              <img src={cat.img} alt={cat.label} />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* ─── Locals Carousel ─── */}
        <section className="locals-section animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2>Sugerencias de Locales</h2>
          <div className="locals-scroll">
            {locals.length === 0 && <p className="empty-text">Cargando locales...</p>}
            {locals.map(local => {
              const open = local.estado?.toLowerCase() === 'activo';
              return (
                <button
                  key={local.id}
                  className={`local-circle ${open ? 'open' : 'closed'}`}
                  onClick={() => open ? fetchMenusByLocal(local.id) : toast('Este local está cerrado', { icon: '🔒' })}
                >
                  <img
                    src={local.logo || `https://placehold.co/200x200?text=${encodeURIComponent(local.nombre)}`}
                    alt={local.nombre}
                    onError={(e) => { e.target.src = 'https://placehold.co/200x200?text=Local'; }}
                  />
                  {open && <span className="open-dot" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── Menu Display ─── */}
        {showMenus && (
          <section className="menu-section animate-fade-in">
            <div className="menu-header">
              <h2>{menuTitle}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMenus(false)}>✕ Cerrar</button>
            </div>
            {loadingMenus ? (
              <div className="loading-state"><div className="spinner" /> Cargando...</div>
            ) : menus.length === 0 ? (
              <p className="empty-text" style={{ padding: '40px' }}>No se encontraron platos.</p>
            ) : (
              <div className="menu-list">
                {menus.map((menu, i) => (
                  <div key={menu.id || i} className="menu-card card card-hover" style={{ animationDelay: `${i * 0.05}s` }}>
                    <img
                      src={menu.imagen_url || 'https://placehold.co/120x120?text=Sin+Imagen'}
                      alt={menu.nombre}
                      className="menu-card-img"
                      onError={(e) => { e.target.src = 'https://placehold.co/120x120?text=Sin+Imagen'; }}
                    />
                    <div className="menu-card-body">
                      <div className="menu-card-local">
                        {menu.local_logo && <img src={menu.local_logo} alt="" className="menu-local-logo" />}
                        <span>{menu.local_nombre || 'Local'}</span>
                      </div>
                      <h3>{menu.nombre}</h3>
                      <p>{menu.descripcion || ''}</p>
                      <div className="menu-card-footer">
                        <span className="menu-card-price">${Number(menu.precio).toLocaleString('es-AR')}</span>
                        <div className="menu-card-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => cart.addItem(menu)}>Agregar</button>
                          <button className={`fav-btn ${favorites.includes(menu.id) ? 'active' : ''}`} onClick={() => toggleFav(menu.id)}>
                            {favorites.includes(menu.id) ? '❤️' : '🤍'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ─── Cart Sidebar ─── */}
      <div className={`cart-backdrop ${cartOpen ? 'active' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`cart-sidebar ${cartOpen ? 'active' : ''}`}>
        <div className="cart-header-bar">
          <h2>Tu Carrito</h2>
          <button className="cart-close-btn" onClick={() => setCartOpen(false)}>✕</button>
        </div>
        <div className="cart-body-content">
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Tipo de entrega</label>
            <select className="form-select" value={cart.deliveryType} onChange={e => cart.setDeliveryType(e.target.value)}>
              <option value="envio">Con envío a domicilio</option>
              <option value="retiro">Retirar en local</option>
            </select>
          </div>

          {cart.items.length === 0 ? (
            <div className="cart-empty">
              <span style={{ fontSize: '3rem' }}>🛒</span>
              <p>Tu carrito está vacío</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setCartOpen(false)}>Seguir comprando</button>
            </div>
          ) : (
            <>
              {cart.items.map(item => (
                <div key={item.id} className="cart-item-row">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.nombre}</span>
                    <span className="cart-item-price">${(Number(item.precio) * item.qty).toLocaleString('es-AR')}</span>
                  </div>
                  <div className="cart-item-controls">
                    <button className="qty-btn" onClick={() => cart.updateQty(item.id, -1)}>−</button>
                    <span className="qty-display">{item.qty}</span>
                    <button className="qty-btn" onClick={() => cart.updateQty(item.id, 1)}>+</button>
                    <button className="remove-btn-small" onClick={() => cart.removeItem(item.id)}>🗑</button>
                  </div>
                </div>
              ))}

              <div className="cart-summary">
                <div className="cart-line"><span>Subtotal</span><span>${cart.subtotal.toLocaleString('es-AR')}</span></div>
                <div className="cart-line">
                  <span>Envío</span>
                  <span>{cart.shippingCost === 0 ? '¡GRATIS!' : `$${cart.shippingCost.toLocaleString('es-AR')}`}</span>
                </div>
                {cart.hasDrink && cart.deliveryType === 'envio' && (
                  <div className="free-shipping-badge">🎉 ¡Envío gratis por agregar bebida!</div>
                )}
                {!cart.hasDrink && cart.deliveryType === 'envio' && (
                  <div className="shipping-tip">💡 Agregá una bebida y el envío es gratis</div>
                )}
                <div className="cart-line total-line">
                  <span>Total</span>
                  <span>${cart.total.toLocaleString('es-AR')}</span>
                </div>
              </div>

              <form onSubmit={handleCheckout} className="checkout-form">
                {cart.deliveryType === 'envio' && (
                  <input name="direccion" className="form-input" placeholder="Dirección de entrega" defaultValue={user?.address || ''} required />
                )}
                <select name="metodo-pago" className="form-select" required defaultValue="">
                  <option value="" disabled>Método de pago</option>
                  <option value="transferencia">Transferencia / Mercado Pago</option>
                  <option value="efectivo">Efectivo</option>
                </select>
                <textarea name="observaciones" className="form-textarea" placeholder="Observaciones (opcional)" rows={2} />
                <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={checkoutLoading}>
                  {checkoutLoading ? <span className="spinner spinner-white" /> : 'Realizar Pedido'}
                </button>
              </form>
            </>
          )}
        </div>
      </aside>

      {/* ─── Modals ─── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}>✕</button>

            {modal === 'login' && (
              <form onSubmit={handleLogin}>
                <h2>Iniciar Sesión</h2>
                <input name="email" type="email" className="form-input" placeholder="Email" required />
                <input name="password" type="password" className="form-input" placeholder="Contraseña" required />
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Entrar'}
                </button>
                <p className="modal-switch">¿No tenés cuenta? <button type="button" onClick={() => setModal('register')}>Registrate</button></p>
              </form>
            )}

            {modal === 'register' && (
              <form onSubmit={handleRegister}>
                <h2>Registro</h2>
                <input name="nombre" className="form-input" placeholder="Nombre completo" required />
                <input name="email" type="email" className="form-input" placeholder="Email" required />
                <input name="password" type="password" className="form-input" placeholder="Contraseña (6+ caracteres)" required />
                <input name="direccion" className="form-input" placeholder="Dirección (opcional)" />
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Registrarme'}
                </button>
                <p className="modal-switch">¿Ya tenés cuenta? <button type="button" onClick={() => setModal('login')}>Iniciar sesión</button></p>
              </form>
            )}

            {modal === 'profile' && user && (
              <div>
                <h2>Mi Perfil</h2>
                <div className="profile-info">
                  <p><strong>Nombre:</strong> {user.name}</p>
                  <p><strong>Email:</strong> {user.email}</p>
                  <p><strong>Dirección:</strong> {user.address || 'No configurada'}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-secondary btn-full" onClick={() => setModal('editAddress')}>Cambiar dirección</button>
                  <button className="btn btn-ghost btn-full" onClick={() => { doLogout(); setModal(null); toast.success('Sesión cerrada'); }}>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}

            {modal === 'editAddress' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                const addr = new FormData(e.target).get('address');
                updateUserAddress(addr);
                api.updateDireccion(user.id, addr).catch(() => {});
                toast.success('Dirección actualizada');
                setModal('profile');
              }}>
                <h2>Cambiar Dirección</h2>
                <input name="address" className="form-input" placeholder="Nueva dirección" defaultValue={user?.address || ''} required />
                <button type="submit" className="btn btn-primary btn-full">Guardar</button>
              </form>
            )}
          </div>
        </div>
      )}

      <footer className="footer">
        <p>© 2026 <strong>Weep</strong> — Plataforma de Pedidos y Delivery</p>
        <p>
          <Link to="/locales">Registrá tu local</Link> •{' '}
          <a href="mailto:bajoneando.st@gmail.com">Soporte</a>
        </p>
      </footer>
    </div>
  );
}
