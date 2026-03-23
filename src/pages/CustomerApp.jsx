import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import * as api from '../services/api';
import { iniciarPagoMercadoPago } from '../services/mercadopago';
import toast from 'react-hot-toast';
import './CustomerApp.css';

export default function CustomerApp() {
  const { user, loginAsUser, logoutUser: doLogout, updateUserAddress } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();

  const [locals, setLocals] = useState([]);
  const [menus, setMenus] = useState([]);
  const [menuTitle, setMenuTitle] = useState('');
  const [showMenus, setShowMenus] = useState(false);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [filteredLocals, setFilteredLocals] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loadingLocals, setLoadingLocals] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [drinks, setDrinks] = useState([]);
  const [hasRepartidores, setHasRepartidores] = useState(true);
  const [metodoPago, setMetodoPago] = useState('');
  const searchTimeout = useRef(null);

  // Load locals + drinks on mount
  useEffect(() => {
    api.getLocales().then(d => setLocals(d || [])).catch(() => {});
    api.getBebidas().then(d => setDrinks(d || [])).catch(() => {});
    if (user) api.getFavoritos(user.id).then(d => {
      if (Array.isArray(d)) setFavorites(d);
    }).catch(() => {});
  }, [user]);

  // MP Return URL Parse
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const status = query.get('status');
    const payment_id = query.get('payment_id');
    const preference_id = query.get('preference_id');

    if (status && payment_id) {
      const pendingRaw = localStorage.getItem('pendingOrderData');
      if (pendingRaw) {
        try {
          const pendingData = JSON.parse(pendingRaw);
          if (status === 'approved') {
            toast.success(`¡Pago confirmado! Tu pedido #${pendingData.pedidoId} está siendo procesado.`);
            cart.clearCart();
          } else if (status === 'pending') {
            toast.error('El pago está pendiente de aprobación');
          } else {
            toast.error('El pago no fue aprobado');
          }
        } catch(e) { console.error('Error parsing pending order data', e); }
        finally {
          localStorage.removeItem('pendingOrderData');
        }
      }
      
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [cart]);

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

  const fetchMenusByLocal = useCallback((localId, catId = null) => {
    setLoadingMenus(true);
    const local = (filteredLocals || locals).find(l => l.id === localId) || locals.find(l => l.id === localId);
    api.getMenuByLocalId(localId).then(d => {
      let mapped = (d || []).map(i => ({
        ...i, local_nombre: local?.nombre || 'Local', local_logo: local?.logo || '',
      }));
      if (catId) {
        mapped = mapped.filter(i => (i.categoria || '').toLowerCase() === catId.toLowerCase());
      }
      setMenus(mapped);
      setMenuTitle(catId ? `${catId} en ${local?.nombre || 'Local'}` : `Menú de ${local?.nombre || 'Local'}`);
      setShowMenus(true);
    }).catch(() => toast.error('No pudimos cargar el menú')).finally(() => setLoadingMenus(false));
  }, [locals, filteredLocals]);

  const fetchByCategory = useCallback((cat) => {
    if (cat === 'favoritos') {
      if (!user) { setModal('login'); return; }
      setLoadingMenus(true);
      api.getMenuCompleto().then(all => {
        const favMenus = all.filter(m => favorites.includes(m.id));
        setMenus(favMenus);
        setMenuTitle('Mis Favoritos');
        setShowMenus(true);
      }).catch(() => toast.error('Error al cargar favoritos')).finally(() => setLoadingMenus(false));
      return;
    }
    
    setLoadingLocals(true);
    api.getLocalesByCategoria(cat).then(d => {
      const mapped = (d || []).map(l => ({
        id: l.local_id,
        nombre: l.nombre_local,
        logo: l.logo_url,
        estado: l.estado,
        precio_min: l.precio_min_categoria || 0
      }));
      setFilteredLocals(mapped);
      setSelectedCategory(cat);
      setShowMenus(false);
      setTimeout(() => {
        document.querySelector('.locals-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }).catch(() => toast.error('Error al cargar locales')).finally(() => setLoadingLocals(false));
  }, [user, favorites]);

  const toggleFav = useCallback(async (menuId) => {
    if (!user) { setModal('login'); return; }
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

  const handleEditProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nombre = fd.get('nombre');
    const email = fd.get('email');
    const newPass = fd.get('newPassword');
    if (!nombre || !email) { toast.error('Nombre y email son obligatorios'); return; }
    if (newPass && newPass.length < 6) { toast.error('La nueva contraseña debe tener 6+ caracteres'); return; }
    setAuthLoading(true);
    try {
      await api.updateProfile(user.id, nombre, email, newPass || null);
      // Update local state
      loginAsUser({ userId: user.id, name: nombre, email, address: user.address });
      toast.success('Perfil actualizado');
      setModal('profile');
    } catch { toast.error('Error al actualizar perfil'); }
    setAuthLoading(false);
  };

  // Calculate comisión (Para la UI)
  const comision = metodoPago === 'transferencia' ? cart.subtotal * 0.04 : 0;
  const totalConComision = cart.total + comision;

  const handleAddToCart = (menu) => {
    cart.addItem(menu);
    toast((t) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        ¡{menu.nombre} agregado! ✓
        <button onClick={() => { openCart(); toast.dismiss(t.id); }} style={{ background: 'var(--red-500)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
          Ver carrito
        </button>
      </span>
    ), { duration: 3000, style: { padding: '12px 16px' } });
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!user) { setModal('login'); return; }
    if (cart.items.length === 0) { toast.error('Tu carrito está vacío'); return; }
    const fd = new FormData(e.target);
    const dir = fd.get('direccion');
    const mp = fd.get('metodo-pago');
    if (cart.deliveryType === 'envio' && !dir) { toast.error('Ingresá tu dirección de entrega'); return; }
    if (!mp) { toast.error('Seleccioná un método de pago'); return; }
    
    // Check repartidores active strictly before proceeding if envio is selected
    if (cart.deliveryType === 'envio' && !hasRepartidores) {
      toast.error('No hay repartidores disponibles. Debes retirar en local.');
      cart.setDeliveryType('retiro');
      return;
    }

    setCheckoutLoading(true);
    try {
      // 7. Calculate exact prices
      const calcSubtotal = cart.items.reduce((sum, i) => sum + (Number(i.precio) * i.qty), 0);
      const tieneBebida = cart.items.some(i => i.categoria?.toLowerCase() === 'bebidas');
      const shipping = (cart.deliveryType === 'envio' && !tieneBebida) ? 2500 : 0;
      const calcComision = (mp === 'transferencia') ? calcSubtotal * 0.04 : 0;
      const exactTotal = calcSubtotal + shipping + calcComision;

      const orderItems = cart.items.map(i => ({
        id: i.id, nombre: i.nombre, precio: Number(i.precio),
        cantidad: i.qty, local_id: i.local_id || '',
      }));

      // Rama Efectivo
      if (mp === 'efectivo') {
        const response = await api.crearPedido({
          userId: user.id,
          direccion: cart.deliveryType === 'envio' ? dir : 'Retiro en local',
          tipoEntrega: cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar',
          metodoPago: mp, observaciones: fd.get('observaciones') || '',
          items: orderItems,
          emailCliente: user.email, nombreCliente: user.name,
          estadoInicial: 'Pendiente',
          totalCalculado: exactTotal
        });

        toast.success(`¡Pedido #${response.pedidoId} registrado exitosamente!`);
        api.notifyLocalsAboutNewOrder(
          response.pedidoId, cart.items, 
          cart.deliveryType === 'envio' ? dir : 'Retiro en local', 
          cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar', 
          fd.get('observaciones') || '', mp
        ).catch(e => console.error(e));

        api.notifyCustomerAboutNewOrder(
          response.pedidoId, cart.items,
          cart.deliveryType === 'envio' ? dir : 'Retiro en local', 
          cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar', 
          response.numConfirmacion, user.email, user.name
        ).catch(e => console.error(e));

        cart.clearCart();
        setCartOpen(false);
        e.target.reset();
      } 
      // Rama Transferencia / MP
      else if (mp === 'transferencia') {
        const pregeneratedId = 'ORD-' + Math.random().toString(36).substring(2, 12).toUpperCase();
        
        const orderInfo = {
          direccion: cart.deliveryType === 'envio' ? dir : 'Retiro en local',
          tipoEntrega: cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar',
          metodoPago: mp, observaciones: fd.get('observaciones') || '',
          emailCliente: user.email, nombreCliente: user.name,
          totalCalculado: exactTotal
        };

        await api.crearPedidoTemporal({
          pedidoId: pregeneratedId,
          userId: user.id,
          cart: orderItems,
          orderInfo: orderInfo
        });

        const loadingToast = toast.loading('Redirigiendo a Mercado Pago...');
        try {
          const extRef = pregeneratedId; 
          const currentUrl = window.location.href; 
          
          const paymentData = {
            external_reference: extRef,
            back_urls: { success: currentUrl, failure: currentUrl, pending: currentUrl },
            auto_return: "approved",
            items: [{
              title: `Pedido Weep #${pregeneratedId}`,
              quantity: 1,
              currency_id: "ARS",
              unit_price: Number(exactTotal)
            }],
            local_id: cart.items[0]?.local_id
          };

          const paymentResponse = await iniciarPagoMercadoPago(paymentData);

          if (paymentResponse?.init_point) {
            toast.dismiss(loadingToast);
            const pendingData = {
              pedidoId: pregeneratedId,
              userId: user.id,
              fecha: new Date().toLocaleString('es-AR'),
              direccion: orderInfo.direccion,
              metodoPago: 'Transferencia / Mercado Pago',
              observaciones: orderInfo.observaciones,
              envioGratis: shipping === 0,
              tipoEntrega: orderInfo.tipoEntrega,
              cart: cart.items,
              total: exactTotal,
              preferenceId: paymentResponse.id,
              externalReference: extRef,
              emailCliente: user.email,
              nombreCliente: user.name
            };
            localStorage.setItem('pendingOrderData', JSON.stringify(pendingData));
            
            window.location.href = paymentResponse.init_point;
            return;
          } else {
            throw new Error(paymentResponse?.error || 'No se pudo generar el link de pago');
          }
        } catch (err) {
          toast.dismiss(loadingToast);
          
          let errorMsg = err.message;
          if (errorMsg.includes('non-2xx status code')) {
             errorMsg = 'El local no tiene configurado Mercado Pago o hubo un problema de conexión.';
          }
          
          toast.error('No pudimos iniciar el pago: ' + errorMsg);
        }
      }
    } catch (err) { 
      toast.error('Error al realizar el pedido: ' + err.message); 
      console.error("DETALLE ERROR CHECKOUT:", err);
    }
    setCheckoutLoading(false);
  };

  // Check repartidores when cart opens
  const openCart = async () => {
    setCartOpen(true);
    try {
      const r = await api.checkActiveRepartidores();
      setHasRepartidores(r.hasActive);
      if (!r.hasActive && cart.deliveryType === 'envio') {
        cart.setDeliveryType('retiro');
      }
    } catch { /* fallback: allow */ }
  };

  const categories = [
    { type: 'Hamburguesas', label: 'Burguers', img: 'https://i.postimg.cc/VLtZ23Km/descarga-(1)-(8).jpg' },
    { type: 'Pizzas', label: 'Pizzas', img: 'https://i.postimg.cc/cJkcvmFw/descarga-(1)-(10).jpg' },
    { type: 'Empanadas', label: 'Empanadas', img: 'https://i.postimg.cc/KYjPhTmk/descarga-(1)-(11).jpg' },
    { type: 'Panadería', label: 'Panadería', img: 'https://i.postimg.cc/HnYWFwgm/descarga-(1)-(13).jpg' },
    { type: 'Bebidas', label: 'Bebidas', img: 'https://i.postimg.cc/KvhCcGkT/descarga-(1)-(14).jpg' },
    { type: 'favoritos', label: 'Mis favoritos', img: 'https://i.postimg.cc/RCktgLyZ/buscamos-repartidores-(7).png' },
  ];

  // Show drinks carousel when no drink in cart and delivery is envio
  const showDrinks = cart.items.length > 0 && cart.deliveryType === 'envio' && !cart.hasDrink && drinks.length > 0;

  return (
    <div className="customer-app">
      {/* ─── Header ─── */}
      <header className="app-header">
        <Link to="/" className="app-logo-link">
          <img src="https://i.postimg.cc/5tKhqD4z/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(5).png" alt="Weep" className="app-logo" />
        </Link>
        <div className="search-wrapper">
          <img src="https://i.postimg.cc/TPXmybcH/18611-(1)-(2).png" alt="Buscar" className="search-icon" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          <input type="text" placeholder="Buscar menús o locales..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        </div>
        <div className="header-actions">
          <button className="profile-btn" onClick={() => user ? setModal('profile') : setModal('login')}>
            <img src="https://i.postimg.cc/1RWxRcKM/18611-(1)-(1).png" alt="Perfil" className="profile-avatar-img" />
            <span className="hide-mobile">{user ? 'Mi Perfil' : 'Ingresar'}</span>
          </button>
          <button className="cart-btn" onClick={openCart}>
            <img src="https://i.postimg.cc/QCcjwFRf/18611-(1).png" alt="Carrito" className="cart-icon-img" />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>{filteredLocals ? `Locales con ${selectedCategory}` : 'Sugerencias de Locales'}</h2>
            {filteredLocals && (
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => { setFilteredLocals(null); setSelectedCategory(null); }}
                style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}
              >
                ✕ Ver todos
              </button>
            )}
          </div>
          <div className="locals-scroll">
            {loadingLocals && <p className="empty-text">Buscando locales...</p>}
            {!loadingLocals && !filteredLocals && locals.length === 0 && <p className="empty-text">Cargando locales...</p>}
            {!loadingLocals && filteredLocals && filteredLocals.length === 0 && <p className="empty-text">No hay locales para esta categoría.</p>}
            {!loadingLocals && (filteredLocals || locals).map(local => {
              const open = local.estado?.toLowerCase() === 'activo';
              
              if (filteredLocals) {
                return (
                  <button
                    key={local.id}
                    className={`suggestion-categoria ${open ? 'open' : 'closed'}`}
                    onClick={() => open ? fetchMenusByLocal(local.id, selectedCategory) : toast('Este local está cerrado', { icon: '🔒' })}
                    style={{ flex: '0 0 auto', border: 'none' }}
                  >
                    <img
                      src={local.logo || `https://placehold.co/120x120?text=${encodeURIComponent(local.nombre)}`}
                      alt={local.nombre}
                      onError={(e) => { e.target.src = 'https://placehold.co/120x120?text=Local'; }}
                    />
                    <div className="suggestion-info">
                      <div className="local-name">{local.nombre}</div>
                      <div className="categoria-precio">
                        <span className="cat">{selectedCategory}</span>
                        <span className="precio-min">desde ${Number(local.precio_min || 0).toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                    {open && <span className="open-dot" style={{ position: 'absolute', top: 5, right: 5, width: 12, height: 12, borderWidth: 2 }} />}
                  </button>
                );
              }

              return (
                <button
                  key={local.id}
                  className={`local-circle ${open ? 'open' : 'closed'}`}
                  onClick={() => open ? fetchMenusByLocal(local.id, selectedCategory) : toast('Este local está cerrado', { icon: '🔒' })}
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
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedCategory && menus.length > 0 && menus[0].local_id && (
                  <button className="btn btn-secondary btn-sm" onClick={() => fetchMenusByLocal(menus[0].local_id)}>
                    Ver menú completo
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setShowMenus(false)}>✕ Cerrar</button>
              </div>
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
                          <button className="btn btn-primary btn-sm" onClick={() => handleAddToCart(menu)}>Agregar</button>
                          <button className={`fav-btn ${favorites.includes(menu.id) ? 'active' : ''}`} onClick={() => toggleFav(menu.id)}>
                            <img 
                              src={favorites.includes(menu.id) 
                                ? "https://i.postimg.cc/BZYZmSz1/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find.png" 
                                : "https://i.postimg.cc/W4Gb8MRV/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find-(1).png"}
                              alt="Favorito" 
                              style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                            />
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
            <select className="form-select" value={cart.deliveryType} onChange={e => {
              if (e.target.value === 'envio' && !hasRepartidores) {
                toast.error('No hay repartidores disponibles en este momento');
                return;
              }
              cart.setDeliveryType(e.target.value);
            }}>
              <option value="envio" disabled={!hasRepartidores}>
                {hasRepartidores ? 'Con envío a domicilio' : 'Con envío (no disponible)'}
              </option>
              <option value="retiro">Retirar en local</option>
            </select>
          </div>

          {cart.items.length === 0 ? (
            <div className="cart-empty">
              <img src="https://i.postimg.cc/QCcjwFRf/18611-(1).png" alt="Carrito Vacío" style={{ width: '64px', height: '64px', margin: '0 auto 16px', opacity: 0.8 }} />
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
                {comision > 0 && (
                  <div className="cart-line comision-line">
                    <span>Comisión 4% (Mercado Pago)</span>
                    <span>+${comision.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                )}
                {cart.hasDrink && cart.deliveryType === 'envio' && (
                  <div className="free-shipping-badge">🎉 ¡Envío gratis por agregar bebida!</div>
                )}
                {!cart.hasDrink && cart.deliveryType === 'envio' && (
                  <div className="shipping-tip">💡 Agregá una bebida y el envío es gratis</div>
                )}
                <div className="cart-line total-line">
                  <span>Total</span>
                  <span>${totalConComision.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {/* ─── Drinks Carousel ─── */}
              {showDrinks && (
                <div className="drinks-section">
                  <h3 className="drinks-title">🥤 ¡Agregá una bebida y obtené ENVÍO GRATIS!</h3>
                  <div className="drinks-scroll">
                    {drinks.map(d => (
                      <div key={d.id} className="drink-card">
                        <img
                          src={d.imagen_url || 'https://placehold.co/100x80?text=Bebida'}
                          alt={d.nombre}
                          onError={e => { e.target.src = 'https://placehold.co/100x80?text=Bebida'; }}
                        />
                        <div className="drink-info">
                          <span className="drink-name">{d.nombre}</span>
                          <span className="drink-price">${Number(d.precio).toLocaleString('es-AR')}</span>
                        </div>
                        <button className="btn btn-primary btn-xs" onClick={() => handleAddToCart(d)}>+</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleCheckout} className="checkout-form">
                {cart.deliveryType === 'envio' && (
                  <input name="direccion" className="form-input" placeholder="Dirección de entrega" defaultValue={user?.address || ''} required />
                )}
                <select name="metodo-pago" className="form-select" required defaultValue="" onChange={e => setMetodoPago(e.target.value)}>
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
                  <button className="btn btn-primary btn-full" onClick={() => setModal('editProfile')}>✏️ Editar perfil</button>
                  <button className="btn btn-secondary btn-full" onClick={() => setModal('editAddress')}>📍 Cambiar dirección</button>
                  <button className="btn btn-secondary btn-full" onClick={() => navigate('/mis-pedidos')}>📦 Mis Pedidos</button>
                  <button className="btn btn-ghost btn-full" onClick={() => { doLogout(); setModal(null); toast.success('Sesión cerrada'); }}>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}

            {modal === 'editProfile' && user && (
              <form onSubmit={handleEditProfile}>
                <h2>Editar Perfil</h2>
                <label className="form-label">Nombre completo</label>
                <input name="nombre" className="form-input" defaultValue={user.name} required />
                <label className="form-label">Email</label>
                <input name="email" type="email" className="form-input" defaultValue={user.email} required />
                <label className="form-label">Nueva contraseña (opcional)</label>
                <input name="newPassword" type="password" className="form-input" placeholder="Dejar en blanco si no deseas cambiarla" />
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Guardar cambios'}
                </button>
              </form>
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

            {modal === 'terms' && (
              <div>
                <h2>Términos y Condiciones</h2>
                <div style={{ fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.6 }}>
                  <p><strong>Última actualización: febrero 2026</strong></p>
                  <p>Al usar Weep aceptás:</p>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li>Utilizar la plataforma de buena fe y respetando las leyes vigentes.</li>
                    <li>No publicar contenido falso, engañoso o ilegal.</li>
                    <li>Que los pedidos generados son acuerdos entre el cliente y el local adherido.</li>
                    <li>Weep actúa solo como intermediario tecnológico y no se responsabiliza por la calidad de los productos, tiempos de entrega ni disputas entre usuarios y comercios.</li>
                    <li>Nos reservamos el derecho de suspender o eliminar cuentas que incumplan estos términos.</li>
                  </ul>
                  <p style={{ marginTop: 16 }}>Cualquier duda escribinos a <a href="mailto:bajoneando.st@gmail.com" style={{ color: 'var(--red-500)' }}>bajoneando.st@gmail.com</a></p>
                </div>
                <button className="btn btn-secondary btn-full" onClick={() => setModal(null)} style={{ marginTop: 16 }}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="footer">
        <p>© 2026 <strong>Weep</strong> — Plataforma de Pedidos y Delivery</p>
        <p>
          <Link to="/locales">Registrá tu local</Link> •{' '}
          <button className="footer-link" onClick={() => setModal('terms')}>Términos</button> •{' '}
          <a href="mailto:bajoneando.st@gmail.com">Soporte</a>
        </p>
      </footer>
    </div>
  );
}
