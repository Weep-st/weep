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
  const [iceCreamModal, setIceCreamModal] = useState(null);
  const [iceCreamFlavors, setIceCreamFlavors] = useState([]);
  const [iceCreamSauces, setIceCreamSauces] = useState([]);
  const [iceCreamExtras, setIceCreamExtras] = useState([]);
  const [selectedSize, setSelectedSize] = useState('1/4kg');
  const [selectedFlavors, setSelectedFlavors] = useState([]);
  const [selectedSauces, setSelectedSauces] = useState([]);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [burgerModal, setBurgerModal] = useState(null);
  const [withFries, setWithFries] = useState(false);
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
      const d = await api.registerUsuario(
        fd.get('nombre'), fd.get('email').toLowerCase(), fd.get('password'), fd.get('direccion'),
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted')
      );
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

  const handleAddToCart = async (menu) => {
    // Detect if it's ice cream
    let isIceCream = false;
    let iceConfig = null;
    try {
      if (menu.variantes && menu.variantes.includes('es_helado')) {
        iceConfig = JSON.parse(menu.variantes);
        isIceCream = iceConfig.es_helado;
      }
    } catch (e) {}

    if (isIceCream) {
      setSelectedSize('1/4kg');
      setSelectedFlavors([]);
      setSelectedSauces([]);
      setSelectedExtras([]);
      try {
        const [flavors, extras] = await Promise.all([
          api.getSaboresByLocal(menu.local_id),
          api.getAdicionalesByLocal(menu.local_id)
        ]);
        setIceCreamFlavors(flavors.filter(f => f.disponible && f.tipo === 'Sabor'));
        setIceCreamSauces(flavors.filter(f => f.disponible && f.tipo === 'Salsa'));
        setIceCreamExtras(extras.filter(e => e.disponible));
        setIceCreamModal(menu);
        return; // Stop flow, modal will handle addition
      } catch {
        toast.error('Error al cargar opciones de helado');
      }
    }

    // Detect if it's a Burger with Fries option
    let burgerConfig = null;
    try {
      if ((menu.categoria || '').toLowerCase() === 'hamburguesas' && menu.variantes && menu.variantes.includes('con_papas')) {
        burgerConfig = JSON.parse(menu.variantes);
      }
    } catch(e){}

    if (burgerConfig && burgerConfig.con_papas) {
      setBurgerModal(menu);
      setWithFries(false);
      return; // Stop flow, burger modal handles it
    }

    // Default addition for other items
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
        id: i.menuId || i.id, // Use original menu item ID for database
        nombre: i.nombre, precio: Number(i.precio),
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

        // El correo de confirmación al cliente ahora se envía cuando el local acepta el pedido (en RestaurantDashboard)
        /*
        api.notifyCustomerAboutNewOrder(
          response.pedidoId, cart.items,
          cart.deliveryType === 'envio' ? dir : 'Retiro en local', 
          cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar', 
          response.numConfirmacion, user.email, user.name
        ).catch(e => console.error(e));
        */

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
                
                <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.95rem', color: 'var(--gray-700)', cursor: 'pointer', padding: '10px 0', textAlign: 'left' }}>
                  <input type="checkbox" required style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  Acepto los <button type="button" style={{ background: 'none', border: 'none', color: 'var(--red-500)', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setModal('terms')}>Términos y Condiciones y Política de Privacidad</button> para Usuarios.
                </label>

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
                <h2>Términos y Condiciones y Política de Privacidad</h2>
                <div style={{ fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.5, maxHeight: '350px', overflowY: 'auto', paddingRight: '10px', textAlign: 'left' }}>
                  <h3 style={{ color: 'var(--red-600)', marginTop: 0 }}>📄 1. USUARIOS – TÉRMINOS Y CONDICIONES</h3>
                  <p><strong>1. Naturaleza del servicio</strong></p>
                  <p>Weep es una plataforma que Intermedia entre usuarios y comercios, facilita la gestión de pedidos y coordina la logística de entrega. Weep no elabora ni comercializa productos.</p>
                  <p><strong>2. Relación contractual</strong></p>
                  <p>El usuario acepta que la compra es con el comercio, la entrega es realizada por repartidores independientes, y Weep no es parte directa de dichas relaciones.</p>
                  <p><strong>3. Productos</strong></p>
                  <p>Los comercios son los únicos responsables de Calidad, Ingredientes, Higiene y Estado. Weep no garantiza los productos.</p>
                  <p><strong>4. Entregas</strong></p>
                  <p>Weep coordina entregas mediante repartidores independientes. El usuario acepta que los tiempos son estimados, pueden existir demoras y existen riesgos inherentes a la logística.</p>
                  <p><strong>5. Limitación de responsabilidad</strong></p>
                  <p>Weep no será responsable por intoxicaciones, problemas de salud, daños derivados del producto, demoras razonables o fallas de terceros.</p>
                  <p><strong>6. Pagos</strong></p>
                  <p>Los pagos se procesan mediante Mercado Pago. Weep no es entidad financiera, no fija precios y puede aplicar comisiones.</p>
                  <p><strong>7. Cancelaciones</strong></p>
                  <p>Dependen del comercio y estado del pedido.</p>
                  <p><strong>8. Indemnidad</strong></p>
                  <p>El usuario mantiene indemne a Weep ante reclamos derivados del uso.</p>
                  <p><strong>9. Aceptación</strong></p>
                  <p>Mediante registro y confirmación electrónica.</p>
                  <hr style={{ margin: '15px 0', borderColor: '#eee' }} />
                  <h3 style={{ color: 'var(--red-600)' }}>🔒 USUARIOS – POLÍTICA DE PRIVACIDAD</h3>
                  <p><strong>Datos recolectados:</strong></p>
                  <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                    <li>Nombre, teléfono, email</li>
                    <li>Dirección</li>
                    <li>Ubicación en tiempo real</li>
                    <li>Historial de pedidos</li>
                  </ul>
                  <p><strong>Uso de datos:</strong></p>
                  <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                    <li>Procesar pedidos</li>
                    <li>Coordinar entregas</li>
                    <li>Asignar repartidores</li>
                  </ul>
                  <p><strong>Compartición:</strong></p>
                  <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                    <li>Comercios</li>
                    <li>Repartidores</li>
                    <li>Proveedores de pago (Mercado Pago)</li>
                  </ul>
                </div>
                <button className="btn btn-secondary btn-full" onClick={() => setModal('register')} style={{ marginTop: 16 }}>Volver al Registro</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Ice Cream Modal ─── */}
      {iceCreamModal && (
        <div className="modal-overlay" onClick={() => setIceCreamModal(null)}>
          <div className="modal-box animate-scale-in" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIceCreamModal(null)}>✕</button>
            <h2 style={{ color: 'var(--red-600)', marginBottom: 8 }}>{iceCreamModal.nombre}</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--gray-500)', marginBottom: 16 }}>{iceCreamModal.descripcion}</p>
            
            <div className="size-selector" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              {Object.keys(JSON.parse(iceCreamModal.variantes).precios).map(size => (
                <button 
                  key={size}
                  className={`btn ${selectedSize === size ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => { setSelectedSize(size); setSelectedFlavors([]); }}
                  style={{ fontSize: '0.9rem', padding: '8px 4px' }}
                >
                  {size}<br/>
                  <small>${JSON.parse(iceCreamModal.variantes).precios[size].precio}</small>
                </button>
              ))}
            </div>

            <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>
               Seleccioná tus sabores <small>(Máx {JSON.parse(iceCreamModal.variantes).precios[selectedSize].max})</small>
            </h3>
            
            <div className="flavors-list" style={{ maxHeight: 200, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, padding: 4 }}>
              {iceCreamFlavors.map(flavor => {
                const isSelected = selectedFlavors.includes(flavor.nombre);
                const max = JSON.parse(iceCreamModal.variantes).precios[selectedSize].max;
                const canSelect = selectedFlavors.length < max;
                
                return (
                  <button 
                    key={flavor.id}
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 44 }}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedFlavors(prev => prev.filter(f => f !== flavor.nombre));
                      } else if (canSelect) {
                        setSelectedFlavors(prev => [...prev, flavor.nombre]);
                      }
                    }}
                  >
                    {flavor.nombre}
                  </button>
                );
              })}
            </div>

            {iceCreamSauces.length > 0 && (
              <>
                <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Salsas <small>(Opcional)</small></h3>
                <div className="sauces-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {iceCreamSauces.map(sauce => {
                    const isSelected = selectedSauces.includes(sauce.nombre);
                    return (
                      <button 
                        key={sauce.id}
                        className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => {
                          if (isSelected) setSelectedSauces(prev => prev.filter(s => s !== sauce.nombre));
                          else setSelectedSauces(prev => [...prev, sauce.nombre]);
                        }}
                      >
                        {sauce.nombre}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {iceCreamExtras.length > 0 && (
              <>
                <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Adicionales</h3>
                <div className="extras-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                  {iceCreamExtras.map(extra => {
                    const isSelected = selectedExtras.some(e => e.id === extra.id);
                    return (
                      <button 
                        key={extra.id}
                        className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => {
                          if (isSelected) setSelectedExtras(prev => prev.filter(e => e.id !== extra.id));
                          else setSelectedExtras(prev => [...prev, extra]);
                        }}
                      >
                        {extra.nombre} (+${extra.precio})
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {(() => {
              const configuration = JSON.parse(iceCreamModal.variantes);
              const basePrice = parseFloat(configuration.precios[selectedSize].precio || 0);
              const extrasPrice = selectedExtras.reduce((sum, e) => sum + parseFloat(e.precio || 0), 0);
              const currentTotal = basePrice + extrasPrice;

              return (
                <button 
                  className="btn btn-primary btn-full btn-lg"
                  disabled={selectedFlavors.length === 0}
                  onClick={() => {
                    const details = [];
                    details.push(`Sabores: ${selectedFlavors.join(', ')}`);
                    if (selectedSauces.length > 0) details.push(`Salsas: ${selectedSauces.join(', ')}`);
                    if (selectedExtras.length > 0) details.push(`Extras: ${selectedExtras.map(e => e.nombre).join(', ')}`);

                    const finalItem = {
                      ...iceCreamModal,
                      menuId: iceCreamModal.id,
                      id: `${iceCreamModal.id}-${selectedSize}-${Date.now()}`,
                      nombre: `${iceCreamModal.nombre} ${selectedSize}`,
                      precio: currentTotal,
                      flavors: selectedFlavors,
                      sauces: selectedSauces,
                      extras: selectedExtras,
                      descripcion: details.join(' | ')
                    };
                    cart.addItem(finalItem);
                    setIceCreamModal(null);
                    toast.success('¡Helado agregado!');
                  }}
                >
                  Agregar al carrito • ${currentTotal}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {burgerModal && (
        <div className="modal-overlay" onClick={() => setBurgerModal(null)}>
          <div className="modal-box animate-scale-in" style={{ maxWidth: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setBurgerModal(null)}>✕</button>
            <div style={{ fontSize: '3rem', marginBottom: 15 }}>{withFries ? '🍟' : '🍔'}</div>
            <h2 style={{ color: 'var(--red-600)', marginBottom: 10 }}>¿Lo hacemos COMBO?</h2>
            <p style={{ color: 'var(--gray-600)', marginBottom: 20 }}>
              ¿Querés sumar <strong>papas fritas</strong> a tu {burgerModal.nombre}?
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div 
                className={`selection-card ${withFries ? 'active' : ''}`}
                onClick={() => setWithFries(true)}
                style={{ 
                  padding: '20px 10px', 
                  borderRadius: '12px', 
                  border: withFries ? '2px solid var(--red-500)' : '2px solid #eee',
                  backgroundColor: withFries ? '#fff5f5' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <div style={{ fontSize: '2rem' }}>🍟</div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>¡Si, con papas!</div>
                <div style={{ color: 'var(--red-600)', fontWeight: 600 }}>+ ${JSON.parse(burgerModal.variantes).precio_papas}</div>
              </div>

              <div 
                className={`selection-card ${!withFries ? 'active' : ''}`}
                onClick={() => setWithFries(false)}
                style={{ 
                  padding: '20px 10px', 
                  borderRadius: '12px', 
                  border: !withFries ? '2px solid var(--gray-600)' : '2px solid #eee',
                  backgroundColor: !withFries ? '#f9f9f9' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <div style={{ fontSize: '2rem' }}>🍔</div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>No, solo la burguer</div>
                <div style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>Sin adicionales</div>
              </div>
            </div>

            <button 
              className="btn btn-primary btn-full btn-lg"
              onClick={() => {
                const config = JSON.parse(burgerModal.variantes);
                const extra = withFries ? Number(config.precio_papas) : 0;
                const finalItem = {
                  ...burgerModal,
                  menuId: burgerModal.id, // CRITICAL FIX: Store original menu item ID
                  nombre: withFries ? `${burgerModal.nombre} + PAPAS` : burgerModal.nombre,
                  precio: Number(burgerModal.precio) + extra,
                  id: withFries ? `${burgerModal.id}-conpapas` : burgerModal.id // Unique ID for cart
                };
                cart.addItem(finalItem);
                setBurgerModal(null);
                toast.success('¡Agregado!');
              }}
            >
              Agregar • ${Number(burgerModal.precio) + (withFries ? Number(JSON.parse(burgerModal.variantes).precio_papas) : 0)}
            </button>
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
