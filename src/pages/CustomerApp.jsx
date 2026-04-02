import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useJsApiLoader } from '@react-google-maps/api';
import * as api from '../services/api';
import { iniciarPagoMercadoPago } from '../services/mercadopago';
import toast from 'react-hot-toast';
import AddressSelector from '../components/AddressSelector';
import './CustomerApp.css';

export default function CustomerApp() {
  // Map Loading
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!googleMapsApiKey) {
    console.error("❌ ERROR: VITE_GOOGLE_MAPS_API_KEY is missing in .env file or build process.");
  }

  const { isLoaded: isMapLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey,
    libraries: ['places']
  });

  if (loadError) {
    console.error("❌ Error loading Google Maps in CustomerApp:", loadError);
  }
  
  const { user, loginAsUser, logoutUser: doLogout, updateUserAddress } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();

  const [locals, setLocals] = React.useState([]);
  const [menus, setMenus] = React.useState([]);
  const [menuTitle, setMenuTitle] = React.useState('');
  const [showMenus, setShowMenus] = React.useState(false);
  const [loadingMenus, setLoadingMenus] = React.useState(false);
  const [favorites, setFavorites] = React.useState([]);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [filteredLocals, setFilteredLocals] = React.useState(null);
  const [selectedCategory, setSelectedCategory] = React.useState(null);
  const [loadingLocals, setLoadingLocals] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [modal, setModal] = React.useState(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [iceCreamModal, setIceCreamModal] = React.useState(null);
  const [iceCreamFlavors, setIceCreamFlavors] = React.useState([]);
  const [iceCreamSauces, setIceCreamSauces] = React.useState([]);
  const [iceCreamExtras, setIceCreamExtras] = React.useState([]);
  const [selectedSize, setSelectedSize] = React.useState('1/4kg');
  const [selectedFlavors, setSelectedFlavors] = React.useState([]);
  const [selectedSauces, setSelectedSauces] = React.useState([]);
  const [selectedExtras, setSelectedExtras] = React.useState([]);
  const [burgerModal, setBurgerModal] = React.useState(null);
  const [selectedVariant, setSelectedVariant] = React.useState(null);
  const [selectedBurgerExtras, setSelectedBurgerExtras] = React.useState([]);
  const [withFries, setWithFries] = React.useState(false);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [drinks, setDrinks] = React.useState([]);
  const [hasRepartidores, setHasRepartidores] = React.useState(true);
  const [metodoPago, setMetodoPago] = React.useState('');
  const [hasActiveOrder, setHasActiveOrder] = React.useState(false);
  const [showRegretModal, setShowRegretModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  
  // States for Address Selector
  const [showAddressSelector, setShowAddressSelector] = React.useState(false);
  const [showProfileAddressSelector, setShowProfileAddressSelector] = React.useState(false);
  
  const [addressData, setAddressData] = React.useState({
    address: user?.direccion || '',
    lat: user?.lat || null,
    lng: user?.lng || null,
    reference: ''
  });

  const [unavailableLocal, setUnavailableLocal] = React.useState(null);

  // Actualizar addressData cuando el usuario carga (login)
  React.useEffect(() => {
    if (user && !addressData.address) {
      setAddressData(prev => ({
        ...prev,
        address: user.direccion || '',
        lat: user.lat || null,
        lng: user.lng || null
      }));
    }
  }, [user]);

  const searchTimeout = React.useRef(null);
  
  const isLocalOpen = React.useCallback((local) => {
    if (!local) return false;

    // Verificar si ya pasó la fecha de disponibilidad
    if (local.disponible_desde) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parts = local.disponible_desde.split('-');
      const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
      if (today < availableDate) return false;
    }
    
    // Si no tiene modo automático, dependemos del estado manual
    if (!local.modo_automatico) {
      return local.estado?.toLowerCase() === 'activo';
    }

    // Si tiene modo automático, verificamos horario y días
    const { horario_apertura, horario_cierre, dias_apertura } = local;
    if (!horario_apertura || !horario_cierre) return local.estado?.toLowerCase() === 'activo';

    // Verificar días
    if (dias_apertura && Array.isArray(dias_apertura) && dias_apertura.length > 0) {
      const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const currentDayName = daysMap[new Date().getDay()];
      const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedDays = dias_apertura.map(normalize);
      const normalizedCurrentDay = normalize(currentDayName);
      if (!normalizedDays.includes(normalizedCurrentDay)) return false;
    }

    // Verificar horario
    const [hA, mA] = horario_apertura.split(':').map(Number);
    const [hC, mC] = horario_cierre.split(':').map(Number);
    const minApertura = hA * 60 + mA;
    const minCierre = hC * 60 + mC;
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();

    let insideTime = false;
    if (minApertura < minCierre) {
      insideTime = current >= minApertura && current <= minCierre;
    } else {
      insideTime = current >= minApertura || current <= minCierre;
    }

    return insideTime;
  }, []);

  // Load locals + drinks on mount
  React.useEffect(() => {
    api.getLocales().then(d => setLocals(d || [])).catch(() => {});
    api.getBebidas().then(d => setDrinks(d || [])).catch(() => {});
    if (user) {
      api.getFavoritos(user.id).then(d => {
        if (Array.isArray(d)) setFavorites(d);
      }).catch(() => {});
      
      // Verificar si hay pedidos activos
      api.getMisPedidos(user.id).then(res => {
        if (res.enCurso && res.enCurso.length > 0) {
          setHasActiveOrder(true);
        } else {
          setHasActiveOrder(false);
        }
      }).catch(() => {});
    }
  }, [user]);

  // MP Return URL Parse
  React.useEffect(() => {
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
            
            // Facebook Pixel: Purchase
            if (window.fbq) {
              window.fbq('track', 'Purchase', {
                value: pendingData.total,
                currency: 'ARS',
                content_ids: [pendingData.pedidoId],
                content_type: 'product_group'
              });
            }

            // Google Analytics: purchase
            if (window.gtag) {
              window.gtag('event', 'purchase', {
                transaction_id: pendingData.pedidoId,
                value: pendingData.total,
                currency: 'ARS',
                items: pendingData.cart.map(i => ({
                  item_id: i.id,
                  item_name: i.nombre,
                  quantity: i.qty,
                  price: i.precio
                }))
              });
            }

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
  React.useEffect(() => {
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

  const fetchMenusByLocal = React.useCallback((localId, catId = null) => {
    setLoadingMenus(true);
    const local = (filteredLocals || locals).find(l => l.id === localId) || locals.find(l => l.id === localId);
    api.getMenuByLocalId(localId).then(d => {
      let mapped = (d || [])
        .filter(i => i.disponibilidad !== false)
        .map(i => ({
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

  const fetchByCategory = React.useCallback((cat) => {
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
        precio_min: l.precio_min_categoria || 0,
        horario_apertura: l.horario_apertura,
        horario_cierre: l.horario_cierre,
        modo_automatico: l.modo_automatico,
        dias_apertura: l.dias_apertura
      }));
      setFilteredLocals(mapped);
      setSelectedCategory(cat);
      setShowMenus(false);
      setTimeout(() => {
        document.querySelector('.locals-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }).catch(() => toast.error('Error al cargar locales')).finally(() => setLoadingLocals(false));
  }, [user, favorites]);

  const toggleFav = React.useCallback(async (menuId) => {
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
        loginAsUser({ userId: d.userId, name: d.nombre, email: d.email || fd.get('email'), address: d.direccion, emailConfirmado: d.emailConfirmado });
        setModal(null);
        toast.success('¡Bienvenido!');
      } else toast.error('Credenciales incorrectas');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (!user?.email) return;
    const loading = toast.loading('Reenviando email...');
    try {
      const res = await api.reenviarEmailConfirmacion(user.email, 'usuario');
      if (res.success) toast.success('¡Email reenviado! Revisa tu bandeja de entrada.', { id: loading });
      else toast.error(res.error || 'Error al reenviar', { id: loading });
    } catch { toast.error('Error de conexión', { id: loading }); }
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

  // --- Business Logic for Totals ---
  const PLATFORM_COMMISSION = 0.08;
  const MP_FEE = 0.0824;

  const calculateCheckoutTotals = (P, E, method) => {
    if (method === 'transferencia') {
      const commission = P * PLATFORM_COMMISSION;
      const mp_base = E + commission;
      const mp_adjusted = mp_base / (1 - MP_FEE);
      const mp_fee = mp_adjusted - mp_base;
      const total = P + E + mp_fee;
      
      return {
        total: Math.round(total),
        product_total: P,
        delivery_fee: E,
        commission: Math.round(commission),
        mp_fee: Math.round(mp_fee),
        merchant_payout: Math.round(P - commission),
        platform_gross: Math.round(mp_adjusted),
        platform_net: Math.round(E + commission)
      };
    }
    
    // Default (Efectivo)
    const commission = P * PLATFORM_COMMISSION;
    return {
      total: Math.round(P + E),
      product_total: P,
      delivery_fee: E,
      commission: Math.round(commission),
      mp_fee: 0,
      merchant_payout: Math.round(P - commission),
      platform_gross: 0,
      platform_net: Math.round(E + commission)
    };
  };

  const checkoutTotals = calculateCheckoutTotals(cart.subtotal, cart.shippingCost, metodoPago);
  const totalConComision = checkoutTotals.total;
  const mpFeeUI = checkoutTotals.mp_fee;

  // UI-only disguise for "envio"
  // When shipping is $2,000, we show it as $1,700 and add the $300 to the fee label.
  const showSurchargeDisguise = cart.shippingCost === 1800;
  const visibleShipping = showSurchargeDisguise ? 1500 : cart.shippingCost;
  const visibleMpFee = showSurchargeDisguise ? (mpFeeUI + 300) : mpFeeUI;

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

    // Detect if it's a Burger or Combo
    let burgerCfg = null;
    try {
      if (menu.variantes) {
        const parsed = JSON.parse(menu.variantes);
        if (parsed.es_hamburguesa || parsed.es_combo || parsed.con_papas) {
          burgerCfg = parsed;
        }
      }
    } catch(e){}
    
    if (burgerCfg) {
      setBurgerModal(menu);
      setSelectedVariant(burgerCfg.variants?.[0] || null);
      setSelectedBurgerExtras([]);
      setWithFries(false);
      return; 
    }

    // Facebook Pixel: AddToCart
    if (window.fbq) {
      window.fbq('track', 'AddToCart', {
        content_name: menu.nombre,
        content_ids: [menu.id],
        content_type: 'product',
        value: menu.precio,
        currency: 'ARS'
      });
    }

    // Google Analytics: add_to_cart
    if (window.gtag) {
      window.gtag('event', 'add_to_cart', {
        currency: 'ARS',
        value: menu.precio,
        items: [{
          item_id: menu.id,
          item_name: menu.nombre,
          price: menu.precio,
          quantity: 1
        }]
      });
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
    const mp = metodoPago; // Use state instead of FormData
    const dir = addressData.address;
    if (cart.deliveryType === 'envio' && !dir) { toast.error('Ingresá tu dirección de entrega'); return; }
    if (!mp) { toast.error('Seleccioná un método de pago'); return; }
    
    // Facebook Pixel: InitiateCheckout
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout');
    }

    // Google Analytics: begin_checkout
    if (window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'ARS',
        value: cart.subtotal,
        items: cart.items.map(i => ({
          item_id: i.id,
          item_name: i.nombre,
          price: i.precio,
          quantity: i.qty
        }))
      });
    }

    // Check repartidores active strictly before proceeding if envio is selected
    if (cart.deliveryType === 'envio' && !hasRepartidores) {
      toast.error('No hay repartidores disponibles. Debes retirar en local.');
      cart.setDeliveryType('retiro');
      return;
    }

    setCheckoutLoading(true);
    try {
      // 7. Calculate exact prices using new logic
      const calcSubtotal = cart.items.reduce((sum, i) => sum + (Number(i.precio) * i.qty), 0);
      const tieneBebida = cart.items.some(i => i.categoria?.toLowerCase() === 'bebidas');
      // [PAUSED] Lógica de envío gratis con bebida desactivada temporalmente.
      // const shipping = (cart.deliveryType === 'envio' && !tieneBebida) ? 1800 : 0;
      const shipping = cart.deliveryType === 'envio' ? 1800 : 0;
      
      const finalTotals = calculateCheckoutTotals(calcSubtotal, shipping, mp);
      const exactTotal = finalTotals.total;

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
          metodoPago: mp, observaciones: (fd.get('observaciones') || '') + (addressData.reference ? ` | Ref: ${addressData.reference}` : ''),
          items: orderItems,
          emailCliente: user.email, nombreCliente: user.name,
          estadoInicial: 'Pendiente',
          totalCalculado: exactTotal,
          lat: addressData.lat,
          lng: addressData.lng
        });

        toast.success(`¡Pedido #${response.pedidoId} registrado exitosamente!`);
        
        // Facebook Pixel: Purchase (Cash)
        if (window.fbq) {
          window.fbq('track', 'Purchase', {
            value: exactTotal,
            currency: 'ARS',
            content_ids: [response.pedidoId],
            content_type: 'product_group'
          });
        }

        // Google Analytics: purchase (Cash)
        if (window.gtag) {
          window.gtag('event', 'purchase', {
            transaction_id: response.pedidoId,
            value: exactTotal,
            currency: 'ARS',
            items: cart.items.map(i => ({
              item_id: i.id,
              item_name: i.nombre,
              quantity: i.qty,
              price: i.precio
            }))
          });
        }

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
          metodoPago: mp, observaciones: (fd.get('observaciones') || '') + (addressData.reference ? ` | Ref: ${addressData.reference}` : ''),
          emailCliente: user.email, nombreCliente: user.name,
          totalCalculado: exactTotal,
          lat: addressData.lat,
          lng: addressData.lng
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
    { type: 'Helados', label: 'Helados', img: 'https://i.postimg.cc/VLPKFCY9/buscamos-repartidores-(18).png' },
    { type: 'Combos', label: 'Combos', img: 'https://i.postimg.cc/1X1wQDX5/buscamos-repartidores-(19).png' },
    { type: 'favoritos', label: 'Mis favoritos', img: 'https://i.postimg.cc/RCktgLyZ/buscamos-repartidores-(7).png' },
  ];

  // Show drinks carousel when no drink in cart and delivery is envio
  const showDrinks = cart.items.length > 0 && cart.deliveryType === 'envio' && !cart.hasDrink && drinks.length > 0;

  return (
    <div className="customer-app">
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
        <div className="banners-container" style={{ marginBottom: '20px' }}>
          {user && hasActiveOrder && (
            <div className="active-order-banner" style={{
              background: '#ff9800',
              color: 'white',
              padding: '12px 20px',
              textAlign: 'center',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              borderBottom: '2px solid #e68a00',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(255,152,0,0.3)',
              fontWeight: '600',
              zIndex: 90
            }}>
              <span>🛵 ¡Tienes un pedido en proceso!</span>
              <button 
                onClick={() => navigate('/mis-pedidos')} 
                style={{
                  background: 'white',
                  color: '#ff9800',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                Ver Mis Pedidos
              </button>
            </div>
          )}
        </div>
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

        <p className="antojo-text animate-fade-in" style={{ animationDelay: '0.2s' }}>Prepará tu antojo para hoy...</p>

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
            {!loadingLocals && !filteredLocals && locals.length === 0 && (
              <div className="empty-locals-striking animate-fade-in">
                <div className="empty-icon">🛵</div>
                <p>No hay locales activos en este momento</p>
                <span>¡Volvé pronto para pedir tu antojo!</span>
              </div>
            )}
            {!loadingLocals && filteredLocals && filteredLocals.length === 0 && (
              <div className="empty-locals-striking animate-fade-in">
                <div className="empty-icon">🍳</div>
                <p>No hay {selectedCategory} hoy</p>
                <span>Probá con otra categoría o buscá más abajo</span>
              </div>
            )}
            {!loadingLocals && (filteredLocals || locals).map(local => {
              const open = isLocalOpen(local);
              
              // Verificar si es una apertura futura
              let isFutureOpening = false;
              let availabilityMsg = "";
              if (local.disponible_desde) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const parts = local.disponible_desde.split('-');
                const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
                if (today < availableDate) {
                  isFutureOpening = true;
                  availabilityMsg = `Disponible desde ${availableDate.toLocaleDateString('es-AR')}`;
                }
              }

              if (filteredLocals) {
                return (
                  <button
                    key={local.id}
                    className={`suggestion-categoria ${open ? 'open' : 'closed'} ${isFutureOpening ? 'future-opening' : ''}`}
                    onClick={() => {
                      if (isFutureOpening) {
                        setUnavailableLocal(local);
                        // No toast for future locals as requested
                      } else if (open) {
                        setUnavailableLocal(null);
                        fetchMenusByLocal(local.id, selectedCategory);
                      } else {
                        toast('Este local está cerrado', { icon: '🔒' });
                        setUnavailableLocal(null);
                      }
                    }}
                    style={{ flex: '0 0 auto', border: 'none' }}
                  >
                    <img
                      src={local.logo || `https://placehold.co/120x120?text=${encodeURIComponent(local.nombre)}`}
                      alt={local.nombre}
                      onError={(e) => { e.target.src = 'https://placehold.co/120x120?text=Local'; }}
                    />
                    <div className="suggestion-info">
                      <div className="local-name">{local.nombre}</div>
                      {isFutureOpening ? (
                        <div className="availability-badge" style={{ color: 'var(--red-600)', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          {availabilityMsg}
                        </div>
                      ) : (
                        <div className="categoria-precio">
                          <span className="cat">{selectedCategory}</span>
                          <span className="precio-min">desde ${Number(local.precio_min || 0).toLocaleString('es-AR')}</span>
                        </div>
                      )}
                    </div>
                    {open && <span className="open-dot" style={{ position: 'absolute', top: 5, right: 5, width: 12, height: 12, borderWidth: 2 }} />}
                  </button>
                );
              }

              return (
                <button
                  key={local.id}
                  className={`local-circle ${open ? 'open' : 'closed'} ${isFutureOpening ? 'future-opening' : ''}`}
                  onClick={() => {
                    if (isFutureOpening) {
                      setUnavailableLocal(local);
                      // No toast for future locals as requested
                    } else if (open) {
                      setUnavailableLocal(null);
                      fetchMenusByLocal(local.id, selectedCategory);
                    } else {
                      toast('Este local está cerrado', { icon: '🔒' });
                      setUnavailableLocal(null);
                    }
                  }}
                  title={isFutureOpening ? availabilityMsg : local.nombre}
                >
                  <img
                    src={local.logo || `https://placehold.co/200x200?text=${encodeURIComponent(local.nombre)}`}
                    alt={local.nombre}
                    onError={(e) => { e.target.src = 'https://placehold.co/200x200?text=Local'; }}
                    style={isFutureOpening ? { filter: 'grayscale(0.5)' } : {}}
                  />
                  {open && <span className="open-dot" />}
                  {isFutureOpening && (
                    <div className="future-badge" style={{
                      position: 'absolute',
                      bottom: -10,
                      background: 'black',
                      color: 'white',
                      fontSize: '0.6rem',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap',
                      border: '1px solid white'
                    }}>
                      Abre {new Date(local.disponible_desde.split('-')[0], local.disponible_desde.split('-')[1]-1, local.disponible_desde.split('-')[2]).toLocaleDateString('es-AR', {day: 'numeric', month: 'short'})}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {unavailableLocal && (
            <div className="unavailable-local-info animate-fade-in" style={{
              marginTop: '16px',
              padding: '12px 20px',
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ fontSize: '1.2rem' }}>📅</span>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--red-600)' }}>
                <strong>{unavailableLocal.nombre}</strong> estará disponible a partir del {new Date(unavailableLocal.disponible_desde.split('-')[0], unavailableLocal.disponible_desde.split('-')[1]-1, unavailableLocal.disponible_desde.split('-')[2]).toLocaleDateString('es-AR')}
              </p>
              <button 
                className="btn btn-ghost btn-xs" 
                onClick={() => setUnavailableLocal(null)}
                style={{ fontSize: '0.75rem', marginTop: '4px' }}
              >
                Cerrar aviso
              </button>
            </div>
          )}
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

              <div className="payment-method-selector" style={{ marginTop: '20px', marginBottom: '10px' }}>
                <label className="form-label">Seleccionar método de pago</label>
                <select 
                  className="form-select" 
                  value={metodoPago} 
                  onChange={e => setMetodoPago(e.target.value)}
                  style={{ marginBottom: '10px' }}
                >
                  <option value="" disabled>Elegí cómo pagar</option>
                  <option value="transferencia">Transferencia / Mercado Pago</option>
                  <option value="efectivo">Efectivo</option>
                </select>
              </div>

              <div className="cart-summary">
                <div className="cart-line"><span>Subtotal</span><span>${cart.subtotal.toLocaleString('es-AR')}</span></div>
                <div className="cart-line">
                  <span>Envío</span>
                  <span>{visibleShipping === 0 ? '¡GRATIS!' : `$${visibleShipping.toLocaleString('es-AR')}`}</span>
                </div>
                {visibleMpFee > 0 && (
                  <div className="cart-line comision-line">
                    <span>Gestión de pago</span>
                    <span>+${visibleMpFee.toLocaleString('es-AR')}</span>
                  </div>
                )}
                <div className="cart-line total-line">
                  <span>Total</span>
                  <span>${totalConComision.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              <form onSubmit={handleCheckout} className="checkout-form">
                {cart.deliveryType === 'envio' && (
                  <div className="address-selector-input-group" style={{ marginBottom: '16px', position: 'relative' }}>
                    <label className="form-label" style={{ display: 'block', textAlign: 'left', marginBottom: '8px' }}>
                      Dirección de entrega
                    </label>
                    <div 
                      className="input-with-icon" 
                      onClick={() => setShowAddressSelector(true)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <input 
                        type="text"
                        className="form-input"
                        placeholder="📍 Seleccioná tu dirección en el mapa..."
                        value={addressData.address || ''}
                        readOnly
                        style={{ paddingLeft: '40px', cursor: 'pointer', backgroundColor: '#fff', border: '1px solid #ddd' }}
                      />
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem' }}>
                        📍
                      </span>
                    </div>
                    {addressData.address && (
                      <button 
                        type="button" 
                        className="btn-text" 
                        style={{ display: 'block', margin: '4px 0', fontSize: '0.8rem', color: 'var(--red-500)', fontWeight: 'bold' }}
                        onClick={() => setShowAddressSelector(true)}
                      >
                        (Cambiar ubicación)
                      </button>
                    )}
                    {addressData.reference && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '4px', textAlign: 'left' }}>
                        Ref: {addressData.reference}
                      </p>
                    )}
                  </div>
                )}
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
        <div className="modal-overlay" onClick={() => { setModal(null); setShowPassword(false); }}>
          <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setModal(null); setShowPassword(false); }}>✕</button>

            {modal === 'login' && (
              <form onSubmit={handleLogin}>
                <h2>Iniciar Sesión</h2>
                <input name="email" type="email" className="form-input" placeholder="Email" required autoComplete="username" />
                <div className="password-container">
                  <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    className="form-input" 
                    placeholder="Contraseña" 
                    required 
                    autoComplete="current-password" 
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    <img 
                      src={showPassword ? "https://i.postimg.cc/mrfJz5P3/buscamos-repartidores-(8).png" : "https://i.postimg.cc/Zq8grxNr/buscamos-repartidores-(9).png"} 
                      alt="Ver" 
                    />
                  </button>
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Entrar'}
                </button>
                <p className="modal-switch">¿No tenés cuenta? <button type="button" onClick={() => { setModal('register'); setShowPassword(false); }}>Registrate</button></p>
              </form>
            )}

            {modal === 'register' && (
              <form onSubmit={handleRegister}>
                <h2>Registro</h2>
                <input name="email" type="email" className="form-input" placeholder="Email" required autoComplete="username" />
                <input name="nombre" className="form-input" placeholder="Nombre completo" required autoComplete="name" />
                <div className="password-container">
                  <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    className="form-input" 
                    placeholder="Contraseña (6+ caracteres)" 
                    required 
                    autoComplete="new-password" 
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    <img 
                      src={showPassword ? "https://i.postimg.cc/mrfJz5P3/buscamos-repartidores-(8).png" : "https://i.postimg.cc/Zq8grxNr/buscamos-repartidores-(9).png"} 
                      alt="Ver" 
                    />
                  </button>
                </div>
                <input name="direccion" className="form-input" placeholder="Dirección (opcional)" autoComplete="street-address" />
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px', textAlign: 'left' }}>
                  <input type="checkbox" id="terms_accepted" name="terms_accepted" required style={{ width: 'auto', marginTop: '4px' }} />
                  <label htmlFor="terms_accepted" style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
                    Acepto los <button type="button" style={{ background: 'none', border: 'none', color: 'var(--red-500)', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setModal('terms')}>Términos y Condiciones y Política de Privacidad</button> para Usuarios.
                  </label>
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Registrarme'}
                </button>
                <p className="modal-switch">¿Ya tenés cuenta? <button type="button" onClick={() => { setModal('login'); setShowPassword(false); }}>Iniciar sesión</button></p>
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
              <div>
                <h2>Cambiar Mi Dirección</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', marginBottom: '16px' }}>
                  Seleccioná tu ubicación predeterminada en el mapa para futuras compras.
                </p>
                <button 
                  className="btn btn-primary btn-full" 
                  onClick={() => setShowProfileAddressSelector(true)}
                >
                  📍 Abrir Mapa de Dirección
                </button>
                <p style={{ marginTop: '12px', fontSize: '0.85rem' }}>
                  <strong>Actual:</strong> {user?.address || 'No configurada'}
                </p>
              </div>
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
                    // Facebook Pixel: AddToCart (Ice Cream)
                    if (window.fbq) {
                      window.fbq('track', 'AddToCart', {
                        content_name: finalItem.nombre,
                        content_ids: [finalItem.menuId],
                        content_type: 'product',
                        value: finalItem.precio,
                        currency: 'ARS'
                      });
                    }

                    // Google Analytics: add_to_cart (Ice Cream)
                    if (window.gtag) {
                      window.gtag('event', 'add_to_cart', {
                        currency: 'ARS',
                        value: finalItem.precio,
                        items: [{
                          item_id: finalItem.menuId,
                          item_name: finalItem.nombre,
                          price: finalItem.precio,
                          quantity: 1
                        }]
                      });
                    }

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
          <div className="modal-box animate-scale-in" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setBurgerModal(null)}>✕</button>
            <h2 style={{ color: 'var(--red-600)', marginBottom: 8 }}>{burgerModal.nombre}</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--gray-500)', marginBottom: 20 }}>{burgerModal.descripcion}</p>
            
            {(() => {
              const cfg = JSON.parse(burgerModal.variantes);
              
              if (cfg.es_hamburguesa || cfg.es_combo) {
                const baseVariantPrice = Number(selectedVariant?.precio || burgerModal.precio);
                const extrasPriceTotal = selectedBurgerExtras.reduce((sum, e) => sum + Number(e.precio || 0), 0);
                const friesPrice = withFries ? Number(cfg.precio_papas || 0) : 0;
                const totalCalculated = baseVariantPrice + extrasPriceTotal + friesPrice;

                return (
                  <>
                    {cfg.variants?.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>Seleccioná la opción:</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          {cfg.variants.map((v, i) => (
                            <button 
                              key={i}
                              className={`btn ${selectedVariant?.nombre === v.nombre ? 'btn-primary' : 'btn-outline'}`}
                              onClick={() => setSelectedVariant(v)}
                              style={{ fontSize: '0.85rem' }}
                            >
                              {v.nombre}<br/>
                              <small>${v.precio}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {cfg.extras?.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>Adicionales (Precio extra):</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {cfg.extras.map((ex, i) => {
                            const isIncluded = selectedBurgerExtras.some(e => e.nombre === ex.nombre);
                            return (
                              <button 
                                key={i}
                                className={`btn btn-xs ${isIncluded ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => {
                                  if (isIncluded) setSelectedBurgerExtras(prev => prev.filter(e => e.nombre !== ex.nombre));
                                  else setSelectedBurgerExtras(prev => [...prev, ex]);
                                }}
                              >
                                {ex.nombre} (+${ex.precio})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {cfg.con_papas && (
                      <div style={{ marginBottom: 24, padding: '12px', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '1.5rem' }}>🍟</span>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Combo con Papas Fritas</div>
                              <div style={{ color: 'var(--red-600)', fontSize: '0.8rem', fontWeight: 600 }}>+ ${cfg.precio_papas}</div>
                            </div>
                          </div>
                          <button 
                            className={`btn btn-sm ${withFries ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setWithFries(!withFries)}
                          >
                            {withFries ? 'Agregado ✓' : 'Agregar'}
                          </button>
                        </div>
                      </div>
                    )}

                    <button 
                      className="btn btn-primary btn-full btn-lg"
                      onClick={() => {
                        const variantText = selectedVariant ? `${selectedVariant.nombre}` : '';
                        const extrasText = selectedBurgerExtras.map(e => e.nombre).join(' + ');
                        const friesText = withFries ? ' + PAPAS' : '';
                        
                        let finalName = burgerModal.nombre;
                        if (variantText) finalName += ` ${variantText}`;
                        if (extrasText) finalName += ` c/ ${extrasText}`;
                        finalName += friesText;

                        const finalItem = {
                          ...burgerModal,
                          menuId: burgerModal.id,
                          id: `${burgerModal.id}-${Date.now()}`,
                          nombre: finalName,
                          precio: totalCalculated,
                          variant: selectedVariant,
                          burgerExtras: selectedBurgerExtras,
                          withFries: withFries
                        };
                        // Facebook Pixel: AddToCart (Burger/Combo)
                        if (window.fbq) {
                          window.fbq('track', 'AddToCart', {
                            content_name: finalItem.nombre,
                            content_ids: [finalItem.menuId],
                            content_type: 'product',
                            value: finalItem.precio,
                            currency: 'ARS'
                          });
                        }

                        // Google Analytics: add_to_cart (Burger/Combo)
                        if (window.gtag) {
                          window.gtag('event', 'add_to_cart', {
                            currency: 'ARS',
                            value: finalItem.precio,
                            items: [{
                              item_id: finalItem.menuId,
                              item_name: finalItem.nombre,
                              price: finalItem.precio,
                              quantity: 1
                            }]
                          });
                        }

                        cart.addItem(finalItem);
                        setBurgerModal(null);
                        toast.success(`¡${cfg.es_combo ? 'Combo agregado' : 'Hamburguesa agregada'}!`);
                      }}
                    >
                      Agregar al carrito • ${totalCalculated}
                    </button>
                  </>
                );
              } else {
                // Backward compatibility for old "con_papas" only logic
                return (
                  <div style={{ textAlign: 'center' }}>
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
                          padding: '20px 10px', borderRadius: '12px', border: withFries ? '2px solid var(--red-500)' : '2px solid #eee',
                          backgroundColor: withFries ? '#fff5f5' : '#fff', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
                        }}
                      >
                        <div style={{ fontSize: '2rem' }}>🍟</div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>¡Si, con papas!</div>
                        <div style={{ color: 'var(--red-600)', fontWeight: 600 }}>+ ${cfg.precio_papas}</div>
                      </div>

                      <div 
                        className={`selection-card ${!withFries ? 'active' : ''}`}
                        onClick={() => setWithFries(false)}
                        style={{ 
                          padding: '20px 10px', borderRadius: '12px', border: !withFries ? '2px solid var(--gray-600)' : '2px solid #eee',
                          backgroundColor: !withFries ? '#f9f9f9' : '#fff', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
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
                        const extra = withFries ? Number(cfg.precio_papas) : 0;
                        const finalItem = {
                          ...burgerModal,
                          menuId: burgerModal.id,
                          nombre: withFries ? `${burgerModal.nombre} + PAPAS` : burgerModal.nombre,
                          precio: Number(burgerModal.precio) + extra,
                          id: withFries ? `${burgerModal.id}-conpapas` : burgerModal.id
                        };
                        cart.addItem(finalItem);
                        setBurgerModal(null);
                        toast.success('¡Agregado!');
                      }}
                    >
                      Agregar • ${Number(burgerModal.precio) + (withFries ? Number(cfg.precio_papas) : 0)}
                    </button>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}



      <footer className="footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 20px' }}>
        <img src="https://i.postimg.cc/2jKK6G3g/buscamos-repartidores-(21)-(2).png" alt="Weep" style={{ height: '50px', objectFit: 'contain' }} />
        <p>© 2026 <strong>Weep</strong> — Plataforma de Pedidos y Delivery</p>
        <p>
          <Link to="/locales">Registrá tu local</Link> •{' '}
          <button className="footer-link" onClick={() => setModal('terms')}>Términos</button> •{' '}
          <a href="mailto:bajoneando.st@gmail.com">Soporte</a> •{' '}
          <button 
            className="footer-link" 
            style={{ color: 'var(--red-600)', fontWeight: 'bold' }} 
            onClick={() => setShowRegretModal(true)}
          >
            Botón de Arrepentimiento
          </button>
        </p>
      </footer>

      {/* Regret Modal */}
      {showRegretModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowRegretModal(false)}>
          <div className="modal-box animate-fade-in" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--red-600)', marginBottom: '16px' }}>Botón de Arrepentimiento</h3>
            <p style={{ marginBottom: '20px', color: 'var(--gray-600)', fontSize: '0.95rem' }}>
              ¿Deseas arrepentirte de tu registro y eliminar tu cuenta permanentemente de Weep? <br/>
              <strong>Esta acción no se puede deshacer.</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn btn-primary" 
                style={{ background: 'var(--red-600)' }} 
                disabled={deleting}
                onClick={async () => {
                  if (!user?.userId) {
                    toast.error("Debes iniciar sesión para eliminar tu cuenta.");
                    setShowRegretModal(false);
                    return;
                  }
                  setDeleting(true);
                  try {
                    await api.deleteUsuarioAccount(user.userId);
                    toast.success("Cuenta eliminada correctamente.");
                    doLogout();
                    window.location.href = "/";
                  } catch (e) {
                    toast.error("No se pudo eliminar la cuenta. Es posible que tengas pedidos activos.");
                  } finally {
                    setDeleting(false);
                    setShowRegretModal(false);
                  }
                }}
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar mi registro'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowRegretModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Address Selector Modals ─── */}
      {showAddressSelector && (
        <AddressSelector
          isLoaded={isMapLoaded}
          initialAddress={addressData.address}
          initialCoords={addressData.lat ? { lat: addressData.lat, lng: addressData.lng } : null}
          onConfirm={(data) => {
            setAddressData(data);
            setShowAddressSelector(false);
          }}
          onCancel={() => setShowAddressSelector(false)}
        />
      )}

      {showProfileAddressSelector && (
        <AddressSelector
          isLoaded={isMapLoaded}
          initialAddress={user?.direccion || ''}
          initialCoords={user?.lat ? { lat: user.lat, lng: user.lng } : null}
          onConfirm={async (data) => {
            try {
              await api.updateDireccion(user.id, data.address, data.lat, data.lng);
              updateUserAddress(data.address);
              // Podríamos necesitar recargar el usuario localmente o actualizar el context
              toast.success('Dirección de perfil actualizada');
              setShowProfileAddressSelector(false);
              setModal('profile');
            } catch (e) {
              toast.error('Error al actualizar perfil');
            }
          }}
          onCancel={() => setShowProfileAddressSelector(false)}
        />
      )}
    </div>
  );
}
