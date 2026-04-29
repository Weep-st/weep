import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useJsApiLoader } from '@react-google-maps/api';
import AddressSelector from '../components/AddressSelector';
import * as api from '../services/api';
import { isValidEmail } from '../utils/validation';
import toast from 'react-hot-toast';
import './RestaurantDashboard.css';

const GOOGLE_MAPS_LIBRARIES = ['places'];

// V2.2 - Reset Modals Cache Fix
const getLevelName = (lvl) => {
  if (lvl === 1) return 'Despegue';
  if (lvl === 2) return 'Crecimiento';
  if (lvl === 3) return 'Experto en ventas';
  if (lvl === 4) return 'Nivel pro';
  return 'Despegue';
};

const planBenefits = {
  'Visible': [
    'Visibilidad en la plataforma',
    'Pedidos automáticos',
    'Gestión de menú en tiempo real',
    'Acceso a soporte vía email'
  ],
  'Básico': [
    'Visibilidad en la plataforma',
    'Pedidos automáticos',
    'Gestión de menú en tiempo real',
    'Acceso a soporte vía email'
  ],
  'Plan Básico': [
    'Visibilidad en la plataforma',
    'Pedidos automáticos',
    'Gestión de menú en tiempo real',
    'Acceso a soporte vía email'
  ],
  'Recomendado': [
    'Prioridad MEDIA en búsquedas',
    'Seccion Locales Recomendados',
    'Soporte prioritario',
    'Publicidad básica'
  ],
  'Destacado': [
    'Prioridad MÁXIMA (Top de lista)',
    'Banner destacado en Home',
    'Seccion Locales Recomendados',
    'Publicidad en redes Wepi'
  ]
};

export default function RestaurantDashboard() {
  const { restaurant, loginAsRestaurant, logoutRestaurant } = useAuth();

  const [view, setView] = React.useState('orders'); // 'menu','addItem','orders','profile'
  const [authView, setAuthView] = React.useState('login');
  const [authEmail, setAuthEmail] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [localOpen, setLocalOpen] = React.useState(false);
  const [profileData, setProfileData] = React.useState(null);
  const [menuItems, setMenuItems] = React.useState([]);
  const [menuLoading, setMenuLoading] = React.useState(false);
  const [menuFilter, setMenuFilter] = React.useState('');
  const [menuCatFilter, setMenuCatFilter] = React.useState('');
  const [editItem, setEditItem] = React.useState(null);
  const [itemLoading, setItemLoading] = React.useState(false);
  const [orders, setOrders] = React.useState([]);
  const [ordersLoading, setOrdersLoading] = React.useState(false);
  const [orderSearch, setOrderSearch] = React.useState('');
  const [currentTab, setCurrentTab] = React.useState('pendientes');
  const [pendingCount, setPendingCount] = React.useState(0);
  const [cobrosData, setCobrosData] = React.useState(null);
  const [cobrosLoading, setCobrosLoading] = React.useState(false);
  const [showTerms, setShowTerms] = React.useState(false);
  const [sabores, setSabores] = React.useState([]);
  const [saboresLoading, setSaboresLoading] = React.useState(false);
  const [itemCategory, setItemCategory] = React.useState('');
  const [profileSubView, setProfileSubView] = React.useState('edit'); // 'ventas', 'cobros', 'edit'
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const [adicionales, setAdicionales] = React.useState([]);
  const [adicionalesLoading, setAdicionalesLoading] = React.useState(false);
  const [showRegretModal, setShowRegretModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [hasRepartidores, setHasRepartidores] = React.useState(false);
  const [loadingRepartidores, setLoadingRepartidores] = React.useState(false);
  const [planInfo, setPlanInfo] = React.useState(null);
  const [availablePlans, setAvailablePlans] = React.useState([]);
  
  // Advanced Burger State
  const [burgerVariants, setBurgerVariants] = React.useState([{ nombre: '', precio: '' }]);
  const [burgerExtras, setBurgerExtras] = React.useState([{ nombre: '', precio: '' }]);
  const [burgerOfferPapas, setBurgerOfferPapas] = React.useState(false);
  const [burgerPrecioPapas, setBurgerPrecioPapas] = React.useState('');
  
  // Map Loading
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!googleMapsApiKey) {
    console.error("❌ ERROR: VITE_GOOGLE_MAPS_API_KEY is missing in .env file or build process.");
  }

  const { isLoaded: isMapLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  if (loadError) {
    console.error("❌ Error loading Google Maps:", loadError);
  }

  // Tutorial State
  const [showTutorial, setShowTutorial] = React.useState(false);
  const [tutorialStep, setTutorialStep] = React.useState(1);
  const [tutorialSampleOrderState, setTutorialSampleOrderState] = React.useState('Pendiente'); // To simulate order states
  const [itemName, setItemName] = React.useState('');
  const [notificationStatus, setNotificationStatus] = React.useState('loading');
  const [isIOS, setIsIOS] = React.useState(false);
  const [isBaseProductMode, setIsBaseProductMode] = React.useState(false);

  // Stock State (Moved to top level)
  const [itemManejaStock, setItemManejaStock] = React.useState(false);
  const [needsStockConfirmation, setNeedsStockConfirmation] = React.useState(false);
  const [stockToConfirm, setStockToConfirm] = React.useState([]);
  const [showStockModal, setShowStockModal] = React.useState(false);
  const [showDiscountPanel, setShowDiscountPanel] = React.useState(false);
  const [menuAddOpen, setMenuAddOpen] = React.useState(false);
  const [showGamification, setShowGamification] = React.useState(false);

  React.useEffect(() => {
    if (editItem) {
      setItemManejaStock(editItem.maneja_stock || false);
    } else {
      setItemManejaStock(false);
    }
  }, [editItem]);

  // ─── Modal Arrepentimiento ───
  const renderRegretModal = () => (
    showRegretModal && (
      <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowRegretModal(false)}>
        <div className="modal-box animate-fade-in" style={{ maxWidth: '400px', textAlign: 'center', background: 'white', padding: '24px', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ color: 'var(--red-600)', marginBottom: '16px' }}>Botón de Arrepentimiento</h3>
          <p style={{ marginBottom: '20px', color: 'var(--gray-600)', fontSize: '0.95rem' }}>
            ¿Deseas arrepentirte de tu registro y eliminar tu cuenta de local permanentemente de Wepi? <br/>
            <strong>Esta acción eliminará todos tus productos y datos.</strong>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              className="btn btn-primary" 
              style={{ background: 'var(--red-600)' }} 
              disabled={deleting}
              onClick={async () => {
                if (!restaurant?.id) {
                  toast.error("Debes iniciar sesión para eliminar tu cuenta.");
                  setShowRegretModal(false);
                  return;
                }
                setDeleting(true);
                try {
                  await api.deleteLocalAccount(restaurant.id);
                  toast.success("Cuenta de local eliminada.");
                  logoutRestaurant();
                  window.location.href = "/";
                } catch (e) {
                  toast.error("No se pudo eliminar la cuenta. Verifica que no tengas deudas o pedidos pendientes.");
                } finally {
                  setDeleting(false);
                  setShowRegretModal(false);
                }
              }}
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar mi local'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowRegretModal(false)}>Cancelar</button>
          </div>
        </div>
      </div>
    )
  );

  // ─── Modal Términos y Condiciones ───
  const renderTermsModal = () => (
    showTerms && (
      <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowTerms(false)}>
        <div className="modal-box animate-fade-in" style={{ maxWidth: '500px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'white', padding: '24px', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
          <h4 style={{ color: 'var(--red-600)', marginBottom: '16px', fontSize: '1.2rem' }}>Términos y Condiciones para Locales</h4>
          <div style={{ fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.5, overflowY: 'auto', paddingRight: '10px', textAlign: 'left', flex: 1 }}>
            <h5 style={{ color: 'red', marginTop: 0 }}>📄 2. COMERCIOS – TÉRMINOS Y CONDICIONES</h5>
            <p><strong>1. Relación</strong></p>
            <p>El comercio utiliza Wepi como plataforma de visibilidad y gestión de pedidos. No existe relación societaria ni laboral.</p>
            <p><strong>2. Calidad</strong></p>
            <p>El local es el único responsable por el estado, higiene y veracidad de los productos entregados.</p>
            <p><strong>3. Gestión de Pedidos</strong></p>
            <p>El comercio debe mantener su menú actualizado y responder a los pedidos en tiempo y forma.</p>
            <p><strong>4. Comisiones</strong></p>
            <p>Wepi percibirá una comisión acordada sobre las ventas realizadas a través de la plataforma.</p>
            <p><strong>5. Cancelaciones</strong></p>
            <p>El comercio debe informar inmediatamente si no puede cumplir con un pedido aceptado.</p>
            <hr style={{ margin: '15px 0', borderColor: '#eee' }} />
            <h5 style={{ color: 'red' }}>🔒 COMERCIOS – POLÍTICA DE PRIVACIDAD</h5>
            <p><strong>Uso de Datos:</strong></p>
            <p>Recolectamos datos del comercio, ventas, productos y métricas de desempeño para mejorar el servicio y facilitar la facturación.</p>
          </div>
          <button className="btn btn-secondary btn-full" onClick={() => setShowTerms(false)} style={{ marginTop: 16 }}>Cerrar</button>
        </div>
      </div>
    )
  );

  React.useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);
  }, []);


  // Location State
  const [showAddressSelector, setShowAddressSelector] = React.useState(false);
  const [profileAddress, setProfileAddress] = React.useState('');
  const [profileLat, setProfileLat] = React.useState(null);
  const [profileLng, setProfileLng] = React.useState(null);

  const pollingRef = React.useRef(null);
  const previousOrdersRef = React.useRef([]);
  const localOpenRef = React.useRef(false);

  const playAlertSound = () => {
    try {
      api.playNotificationSound();
    } catch (e) {}
  };

  const loadRepartidoresStatus = React.useCallback(async () => {
    try {
      const r = await api.checkActiveRepartidores();
      setHasRepartidores(r.hasActive);
    } catch (err) {
      console.error("Error checking drivers:", err);
    }
  }, []);

  const loadEstado = React.useCallback(async () => {
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

  const loadProfile = React.useCallback(async () => {
    if (!restaurant) return;
    try {
      const d = await api.getPerfilLocal(restaurant.id);
      if (d.success) {
        setProfileData(d);
        setProfileAddress(d.direccion || '');
        setProfileLat(d.lat);
        setProfileLng(d.lng);
        // Sync email confirmation state with context
        if (d.email_confirmado !== restaurant.emailConfirmado) {
          loginAsRestaurant({ localId: restaurant.id, emailConfirmado: d.email_confirmado });
        }
      }
    } catch {}
  }, [restaurant]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mpoauth = params.get('mpoauth');
    if (mpoauth === 'success') {
      toast.success('¡Mercado Pago vinculado con éxito!', { icon: '💳', duration: 5000 });
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
      loadProfile(); // Refrescar datos para mostrar el badge
    } else if (mpoauth === 'error') {
      const msg = params.get('message');
      toast.error(`Error al vincular Mercado Pago: ${msg || 'Error desconocido'}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [loadProfile]);

  /* ─── Modo Automático ─── */
  const estaDentroDeHorario = React.useCallback((apertura, cierre, diasApertura, apertura2, cierre2) => {
    if (!apertura || !cierre) return false;
    
    // Verificar días de apertura si existen
    if (diasApertura && Array.isArray(diasApertura) && diasApertura.length > 0) {
      const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const currentDayName = daysMap[new Date().getDay()];
      
      const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedDays = diasApertura.map(normalize);
      const normalizedCurrentDay = normalize(currentDayName);
      
      if (!normalizedDays.includes(normalizedCurrentDay)) {
        return false;
      }
    }

    const checkRange = (start, end) => {
      if (!start || !end) return false;
      const [hA, mA] = start.split(':').map(Number);
      const [hC, mC] = end.split(':').map(Number);
      const minApertura = hA * 60 + mA;
      const minCierre = hC * 60 + mC;
      const now = new Date();
      const current = now.getHours() * 60 + now.getMinutes();

      if (minApertura < minCierre) {
        return current >= minApertura && current <= minCierre;
      } else {
        return current >= minApertura || current <= minCierre;
      }
    };

    let inside = checkRange(apertura, cierre);
    if (!inside && apertura2 && cierre2) {
      inside = checkRange(apertura2, cierre2);
    }
    
    return inside;
  }, []);

  const verificarEstadoAutomatico = React.useCallback(() => {
    const shouldBeOpen = estaDentroDeHorario(
      profileData.horario_apertura, profileData.horario_cierre, 
      profileData.dias_apertura,
      profileData.horario_apertura2, profileData.horario_cierre2
    );
    
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

  const loadMenu = React.useCallback(async () => {
    if (!restaurant) return;
    setMenuLoading(true);
    try {
      const items = await api.getMenuByLocalId(restaurant.id);
      const menuArray = Array.isArray(items) ? items : [];
      setMenuItems(menuArray);

      // Check for stock confirmation (Only for Panadería)
      if (profileData?.rubro === 'Panadería') {
        const baseItems = menuArray.filter(i => i.maneja_stock && !i.stock_base_id);
        const today = new Date().toLocaleDateString('es-AR');
        
        const pending = baseItems.filter(i => {
          if (!i.ultima_confirmacion_stock) return true;
          const lastDate = new Date(i.ultima_confirmacion_stock).toLocaleDateString('es-AR');
          return lastDate !== today;
        });

        if (pending.length > 0) {
          setStockToConfirm(pending);
          setNeedsStockConfirmation(true);
        } else {
          setNeedsStockConfirmation(false);
        }
      }
    } catch (err) { 
      console.error(err);
      toast.error('Error al cargar menú'); 
    }
    setMenuLoading(false);
  }, [restaurant, profileData?.rubro]);

  const handleConfirmDailyStock = async (updates) => {
    try {
      setItemLoading(true);
      const today = new Date().toISOString();
      
      const promises = Object.entries(updates).map(([id, stock]) => 
        api.updateMenuItem({ itemId: id, stock_actual: parseInt(stock), ultima_confirmacion_stock: today })
      );

      await Promise.all(promises);
      toast.success('¡Stock confirmado para hoy!');
      setNeedsStockConfirmation(false);
      loadMenu();
    } catch {
      toast.error('Error al confirmar stock');
    } finally {
      setItemLoading(false);
    }
  };

  const loadOrders = React.useCallback(async (silent = false) => {
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
          repartidorNombre: resGeneral.repartidorNombre,
          repartidorTelefono: resGeneral.repartidorTelefono,
          localId: p[2],
          totalLocal: resItems.reduce((acc, item) => acc + (Number(item[7]) || 0), 0),
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
  React.useEffect(() => {
    if (!restaurant) return;
    loadEstado();
    loadProfile();
    loadOrders();
    loadPlanInfo();

    // Sync Edit Item to Burger States
    if (editItem && view === 'addItem') {
      const cat = editItem.categoria;
      setItemCategory(cat || '');
      if (cat === 'Hamburguesas' || cat === 'Combos') {
        try {
          const cfg = typeof editItem.variantes === 'string' ? JSON.parse(editItem.variantes) : (editItem.variantes || {});
          setBurgerVariants(cfg.variants?.length > 0 ? cfg.variants : [{ nombre: '', precio: '' }]);
          setBurgerExtras(cfg.extras?.length > 0 ? cfg.extras : [{ nombre: '', precio: '' }]);
          setBurgerOfferPapas(!!cfg.con_papas);
          setBurgerPrecioPapas(cfg.precio_papas || '');
        } catch (e) {
          setBurgerVariants([{ nombre: '', precio: '' }]);
          setBurgerExtras([{ nombre: '', precio: '' }]);
          setBurgerOfferPapas(false);
          setBurgerPrecioPapas('');
        }
      } else {
        setBurgerVariants([{ nombre: '', precio: '' }]);
        setBurgerExtras([{ nombre: '', precio: '' }]);
        setBurgerOfferPapas(false);
        setBurgerPrecioPapas('');
      }
    } else if (view === 'addItem' && !editItem) {
        setItemCategory('');
        setBurgerVariants([{ nombre: '', precio: '' }]);
        setBurgerExtras([{ nombre: '', precio: '' }]);
        setBurgerOfferPapas(false);
        setBurgerPrecioPapas('');
    }

    // ─── Sync OneSignal ID ───
    if (restaurant && window.OneSignalDeferred) {
      window.OneSignalDeferred.push(async (OneSignal) => {
        try {
          const updateStatus = () => {
            const perm = OneSignal.Notifications.permission;
            setNotificationStatus(perm ? 'granted' : (OneSignal.Notifications.permissionNative === 'denied' ? 'denied' : 'default'));
          };
          updateStatus();

          const currentSubscription = OneSignal.User.PushSubscription;
          if (currentSubscription.id) {
            await api.localUpdateOneSignalId(restaurant.id, currentSubscription.id);
          }

          OneSignal.Notifications.addEventListener("permissionChange", (permission) => {
            updateStatus();
          });

          OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
            const newId = event.current.id;
            if (newId) {
              await api.localUpdateOneSignalId(restaurant.id, newId);
            }
          });

          if (!isIOS && OneSignal.Notifications.permissionNative === 'default' && localOpen) {
            await OneSignal.Notifications.requestPermission();
          }
        } catch (err) {
          console.error("❌ OneSignal Sync Error:", err);
        }
      });
    }

    // Check if tutorial was already seen
    const hasSeenTutorial = localStorage.getItem(`tutorial_seen_${restaurant.id}`);
    if (!hasSeenTutorial) {
      setShowTutorial(true);
      setTutorialStep(1);
    }
    
    const handleFocus = () => loadOrders(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollingRef.current);
      window.removeEventListener('focus', handleFocus);
    };
  }, [restaurant, loadEstado, loadProfile, loadOrders, editItem, view, localOpen, isIOS]);

  // Polling
  React.useEffect(() => {
    if (!restaurant) return;
    loadRepartidoresStatus();
    pollingRef.current = setInterval(() => {
      loadOrders(true);
      loadRepartidoresStatus();
    }, 25000);
    return () => clearInterval(pollingRef.current);
  }, [restaurant, loadOrders, loadRepartidoresStatus]);

  // Modo Automatico Auto-update
  React.useEffect(() => {
    if (!profileData?.modo_automatico) return;
    
    verificarEstadoAutomatico(); // Check immediately
    
    const intervalId = setInterval(() => {
      verificarEstadoAutomatico();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [profileData?.modo_automatico, profileData?.horario_apertura, profileData?.horario_cierre, verificarEstadoAutomatico]);

  // Click outside to close dropdowns
  React.useEffect(() => {
    if (!profileMenuOpen && !addMenuOpen) return;
    const handleClickOutside = () => {
      setProfileMenuOpen(false);
      setAddMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [profileMenuOpen, addMenuOpen]);
  
  const loadPlanInfo = async () => {
    if (!restaurant) return;
    try {
      const info = await api.getPlanInfo(restaurant.id);
      if (info.success) {
        console.log("Plan Info Loaded:", info);
        setPlanInfo(info);
      }
      const allPlanes = await api.getDisponibilidadPlanes();
      setAvailablePlans(allPlanes);
    } catch (e) {
      console.error("Error loading plan info:", e);
    }
  };

  const handleSuscripPlan = async (plan) => {
    // Si el plan no es el básico, redirigir a WhatsApp
    if (plan.nombre !== 'Básico') {
      const message = `Hola! Me gustaría solicitar el cambio al plan ${plan.nombre} para mi local: ${restaurant?.nombre || 'Mi Local'}`;
      const waUrl = `https://wa.me/5493756543610?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
      return;
    }

    try {
      setAuthLoading(true);
      await api.suscribirAPlan(restaurant.id, plan.id);
      toast.success('¡Plan actualizado! Los cambios se verán reflejados en breve.');
      loadPlanInfo();
    } catch (err) {
      toast.error('Error al cambiar de plan: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };


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

  const loadSabores = React.useCallback(async () => {
    if (!restaurant) return;
    setSaboresLoading(true);
    setAdicionalesLoading(true);
    try {
      const [sabs, ads] = await Promise.all([
        api.getSaboresByLocal(restaurant.id),
        api.getAdicionalesByLocal(restaurant.id)
      ]);
      setSabores(sabs);
      setAdicionales(ads);
    } catch { toast.error('Error al cargar datos de helados'); }
    setSaboresLoading(false);
    setAdicionalesLoading(false);
  }, [restaurant]);

  const handleAddSabor = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nombre = fd.get('nombre').trim();
    const tipo = fd.get('tipo') || 'Sabor';
    if (!nombre) return;
    try {
      await api.addSabor(restaurant.id, nombre, tipo);
      toast.success(`${tipo} agregado`);
      e.target.reset();
      loadSabores();
    } catch { toast.error('Error al agregar'); }
  };

  const handleAddAdicional = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nombre = fd.get('nombre').trim();
    const precio = fd.get('precio');
    if (!nombre || !precio) return;
    try {
      await api.addAdicional(restaurant.id, nombre, precio);
      toast.success('Adicional agregado');
      e.target.reset();
      loadSabores();
    } catch { toast.error('Error al agregar adicional'); }
  };

  const handleToggleAdicionalDisp = async (id, current) => {
    try {
      await api.updateAdicionalDisponibilidad(id, !current);
      setAdicionales(prev => prev.map(a => a.id === id ? { ...a, disponible: !current } : a));
    } catch { toast.error('Error'); }
  };

  const handleDeleteAdicional = async (id) => {
    if (!confirm('¿Eliminar este adicional?')) return;
    try {
      await api.deleteAdicional(id);
      toast.success('Adicional eliminado');
      loadSabores();
    } catch { toast.error('Error al eliminar'); }
  };

  const handleToggleSaborDisp = async (id, current) => {
    try {
      await api.updateSaborDisponibilidad(id, !current);
      setSabores(prev => prev.map(s => s.id === id ? { ...s, disponible: !current } : s));
    } catch { toast.error('Error'); }
  };

  const handleDeleteSabor = async (id) => {
    if (!confirm('¿Eliminar este sabor?')) return;
    try {
      await api.deleteSabor(id);
      toast.success('Sabor eliminado');
      loadSabores();
    } catch { toast.error('Error al eliminar'); }
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
      if (d.success && d.localId) { loginAsRestaurant({ localId: d.localId, emailConfirmado: d.emailConfirmado }); toast.success('¡Bienvenido!'); }
      else toast.error('Credenciales incorrectas');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email');
    if (!isValidEmail(email)) { toast.error('Ingresá un email válido'); return; }
    setAuthLoading(true);
    try {
      await api.registerLocal(
        fd.get('nombre'), fd.get('direccion'), email, fd.get('password'),
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted')
      );
      toast.success('¡Local registrado! Iniciá sesión.');
      setAuthEmail(email);
      setAuthView('login');
    } catch { toast.error('Error al registrar'); }
    setAuthLoading(false);
  };

  const handleResendConfirmationService = async () => {
    if (!profileData?.email) {
      toast.error('No se encontró el email en tu perfil');
      return;
    }
    const loading = toast.loading('Reenviando email...');
    try {
      const res = await api.reenviarEmailConfirmacion(profileData.email, 'local');
      if (res.success) toast.success('¡Email reenviado! Revisa tu bandeja de entrada.', { id: loading });
      else toast.error(res.error || 'Error al reenviar', { id: loading });
    } catch { toast.error('Error de conexión', { id: loading }); }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const file = fd.get('foto');
    setItemLoading(true);
    try {
      let imgUrl = '';
      if (file && file.size > 0) imgUrl = await api.uploadImage(file);
      let precioVal = fd.get('precio');
      let variantesVal = fd.get('variantes');
      
      if (fd.get('categoria') === 'Helados') {
        const iceCreamConfig = {
          es_helado: true,
          precios: {
            '1/4kg': { precio: fd.get('p_14'), max: parseInt(fd.get('m_14')) || 3 },
            '1/2kg': { precio: fd.get('p_12'), max: parseInt(fd.get('m_12')) || 3 },
            '1kg': { precio: fd.get('p_1'), max: parseInt(fd.get('m_1')) || 4 }
          }
        };
        variantesVal = JSON.stringify(iceCreamConfig);
        precioVal = fd.get('p_14');
      } else if (fd.get('categoria') === 'Hamburguesas' || fd.get('categoria') === 'Combos' || fd.get('categoria') === 'Panchos') {
        const advancedConfig = {
          es_hamburguesa: fd.get('categoria') === 'Hamburguesas',
          es_combo: fd.get('categoria') === 'Combos',
          es_pancho: fd.get('categoria') === 'Panchos',
          variants: burgerVariants.filter(v => v.nombre.trim() !== ''),
          extras: burgerExtras.filter(e => e.nombre.trim() !== ''),
          con_papas: burgerOfferPapas,
          precio_papas: parseFloat(burgerPrecioPapas) || 0
        };
        variantesVal = JSON.stringify(advancedConfig);
      }

      const data = {
        localId: restaurant.id,
        nombre: fd.get('nombre'), categoria: fd.get('categoria'),
        descripcion: fd.get('descripcion'), precio: precioVal,
        descuento: fd.get('descuento') ? parseFloat(fd.get('descuento')) : 0,
        disponibilidad: fd.get('disponibilidad') === 'true',
        tamano_porcion: fd.get('tamano_porcion'), variantes: variantesVal,
        tiempo_preparacion: fd.get('tiempo_preparacion'),
        imagen_url: imgUrl,
        // Stock management fields
        maneja_stock: fd.get('maneja_stock') === 'on',
        stock_actual: parseInt(fd.get('stock_actual')) || 0,
        stock_minimo: parseInt(fd.get('stock_minimo')) || 10,
        unidades_por_venta: parseInt(fd.get('unidades_por_venta')) || 1,
        stock_base_id: fd.get('stock_base_id') || null,
      };
      if (editItem) {
        data.itemId = editItem.id;
        await api.updateMenuItem(data);
      } else {
        await api.addMenuItem(data);
      }
      const itemTerm = (profileData?.rubro === 'Market' || profileData?.rubro === 'Farmacia') ? 'Artículo' : 'Plato';
      toast.success(editItem ? `${itemTerm} actualizado` : `${itemTerm} agregado`);
      setEditItem(null);
      setIsBaseProductMode(false);
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
    try {
      await api.updateMenuItemAvailability(id, !current);
      setMenuItems(menuItems.map(m => m.id === id ? { ...m, disponibilidad: !current } : m));
    } catch (e) { toast.error('Error al actualizar disponibilidad'); }
  };

  const handleQuickDiscount = async (id, val) => {
    try {
      const discount = parseFloat(val) || 0;
      await api.updateMenuItemDiscount(id, discount);
      setMenuItems(menuItems.map(m => m.id === id ? { ...m, descuento: discount } : m));
      toast.success('Descuento actualizado', { id: `quick-disc-${id}` });
    } catch (e) { toast.error('Error al actualizar descuento'); }
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

      const statusMap = {
        'Aceptado': 'En preparación',
        'Listo': 'Listos',
        'Entregado': 'Ventas',
        'Rechazado': 'Rechazados'
      };
      const nextTab = statusMap[action] || action;
      toast.success(`Pedido marcado como ${action}. El pedido se movió a ${nextTab}`);
      loadOrders();
    } catch { toast.error('Error al actualizar'); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const file = fd.get('foto');
    const email = fd.get('email');
    if (email && !isValidEmail(email)) { toast.error('Ingresá un email válido'); return; }
    
    try {
      let fotoUrl = '';
      if (file && file.size > 0) fotoUrl = await api.uploadImage(file);
      
      const params = { localId: restaurant.id };
      if (fd.has('nombre')) params.nombre = fd.get('nombre');
      if (fd.has('email')) params.email = email;
      
      // Manejo de Dirección
      if (fd.has('direccion') || fd.has('update_address')) {
        params.direccion = profileAddress;
        params.lat = profileLat;
        params.lng = profileLng;
      }

      // Manejo de Descuentos
      if (fd.has('descuento_general')) {
        params.descuento_general = parseFloat(fd.get('descuento_general')) || 0;
        params.categoria_descuento = fd.get('categoria_descuento') || '';
        const discountDays = [];
        ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(day => {
          if (fd.get(`desc_${day}`) === 'on') discountDays.push(day);
        });
        params.dias_descuento = discountDays;
      }
      
      const pass = fd.get('password');
      if (pass) params.password = pass;
      if (fotoUrl) params.foto_url = fotoUrl;

      // Compatibilidad con campos heredados
      if (fd.has('horario_apertura')) params.horario_apertura = fd.get('horario_apertura');
      if (fd.has('horario_cierre')) params.horario_cierre = fd.get('horario_cierre');
      if (fd.has('horario_apertura2')) params.horario_apertura2 = fd.get('horario_apertura2');
      if (fd.has('horario_cierre2')) params.horario_cierre2 = fd.get('horario_cierre2');
      if (fd.has('modo_automatico')) params.modo_automatico = fd.get('modo_automatico') === 'true';

      const success = await api.updatePerfilLocal(params);
      if (success) {
        toast.success('Perfil actualizado correctamente');
        setProfileData(prev => ({ ...prev, ...params }));
        if (fd.has('descuento_general')) loadMenu();
      }
    } catch { toast.error('Error al guardar perfil'); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const selectedDays = [];
    
    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(day => {
      if (fd.get(`day_${day}`) === 'on') selectedDays.push(day);
    });

    try {
      const params = {
        localId: restaurant.id, 
        horario_apertura: fd.get('horario_apertura'),
        horario_cierre: fd.get('horario_cierre'),
        horario_apertura2: fd.get('horario_apertura2'),
        horario_cierre2: fd.get('horario_cierre2'),
        modo_automatico: fd.get('modo_automatico') === 'true',
        dias_apertura: selectedDays,
        acepta_retiro: fd.get('acepta_retiro') === 'on',
        acepta_envio: fd.get('acepta_envio') === 'on'
      };

      const success = await api.updatePerfilLocal(params);
      if (success) {
        toast.success('Configuración actualizada correctamente');
        setProfileData(prev => ({ ...prev, ...params }));
      }
    } catch { toast.error('Error al guardar configuración'); }
  };

  const handleAddressConfirm = (data) => {
    setProfileAddress(data.address);
    setProfileLat(data.lat);
    setProfileLng(data.lng);
    setShowAddressSelector(false);
  };

  // ─── Tutorial Mock Data logic ───
  const tutorialSampleDish = {
    id: 'sample-dish-1',
    nombre: 'Hamburguesa Wepi (Muestra)',
    categoria: 'Hamburguesas',
    descripcion: 'Doble carne, mucho cheddar y bacon crocante.',
    precio: 4500,
    disponibilidad: true,
    imagen_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=300'
  };

  const tutorialSampleOrder = {
    idPedidoLocal: 'sample-order-1',
    idPedido: 'SAMPLE-1',
    estadoActual: tutorialSampleOrderState,
    items: [[null, null, 'sample-dish-1', 1, 'Hamburguesa Wepi (Muestra)', '', 1, 4500]],
    direccion: 'Calle Falsa 123 (Muestra)',
    observaciones: 'Sin cebolla por favor',
    metodoPago: 'Efectivo',
    tipoEntrega: 'Delivery',
    emailCliente: 'cliente@ejemplo.com',
    nombreCliente: 'Juan Pérez (Muestra)',
    fecha: new Date().toISOString(),
    numConfirmacion: '1234',
    repartidorId: null,
    localId: restaurant?.id,
    totalLocal: 4500,
  };

  const finishTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem(`tutorial_seen_${restaurant?.id}`, 'true');
    setView('orders');
  };

  const handleTutorialNext = () => {
    if (tutorialStep === 1) {
      setTutorialStep(2);
    } else if (tutorialStep === 2) {
      setView('menu');
      setTutorialStep(3);
    } else if (tutorialStep === 3) {
      setView('orders');
      setCurrentTab('pendientes');
      playAlertSound();
      setTutorialStep(4);
    } else if (tutorialStep === 4) {
      setTutorialStep(5);
    } else {
      finishTutorial();
    }
  };

  const handleTutorialPrev = () => {
    if (tutorialStep === 2) setTutorialStep(1);
    else if (tutorialStep === 3) { setView('orders'); setTutorialStep(2); }
    else if (tutorialStep === 4) { setView('menu'); setTutorialStep(3); }
    else if (tutorialStep === 5) { setTutorialStep(4); }
  };

  // Categories for select
  const categories = [...new Set(menuItems.map(i => i.categoria).filter(Boolean))].sort();
  const filteredMenu = menuItems.filter(i => {
    const nameOk = !menuFilter || i.nombre.toLowerCase().includes(menuFilter.toLowerCase());
    const catOk = !menuCatFilter || i.categoria === menuCatFilter;
    return nameOk && catOk;
  });

  const finalMenu = showTutorial && view === 'menu' ? [tutorialSampleDish, ...filteredMenu] : filteredMenu;

  const processOrders = orders.filter(o => ['Pendiente', 'Confirmado', 'Aceptado', 'Listo'].includes(o.estadoActual));
  // ─── Renderizado de Planes y Niveles ───
  const renderPlansView = () => {
    if (!planInfo) return <div className="loading-state"><div className="spinner" /> Cargando info de planes...</div>;
    const { plan_nombre, nivel_actual, comision_actual, metricas_mes, proximo_nivel } = planInfo;

    return (
      <section className="animate-fade-in" style={{ paddingBottom: '40px' }}>
        <div className="plans-hero card" style={{ 
          background: 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)', 
          color: 'white', padding: '32px', borderRadius: '24px', marginBottom: '32px',
          boxShadow: '0 10px 25px rgba(198, 40, 40, 0.2)', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '8px', fontWeight: 800 }}>Tu Crecimiento</h2>
            <p style={{ opacity: 0.9, fontSize: '1.1rem' }}>Gestioná tu visibilidad y niveles de comisión</p>
            
            <div className="plans-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginTop: '32px' }}>
              <div className="plan-stat-card" style={{ background: 'rgba(255,255,255,0.15)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                <span className="stat-label" style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Nivel Actual</span>
                <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>🚀 {getLevelName(nivel_actual)}</span>
              </div>
              <div className="plan-stat-card" style={{ background: 'rgba(255,255,255,0.15)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                <span className="stat-label" style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Comisión</span>
                <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{comision_actual}%</span>
              </div>
              <div className="plan-stat-card" style={{ background: 'rgba(255,255,255,0.15)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                <span className="stat-label" style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Ventas (30d)</span>
                <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{metricas_mes.pedidos}</span>
              </div>
            </div>
          </div>
          {/* Círculos decorativos */}
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: '-30px', left: '10%', width: '100px', height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
        </div>

        <div className="card" style={{ padding: '32px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.8rem' }}>🌟</span> Planes de Visibilidad
          </h3>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Tu plan de visibilidad determina qué tan arriba apareces en la aplicación y qué beneficios publicitarios tienes.
          </p>
          <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '32px' }}>
            {availablePlans.map(plan => (
              <div key={plan.id} className={`plan-select-card card ${plan.nombre === plan_nombre ? 'current' : ''}`} style={{ 
                padding: '24px 16px', borderRadius: '20px', border: plan.nombre === plan_nombre ? '2px solid #c62828' : '1px solid #e2e8f0',
                position: 'relative', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease',
                background: '#fff', minHeight: '100%'
              }}>
                {plan.nombre === plan_nombre && (
                  <div className="current-label" style={{ 
                    position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                    background: '#c62828', color: 'white', padding: '4px 16px', borderRadius: '20px',
                    fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1px'
                  }}>ACTUAL</div>
                )}
                
                {plan.nombre === 'Destacado' && (
                  <img src="https://i.postimg.cc/50W06p4z/descarga-(31).png" alt="Icono Destacado" style={{ height: '40px', marginBottom: '12px', objectFit: 'contain' }} />
                )}
                {plan.nombre === 'Recomendado' && (
                  <img src="https://i.postimg.cc/K8dcHQg5/descarga-(31)-(4).png" alt="Icono Recomendado" style={{ height: '40px', marginBottom: '12px', objectFit: 'contain' }} />
                )}

                <h4 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{plan.nombre}</h4>
                <p className="plan-price" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginBottom: '24px' }}>
                  ${plan.precio_mensual.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: '#64748b' }}>/ mes</span>
                </p>
                
                <ul className="plan-advantages" style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', textAlign: 'left', flex: 1 }}>
                  {(planBenefits[plan.nombre] || []).map((benefit, i) => (
                    <li key={i} style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '12px', display: 'flex', gap: '10px' }}>
                      <span style={{ color: '#059669', fontWeight: 'bold' }}>✓</span> {benefit}
                    </li>
                  ))}
                </ul>

                {plan.nombre !== plan_nombre ? (
                  <button className="btn btn-primary btn-full" onClick={() => handleSuscripPlan(plan)} style={{ padding: '12px', borderRadius: '12px', fontWeight: 700 }}>Elegir {plan.nombre}</button>
                ) : (
                  <button className="btn btn-secondary btn-full" disabled style={{ padding: '12px', borderRadius: '12px', opacity: 0.7, background: '#f1f5f9', color: '#64748b' }}>Plan Activo</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tabla de Referencia de Comisiones */}
        <div style={{ marginTop: '48px', padding: '32px', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '1.2rem' }}>Escala de Comisiones por Ventas</h4>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '24px' }}>
            Las comisiones se ajustan dinámicamente según tu volumen de ventas en los últimos 30 días.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {[
              { n: 'Despegue', c: '15%', t: '0+' },
              { n: 'Crecimiento', c: '12%', t: '15+' },
              { n: 'Experto', c: '10%', t: '30+' },
              { n: 'Nivel Pro', c: '8%', t: '50+' },
            ].map((tier, i) => (
              <div key={i} style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{tier.n}</p>
                <p style={{ margin: '8px 0', fontSize: '1.5rem', fontWeight: 800, color: '#c62828' }}>{tier.c}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>{tier.t} ventas / 30d</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const finishedOrders = orders.filter(o => o.estadoActual === 'Entregado');
  
  const pendientesOrders = processOrders.filter(o => o.estadoActual === 'Pendiente' || o.estadoActual === 'Confirmado').sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const preparacionOrders = processOrders.filter(o => o.estadoActual === 'Aceptado');
  const listosOrders = processOrders.filter(o => o.estadoActual === 'Listo');

  const currentTabOrders = (currentTab === 'pendientes' ? pendientesOrders :
                            currentTab === 'preparacion' ? preparacionOrders :
                            listosOrders).filter(o => 
                              !orderSearch || o.idPedido.toLowerCase().includes(orderSearch.toLowerCase())
                            );

  const finalOrders = (() => {
    if (!showTutorial || view !== 'orders') return currentTabOrders;
    
    const tabToState = {
      'pendientes': 'Pendiente',
      'preparacion': 'Aceptado',
      'listos': 'Listo'
    };
    
    if (tutorialSampleOrder.estadoActual === tabToState[currentTab]) {
      return [tutorialSampleOrder, ...currentTabOrders];
    }
    return currentTabOrders;
  })();

  // ─── Auth Screen ───
  if (!restaurant) return (
    <div className="rd-page">
      <header className="rd-header">
        <Link to="/">
          <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" className="rd-logo" />
        </Link>
        <h1>Panel de Gestión</h1>
      </header>
      <main className="rd-main">
        <div className="rd-auth-card card animate-fade-in" key={authView}>
          <div className="card-body">
            <h2>Acceso Local</h2>
            <div className="rd-auth-tabs">
              <button className={`btn ${authView === 'login' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setAuthView('login'); setShowPassword(false); }}>Iniciar Sesión</button>
              <button className={`btn ${authView === 'register' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setAuthView('register'); setShowPassword(false); }}>Registrar Local</button>
            </div>
            {authView === 'login' ? (
              <form onSubmit={handleLogin} className="rd-auth-form">
                <input name="email" type="email" className="form-input" placeholder="Email" defaultValue={authEmail} required autoComplete="username" />
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
                  {authLoading ? <span className="spinner spinner-white" /> : 'Iniciar Sesión'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="rd-auth-form">
                <input name="email" type="email" className="form-input" placeholder="Email (Este será tu usuario)" required autoComplete="username" />
                <input name="nombre" className="form-input" placeholder="Nombre del Local" required autoComplete="organization" />
                <input name="direccion" className="form-input" placeholder="Dirección (calle, número, barrio)" required autoComplete="street-address" />
                <div className="password-container">
                  <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    className="form-input" 
                    placeholder="Contraseña" 
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
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px', textAlign: 'left' }}>
                  {authView === 'register' && (
                    <input type="checkbox" id="terms_accepted" name="terms_accepted" required style={{ width: 'auto', marginTop: '4px' }} />
                  )}
                  <label htmlFor="terms_accepted" style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
                    {authView === 'register' ? (
                      <>
                        Acepto los <button type="button" style={{ background: 'none', border: 'none', color: 'var(--red-500)', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setShowTerms(true)}>Términos y Condiciones y Política de Privacidad</button> para Locales.
                      </>
                    ) : (
                      <span>Términos y Condiciones y Política de Privacidad para Locales.</span>
                    )}
                  </label>
                </div>

                <button type="submit" className="btn btn-success btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Registrar Local'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
      <footer className="footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 20px' }}>
        <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" style={{ height: '50px', objectFit: 'contain' }} />
        <p>© 2026 <strong>Wepi</strong> — Panel de Locales</p>
        <button 
          onClick={() => setShowTerms(true)} 
          style={{ background: 'none', border: 'none', color: 'var(--red-500)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          Ver Términos y Condiciones
        </button>
        <button 
          onClick={() => setShowRegretModal(true)} 
          style={{ background: 'none', border: 'none', color: 'var(--red-600)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem', marginTop: '4px', fontWeight: 'bold' }}
        >
          Botón de Arrepentimiento
        </button>
      </footer>
      {renderTermsModal()}
      {renderRegretModal()}
    </div>
  );

  // ─── Tutorial Overlay ───
  const renderTutorial = () => {
    if (!showTutorial) return null;

    const mascotUrl = "https://i.postimg.cc/76cK0DSH/Gemini-Generated-Image-aqk3geaqk3geaqk3-(2).png";

    const steps = [
      {
        title: "¡Bienvenido a Wepi!",
        text: "Soy tu guía. En este panel gestionarás todo tu negocio de forma simple.",
        position: "bottom-right"
      },
      {
        title: "Cargar nuevo plato",
        text: "Haz click en '+ Añadir' para crear platos. ¡Las buenas fotos atraen más clientes!",
        target: ".rd-nav-btn:nth-child(3)",
      },
      {
        title: "Gestionar tu Menú",
        text: "Aquí ves tus platos. Puedes pausarlos si no tienes stock. Mira este ejemplo de hamburguesa.",
        target: ".rd-menu-item"
      },
      {
        title: "Logística de Pedidos",
        text: tutorialSampleOrderState === 'Pendiente' ? "¡Mira! Tienes un pedido. Dale a 'Aceptar' para empezar a cocinar." :
              tutorialSampleOrderState === 'Aceptado' ? "¡Muy bien! Ahora está en preparación. Cuando termines, dale a 'Listo'." :
              "¡Perfecto! El pedido está listo para ser entregado.",
        target: ".rd-tabs"
      },
      {
        title: "¡Todo listo!",
        text: "Ya dominas lo básico. Encuéntrame en Mi Perfil > Ver tutorial si me necesitas de nuevo.",
        position: "center"
      }
    ];

    const step = steps[tutorialStep - 1];

    return (
      <div className="tutorial-floating-container" style={{
        position: 'fixed', top: '70px', right: '20px', zIndex: 9999,
        maxWidth: '380px', width: '90%', pointerEvents: 'none'
      }}>
        <div className="tutorial-card card animate-fade-in" style={{
          padding: '20px', border: '5px solid var(--red-500)', 
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)', pointerEvents: 'auto',
          background: 'white', position: 'relative', overflow: 'visible',
          borderRadius: '16px'
        }}>
          {/* Avatar Guía */}
          <div style={{
            position: 'absolute', top: '-50px', left: '20px',
            width: '80px', height: '80px', borderRadius: '50%',
            border: '3px solid var(--red-500)', backgroundColor: 'white',
            overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
          }}>
            <img src={mascotUrl} alt="Guía" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          <div style={{ marginTop: '30px' }}>
            <h3 style={{ color: 'var(--red-600)', marginBottom: '8px', fontSize: '1.2rem' }}>
              {step.title}
            </h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--gray-700)', lineHeight: '1.4', marginBottom: '16px' }}>
              {step.text}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-ghost btn-xs" onClick={finishTutorial} style={{ fontSize: '0.75rem' }}>Saltar tutorial</button>
              <div style={{ display: 'flex', gap: '8px' }}>
                {tutorialStep > 1 && tutorialStep !== 4 && (
                  <button className="btn btn-secondary btn-sm" onClick={handleTutorialPrev}>Atrás</button>
                )}
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={handleTutorialNext}
                  disabled={tutorialStep === 4 && tutorialSampleOrderState !== 'Entregado'}
                >
                  {tutorialStep === steps.length ? '¡Empezar!' : 
                   tutorialStep === 4 ? (tutorialSampleOrderState === 'Entregado' ? 'Continuar' : 'Sigue los pasos...') :
                   'Siguiente'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '12px', justifyContent: 'center' }}>
            {steps.map((_, i) => (
              <div key={i} style={{ 
                width: '6px', height: '6px', borderRadius: '50%', 
                background: i === tutorialStep - 1 ? 'var(--red-500)' : '#ddd' 
              }} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderStockModal = () => {
    if (!showStockModal) return null;

    return (
      <div className="modal-overlay animate-fade-in" style={{ zIndex: 10001 }}>
        <div className="modal-content animate-slide-up" style={{ maxWidth: '500px', width: '95%' }}>
          <h2 style={{ color: '#c2410c', marginBottom: 12 }}>🥖 Confirmar Stock del Día</h2>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem', marginBottom: 20 }}>
            Ingresá las unidades frescas disponibles para hoy. Esto evitará que vendas productos que ya no tenés.
          </p>

          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const updates = {};
            stockToConfirm.forEach(item => {
              updates[item.id] = fd.get(`stock_${item.id}`);
            });
            handleConfirmDailyStock(updates);
            setShowStockModal(false);
          }}>
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stockToConfirm.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {item.imagen_url && <img src={item.imagen_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />}
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.nombre}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input 
                      name={`stock_${item.id}`} 
                      type="number" 
                      className="form-input" 
                      style={{ width: 80, marginBottom: 0, textAlign: 'center' }} 
                      defaultValue={item.stock_actual}
                      required 
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>u.</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowStockModal(false)}>Más tarde</button>
              <button type="submit" className="btn btn-primary" style={{ background: '#f97316', borderColor: '#f97316' }} disabled={itemLoading}>
               {itemLoading ? <span className="spinner spinner-white" /> : 'Confirmar Todo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ─── Dashboard ───
  return (
    <div className="rd-page">
      {renderTutorial()}
      {renderStockModal()}
      <header className="rd-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/">
            <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" className="rd-logo" />
          </Link>
        </div>
        
        <h1 className="rd-header-title">
          Panel de Gestión
        </h1>

        <div className="rd-topbar-right" style={{ border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          {profileData?.foto_url && <img src={profileData.foto_url} alt="" className="rd-avatar" />}
          
          <div className="rd-dropdown-container">
            <button 
              className={`btn btn-ghost btn-sm ${view === 'profile' ? 'active' : ''}`} 
              onClick={(e) => { e.stopPropagation(); setProfileMenuOpen(!profileMenuOpen); }}
              style={{ color: 'white' }}
            >
              Mi Perfil ▾
            </button>
            
            {profileMenuOpen && (
              <div className="rd-dropdown-menu animate-fade-in" style={{ right: 0, left: 'auto' }}>
                <button className="rd-dropdown-item" onClick={() => { setView('profile'); setProfileSubView('ventas'); loadOrders(); setProfileMenuOpen(false); }}>
                  💰 Mis Ventas
                </button>
                <button className="rd-dropdown-item" onClick={() => { setView('profile'); setProfileSubView('cobros'); loadCobros(); setProfileMenuOpen(false); }}>
                  🏦 Gestión de Pagos
                </button>
                <button className="rd-dropdown-item" onClick={() => { setView('profile'); setProfileSubView('edit'); loadProfile(); setProfileMenuOpen(false); }}>
                  👤 Editar Perfil
                </button>
                <button className="rd-dropdown-item" onClick={() => { setView('settings'); setProfileSubView('edit'); setProfileMenuOpen(false); }}>
                  ⚙️ Configuración
                </button>
                <button className="rd-dropdown-item" onClick={() => { setShowTutorial(true); setTutorialStep(1); setView('orders'); setProfileMenuOpen(false); }}>
                  📖 Ver tutorial
                </button>
                <div style={{ borderTop: '1px solid var(--gray-100)', marginTop: '8px', paddingTop: '8px' }}>
                  <button className="rd-dropdown-item" style={{ color: 'var(--red-500)' }} onClick={() => { logoutRestaurant(); window.location.reload(); }}>
                    🚪 Salir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="rd-main">
        {restaurant && !restaurant.emailConfirmado && (
          <div className="unconfirmed-banner" style={{
            background: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            margin: '0 16px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
            color: '#874d00'
          }}>
            <span>⚠️ <strong>Email no confirmado:</strong> Por favor confirma tu dirección de correo para operar con normalidad.</span>
            <button 
              className="btn btn-sm" 
              style={{ background: '#faad14', color: '#fff', border: 'none' }}
              onClick={handleResendConfirmationService}
            >
              Reenviar enlace
            </button>
          </div>
        )}

        {notificationStatus === 'denied' && (
          <div className="rd-notification-banner banner-danger animate-fade-in">
            <img src="https://i.postimg.cc/mrfJz5P3/buscamos-repartidores-(8).png" alt="Alert" className="banner-icon" />
            <div className="banner-content">
              <strong>Notificaciones Bloqueadas</strong>
              <p>No recibirás avisos de nuevos pedidos. Habilítalas en la configuración de tu navegador para no perder ventas.</p>
            </div>
          </div>
        )}

        {notificationStatus === 'default' && (
          <div className="rd-notification-banner banner-warning animate-fade-in">
            <img src="https://i.postimg.cc/mrfJz5P3/buscamos-repartidores-(8).png" alt="Alert" className="banner-icon" />
            <div className="banner-content">
              <strong>Habilitar Notificaciones</strong>
              <p>Activá las notificaciones para enterarte al instante cuando recibas un nuevo pedido.</p>
              <button 
                className="btn btn-primary btn-xs" 
                style={{ marginTop: '8px', background: 'var(--red-600)', borderColor: 'var(--red-600)' }}
                onClick={async () => {
                  if (window.OneSignalDeferred) {
                    window.OneSignalDeferred.push(async (OneSignal) => {
                      await OneSignal.Notifications.requestPermission();
                    });
                  }
                }}
              >
                Activar Notificaciones
              </button>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="rd-topbar animate-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="rd-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label className="toggle" onClick={toggleEstado}>
              <input type="checkbox" checked={localOpen} readOnly />
              <span className="toggle-track" />
              <span className="toggle-thumb" />
            </label>
            <span className={`rd-status ${localOpen ? 'open' : ''}`}>{localOpen ? 'Abierto' : 'Cerrado'}</span>
            
          </div>

          {planInfo && (
            <div 
              style={{ 
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #ddd', 
                paddingLeft: '16px', cursor: 'pointer' 
              }}
              onClick={() => setShowGamification(!showGamification)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '80px' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b' }}>VENTAS</span>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--red-600)' }}>{planInfo?.metricas_mes?.pedidos ?? 0}/50</span>
                </div>
                <div style={{ width: '80px', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${Math.min(100, ((planInfo?.metricas_mes?.pedidos || 0) / 50) * 100)}%`, 
                    height: '100%', background: 'var(--red-600)' 
                  }}></div>
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{showGamification ? '▲' : '▼'}</span>
            </div>
          )}
        </div>


        {/* Persistent Alerts for Missing Configs */}
        {profileData && (
          <div className="rd-alerts" style={{ padding: '0 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Alerta de Confirmación Diaria (Solo Panadería) */}
            {needsStockConfirmation && (
              <div style={{ backgroundColor: '#fff7ed', border: '1px solid #ffedd5', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#9a3412', fontWeight: '600' }}>🥖 <strong>Stock del día no confirmado:</strong> Actualizá tus unidades de hoy para evitar ventas sin stock.</span>
                <button className="btn btn-sm" style={{ backgroundColor: '#f97316', color: '#fff', border: 'none' }} onClick={() => setShowStockModal(true)}>Confirmar Ahora</button>
              </div>
            )}

            {/* Alert of low stock items */}
            {profileData?.rubro === 'Panadería' && menuItems.filter(i => i.maneja_stock && !i.stock_base_id && i.stock_actual <= i.stock_minimo).length > 0 && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#991b1b', fontWeight: '500' }}>⚠️ <strong>Stock Bajo:</strong> Hay productos que están alcanzando el límite mínimo.</span>
                <button className="btn btn-sm" style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none' }} onClick={() => setView('menu')}>Ver ítems</button>
              </div>
            )}

            {(!profileData.mp_access_token) && (
              <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#d48800', fontWeight: '500' }}>⚠️ <strong>Mercado Pago desvinculado:</strong> Vinculá tu cuenta para recibir pagos online.</span>
                <button className="btn btn-sm" style={{ backgroundColor: '#faad14', color: '#fff', border: 'none' }} onClick={() => { setView('settings'); setProfileSubView('edit'); }}>Vincular</button>
              </div>
            )}
            {(!profileData.horario_apertura || !profileData.horario_cierre) && (
              <div style={{ backgroundColor: '#fff1f0', border: '1px solid #ffa39e', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#cf1322', fontWeight: '500' }}>⏰ <strong>Horarios sin configurar:</strong> Establecé el horario de cierre de cocina para gestionar pedidos automáticos.</span>
                <button className="btn btn-sm" style={{ backgroundColor: '#ff4d4f', color: '#fff', border: 'none' }} onClick={() => { setView('settings'); setProfileSubView('edit'); }}>Configurar</button>
              </div>
            )}
          </div>
        )}

        {planInfo && showGamification && (
          <div className="gamification-pill card animate-slide-up" onClick={() => setView('plans')} style={{ 
            cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '16px', margin: '0 16px 16px', 
            background: 'linear-gradient(135deg, #fff 0%, #fffafa 100%)', borderLeft: '4px solid #e63946',
            boxShadow: '0 4px 15px rgba(230, 57, 70, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem' }}>💎</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Plan {planInfo?.plan_nombre || 'Visible'}
                    <button className="btn btn-xs" style={{ background: 'var(--red-600)', color: 'white', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '20px', border: 'none', fontWeight: 600 }}>Aumentar Visibilidad</button>
                  </p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--red-600)', fontWeight: 700 }}>Nivel {getLevelName(planInfo?.nivel_actual) || 'Despegue'} • {planInfo?.comision_actual ?? '--'}% comisión</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{planInfo?.metricas_mes?.pedidos ?? 0} pedidos</span>
                <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b' }}>últimos 30 d</p>
              </div>
            </div>

            {/* Barra de Progreso Multi-Nivel */}
            <div style={{ width: '100%', marginTop: '4px' }}>
              <div style={{ position: 'relative', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ 
                  width: `${Math.min(100, ((planInfo?.metricas_mes?.pedidos || 0) / 50) * 100)}%`, 
                  height: '100%', background: 'linear-gradient(90deg, #e63946 0%, #ff4d4f 100%)', 
                  borderRadius: '5px', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' 
                  }}></div>
                
                <div style={{ position: 'absolute', left: '30%', top: 0, width: '2px', height: '100%', background: 'rgba(255,255,255,0.4)' }}></div>
                <div style={{ position: 'absolute', left: '60%', top: 0, width: '2px', height: '100%', background: 'rgba(255,255,255,0.4)' }}></div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span style={{ color: planInfo.nivel_actual >= 1 ? '#e63946' : 'inherit' }}>Despegue</span>
                <span style={{ color: planInfo.nivel_actual >= 2 ? '#e63946' : 'inherit', marginLeft: '10%' }}>Crecimiento</span>
                <span style={{ color: planInfo.nivel_actual >= 3 ? '#e63946' : 'inherit', marginLeft: '10%' }}>Experto</span>
                <span style={{ color: planInfo.nivel_actual >= 4 ? '#e63946' : 'inherit' }}>Nivel Pro</span>
              </div>
            </div>

            {planInfo?.proximo_nivel ? (
              <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#475569', textAlign: 'center' }}>
                Faltan <strong>{planInfo.proximo_nivel.falta_pedidos} pedidos</strong> para llegar a <strong>{planInfo.proximo_nivel.nombre}</strong>. ¡Bajá a <strong>{planInfo.proximo_nivel.comision}%</strong> de comisión!
              </p>
            ) : (
              <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#059669', textAlign: 'center', fontWeight: 700 }}>
                ¡Has alcanzado el máximo nivel! 🏆 Beneficio: {planInfo?.comision_actual ?? '--'}% comisión
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="rd-nav animate-slide-up" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          <button className={`rd-nav-btn ${view === 'orders' ? 'active' : ''}`} onClick={() => { setView('orders'); loadOrders(); }}>
            📋 Pedidos
            {(pendingCount > 0 || (showTutorial && tutorialSampleOrderState === 'Pendiente')) && (
              <span className="rd-nav-badge">
                {pendingCount + (showTutorial && tutorialSampleOrderState === 'Pendiente' ? 1 : 0)}
              </span>
            )}
          </button>
          <button className={`rd-nav-btn ${view === 'menu' ? 'active' : ''}`} onClick={() => { setView('menu'); loadMenu(); }}>📖 Menú</button>
          
        </nav>

        {/* ─── Orders View ─── */}
        {view === 'orders' && (
          <section className="animate-fade-in">
            <div style={{ marginBottom: '16px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="🔍 Buscar por ID de pedido (#...)" 
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
            </div>
            <div className="rd-tabs" style={{ gap: 8 }}>
              <button className={currentTab === 'pendientes' ? 'active' : ''} onClick={() => setCurrentTab('pendientes')} style={{ position: 'relative' }}>
                Pendientes <span className="badge badge-amber" style={{ marginLeft: 6 }}>{pendientesOrders.length + (showTutorial && tutorialSampleOrderState === 'Pendiente' ? 1 : 0)}</span>
              </button>
              <button className={currentTab === 'preparacion' ? 'active' : ''} onClick={() => setCurrentTab('preparacion')} style={{ position: 'relative' }}>
                En Preparación <span className="badge badge-info" style={{ marginLeft: 6 }}>{preparacionOrders.length + (showTutorial && tutorialSampleOrderState === 'Aceptado' ? 1 : 0)}</span>
              </button>
              <button className={currentTab === 'listos' ? 'active' : ''} onClick={() => setCurrentTab('listos')} style={{ position: 'relative' }}>
                Listos <span className="badge badge-blue" style={{ marginLeft: 6 }}>{listosOrders.length + (showTutorial && tutorialSampleOrderState === 'Listo' ? 1 : 0)}</span>
              </button>
            </div>
            {ordersLoading ? (
              <div className="loading-state"><div className="spinner" /> Cargando...</div>
            ) : finalOrders.length === 0 ? (
              <p className="rd-empty">No hay pedidos en esta sección</p>
            ) : finalOrders.map(o => (
              <OrderCard 
                key={o.idPedidoLocal} 
                order={o} 
                onAction={(order, action) => {
                  if (order.idPedidoLocal === 'sample-order-1') {
                    if (action === 'Aceptado') {
                       setTutorialSampleOrderState('Aceptado');
                       setCurrentTab('preparacion');
                       toast.success('¡Pedido aceptado! El pedido se movió a En preparación (Muestra)');
                    } else if (action === 'Listo') {
                       setTutorialSampleOrderState('Listo');
                       setCurrentTab('listos');
                       toast.success('¡Pedido listo! El pedido se movió a Listos (Muestra)');
                    } else if (action === 'Entregado') {
                       setTutorialSampleOrderState('Entregado');
                       toast.success('¡Pedido entregado! El pedido se movió a Ventas (Muestra)');
                       setTutorialStep(5); // Move to next step if in tutorial
                    }
                  } else {
                    handleOrderAction(order, action);
                  }
                }} 
              />
            ))}
          </section>
        )}

        {/* ─── Menu View ─── */}
        {view === 'menu' && (
          <section className="animate-fade-in">
            {/* Header Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                   {/* Dropdown Añadir */}
                   <div style={{ position: 'relative' }}>
                      <button className="btn btn-success" onClick={() => {
                        const needsDropdown = profileData?.rubro === 'Panadería' || profileData?.rubro === 'Heladería';
                        if (needsDropdown) {
                          setMenuAddOpen(!menuAddOpen);
                        } else {
                          setEditItem(null); setItemCategory(''); setItemName(''); setView('addItem'); setIsBaseProductMode(false);
                        }
                      }}>
                        + Añadir { (profileData?.rubro === 'Panadería' || profileData?.rubro === 'Heladería') && '▾' }
                      </button>
                      
                      {menuAddOpen && (
                        <div className="rd-dropdown-menu animate-fade-in" style={{ left: 0, top: '100%', display: 'block', zIndex: 100 }}>
                           <button className="rd-dropdown-item" onClick={() => { setEditItem(null); setItemCategory(''); setItemName(''); setView('addItem'); setIsBaseProductMode(false); setMenuAddOpen(false); }}>
                             {profileData?.rubro === 'Market' || profileData?.rubro === 'Farmacia' ? '📦 Nuevo Artículo' : '🍔 Nuevo Plato'}
                           </button>
                           {(profileData?.rubro === 'Panadería') && (
                             <button className="rd-dropdown-item" onClick={() => { setEditItem(null); setView('addItem'); setItemCategory('Base'); setIsBaseProductMode(true); setMenuAddOpen(false); }}>
                               🍞 Nuevo Producto Base
                             </button>
                           )}
                           {(profileData?.rubro === 'Heladería') && (
                             <button className="rd-dropdown-item" onClick={() => { setView('sabores'); loadSabores(); setMenuAddOpen(false); }}>
                               🍦 Sabores y Adicionales
                             </button>
                           )}
                        </div>
                      )}
                   </div>

                   <button className={`btn ${showDiscountPanel ? 'btn-primary' : 'btn-outline'}`} onClick={() => setShowDiscountPanel(!showDiscountPanel)}>
                     🎁 Descuentos
                   </button>
                </div>

                <div style={{ padding: '8px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>
                   Estado hoy: {(() => {
                     const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
                     const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                     const isPromo = profileData?.dias_descuento?.some(d => normalize(d) === normalize(today));
                     return isPromo ? <span style={{ color: 'var(--red-600)' }}>🔥 PROMO {profileData?.descuento_general}% OFF {profileData?.categoria_descuento ? `en ${profileData.categoria_descuento}` : 'en todo el menú'}</span> : <span style={{ color: 'var(--gray-500)' }}>Sin promo general</span>;
                   })()}
                </div>
            </div>

            {showDiscountPanel && (
              <div className="card card-body animate-slide-up" style={{ marginBottom: 24, border: '1px solid #feb2b2', background: '#fff5f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
                  <div style={{ flex: 1, minWidth: '300px' }}>
                    <h3 style={{ color: 'var(--red-600)', marginBottom: 12, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>🎁 Descuento General del Local</h3>
                    <p style={{ fontSize: '0.85rem', color: '#742a2a', marginBottom: 12 }}>Este descuento se aplica automáticamente a todos tus platos los días seleccionados (excepto a los platos que ya tengan un descuento propio).</p>
                    
                    <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input 
                            name="descuento_general" 
                            type="number" 
                            className="form-input" 
                            style={{ width: '80px', marginBottom: 0 }} 
                            defaultValue={profileData?.descuento_general || 0} 
                          />
                          <span style={{ fontWeight: 700, color: 'var(--red-600)' }}>% OFF</span>
                          <span style={{ fontSize: '0.85rem', color: '#742a2a', marginLeft: '10px' }}>en</span>
                          <select 
                            name="categoria_descuento" 
                            className="form-select" 
                            style={{ width: '180px', marginBottom: 0, marginLeft: '6px' }}
                            defaultValue={profileData?.categoria_descuento || ''}
                          >
                            <option value="">Todo el menú</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <button type="submit" className="btn btn-success btn-sm" style={{ marginLeft: '10px' }}>Guardar Configuración</button>
                       </div>
                       
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => {
                            const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                            const isSelected = profileData?.dias_descuento?.some(d => normalize(d) === normalize(day));
                            return (
                              <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: 'white', padding: '4px 10px', borderRadius: '8px', border: '1px solid #feb2b2', fontSize: '0.8rem', cursor: 'pointer' }}>
                                <input type="checkbox" name={`desc_${day}`} defaultChecked={isSelected} />
                                {day}
                              </label>
                            );
                          })}
                          <button type="submit" className="btn btn-ghost btn-xs" style={{ color: 'var(--red-600)', textDecoration: 'underline' }}>Guardar Días</button>
                       </div>
  
                       {/* Hidden profile fields for handleSaveProfile compatibility */}
                       <div style={{ display: 'none' }}>
                          <input name="nombre" defaultValue={profileData?.nombre} />
                          <input name="email" defaultValue={profileData?.email} />
                          <input name="horario_apertura" defaultValue={profileData?.horario_apertura} />
                          <input name="horario_cierre" defaultValue={profileData?.horario_cierre} />
                          <input name="modo_automatico" defaultValue={profileData?.modo_automatico ? 'true' : 'false'} />
                          <input type="checkbox" name="acepta_retiro" defaultChecked={profileData?.acepta_retiro !== false} />
                          <input type="checkbox" name="acepta_envio" defaultChecked={profileData?.acepta_envio !== false} />
                          {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                            <input key={day} type="checkbox" name={`day_${day}`} defaultChecked={profileData?.dias_apertura?.some(d => d.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === day.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())} />
                          ))}
                       </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
            
            {/* ─── Panel de Stock Rápido (Solo Panadería) ─── */}
            {profileData?.rubro === 'Panadería' && (
              <div className="card animate-fade-in" style={{ marginBottom: 24, padding: '16px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                   <h3 style={{ color: '#c2410c', margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                     📦 Gestión de Stock Rápida
                   </h3>
                   <span style={{ fontSize: '0.75rem', background: '#fff7ed', color: '#c2410c', padding: '4px 8px', borderRadius: '12px', border: '1px solid #ffedd5', fontWeight: 600 }}>
                     Sólo ítems que manejan stock
                   </span>
                </div>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                  gap: '12px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  paddingRight: '4px'
                }}>
                  {menuItems.filter(i => i.maneja_stock).length === 0 ? (
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', textAlign: 'center', gridColumn: '1/-1', padding: '20px' }}>
                      No tenés platos con stock habilitado. Editá un plato para activarlo.
                    </p>
                  ) : (
                    menuItems.filter(i => i.maneja_stock).map(item => (
                      <div key={item.id} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '10px 14px', 
                        background: '#f8fafc', 
                        borderRadius: '10px', 
                        border: '1px solid #e2e8f0' 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                           {item.imagen_url && <img src={item.imagen_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />}
                           <div style={{ minWidth: 0 }}>
                             <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nombre}</p>
                             <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                               {item.stock_base_id ? `Pack (${item.unidades_por_venta} u.)` : 'Producto Base'}
                             </p>
                           </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                           <input 
                             type="number" 
                             className="form-input" 
                             style={{ width: '70px', padding: '6px', fontSize: '0.85rem', marginBottom: 0, textAlign: 'center', background: 'white' }}
                             value={item.stock_actual}
                             onChange={async (e) => {
                               const val = parseInt(e.target.value) || 0;
                               // Optimistic Update
                               setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, stock_actual: val } : m));
                             }}
                             onBlur={async (e) => {
                               const val = parseInt(e.target.value) || 0;
                               try {
                                 await api.updateMenuItem({ itemId: item.id, stock_actual: val });
                                 toast.success(`Stock de ${item.nombre} actualizado`, { id: `stock-upd-${item.id}` });
                               } catch { 
                                 toast.error('Error al actualizar stock'); 
                                 loadMenu(); // Rollback
                               }
                             }}
                           />
                           <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontWeight: 600 }}>u.</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="rd-menu-filters">
              <input className="form-input" placeholder="🔍 Buscar plato..." value={menuFilter} onChange={e => setMenuFilter(e.target.value)} />
              <select className="form-select" value={menuCatFilter} onChange={e => setMenuCatFilter(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {menuLoading ? (
              <div className="loading-state"><div className="spinner" /> Cargando menú...</div>
            ) : finalMenu.length === 0 ? (
              <p className="rd-empty">No hay {profileData?.rubro === 'Market' || profileData?.rubro === 'Farmacia' ? 'artículos' : 'platos'}. ¡Agregá tu primer {profileData?.rubro === 'Market' || profileData?.rubro === 'Farmacia' ? 'artículo' : 'plato'}!</p>
            ) : finalMenu.map(item => (
              <div key={item.id} className="rd-menu-item card">
                {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} className="rd-menu-img" /> :
                  <div className="rd-menu-img-placeholder">Sin foto</div>}
                <div className="rd-menu-info">
                  <div className="rd-menu-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3>{item.nombre}</h3>
                      <p>{item.descripcion || ''}</p>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <span className="badge badge-gray">{item.categoria || 'Sin categoría'}</span>
                        {item.maneja_stock && (
                          <span className={`badge ${item.stock_actual <= item.stock_minimo ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '0.7rem' }}>
                            Stock: {item.stock_actual}
                          </span>
                        )}
                        {item.stock_base_id && (
                          <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>
                            Pack ({item.unidades_por_venta} u.)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right', minWidth: '120px' }}>
                      {(() => {
                         const basePrice = Number(item.precio);
                         const itemDiscountPercent = Number(item.descuento || 0);
                         
                         const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                         const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
                         const isPromoDay = profileData?.dias_descuento?.some(d => normalize(d) === normalize(today));
                         const categoryMatch = !profileData?.categoria_descuento || profileData?.categoria_descuento === item.categoria;
                         const generalDiscountPercent = (isPromoDay && categoryMatch) ? Number(profileData?.descuento_general || 0) : 0;
                         
                         // EXCLUSIVE LOGIC: Item discount OR General discount
                         let finalPrice = basePrice;
                         let hasAnyDiscount = false;

                         if (itemDiscountPercent > 0) {
                           finalPrice = Math.round(basePrice * (1 - itemDiscountPercent / 100));
                           hasAnyDiscount = true;
                         } else if (generalDiscountPercent > 0) {
                           finalPrice = Math.round(basePrice * (1 - generalDiscountPercent / 100));
                           hasAnyDiscount = true;
                         }

                         return (
                           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {hasAnyDiscount && (
                                  <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', fontSize: '0.8rem' }}>${basePrice}</span>
                                )}
                                <span className="rd-menu-price" style={{ color: hasAnyDiscount ? 'var(--red-600)' : 'inherit', fontSize: '1.2rem', fontWeight: 800 }}>${finalPrice}</span>
                             </div>
                             {itemDiscountPercent > 0 && (
                               <span style={{ fontSize: '0.65rem', color: 'var(--red-500)', fontWeight: 700, marginBottom: 2 }}>PROMO PLATO</span>
                             )}
                             {itemDiscountPercent === 0 && generalDiscountPercent > 0 && (
                               <span style={{ fontSize: '0.65rem', color: 'var(--red-500)', fontWeight: 700, marginBottom: 2 }}>PROMO LOCAL</span>
                             )}
                             <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                               <label style={{ fontSize: '0.7rem', color: 'var(--gray-500)', fontWeight: 600 }}>Dcto %:</label>
                               <input 
                                 type="number" 
                                 defaultValue={item.descuento || 0}
                                 className="form-input"
                                 style={{ width: '60px', padding: '4px', fontSize: '0.75rem', marginBottom: 0, textAlign: 'center' }}
                                 onBlur={async (e) => {
                                   const val = parseFloat(e.target.value) || 0;
                                   try {
                                     await api.updateMenuItemDiscount(item.id, val);
                                     toast.success(`Descuento de ${item.nombre} actualizado`);
                                     loadMenu();
                                   } catch { toast.error('Error al actualizar'); }
                                 }}
                               />
                             </div>
                           </div>
                         );
                      })()}
                    </div>
                  </div>
                  <div className="rd-menu-bottom">
                    <label className="toggle" onClick={() => {
                      if (item.categoria === 'Base') {
                        toast.error('Los productos base no pueden marcarse como disponibles/fuera de servicio. Su visibilidad depende del stock real.');
                        return;
                      }
                      handleToggleDisp(item.id, item.disponibilidad);
                    }}>
                      <input type="checkbox" checked={item.disponibilidad === true} readOnly disabled={item.categoria === 'Base'} />
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
              <h2 style={{ color: 'var(--red-600)', marginBottom: 16 }}>
                {isBaseProductMode ? '🍞 Nuevo Producto Base' : (editItem ? (profileData?.rubro === 'Market' || profileData?.rubro === 'Farmacia' ? 'Editar Artículo' : 'Editar Plato') : (profileData?.rubro === 'Market' || profileData?.rubro === 'Farmacia' ? 'Nuevo Artículo' : 'Nuevo Plato'))}
              </h2>
              <form onSubmit={handleSaveItem} className="rd-item-form">
                <div className="rd-form-row">
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input 
                        name="nombre" 
                        className="form-input" 
                        placeholder={profileData?.rubro === 'Market' || profileData?.rubro === 'Farmacia' ? 'Nombre del artículo' : 'Nombre del plato'} 
                        value={editItem ? undefined : itemName}
                        defaultValue={editItem ? editItem.nombre : undefined}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!editItem && itemCategory === 'Combos') {
                            if (!val.toUpperCase().startsWith('COMBO ')) {
                              val = 'COMBO ' + val.replace(/^COMBO\s*/i, '');
                            }
                            if (val.length < 6) val = 'COMBO ';
                          }
                          if (!editItem) setItemName(val);
                        }}
                        required 
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                  <select 
                    name="categoria" 
                    className="form-select" 
                    value={itemCategory || editItem?.categoria || ''} 
                    required 
                    readOnly={isBaseProductMode || editItem?.categoria === 'Base'}
                    disabled={isBaseProductMode || editItem?.categoria === 'Base'}
                    onChange={(e) => setItemCategory(e.target.value)}
                  >
                    <option value="">Categoría</option>
                    {isBaseProductMode || editItem?.categoria === 'Base' ? (
                      <option value="Base">Base (Inventario Interno)</option>
                    ) : (
                      (function() {
                        const rubro = profileData?.rubro || 'Comida Rápida';
                        let cats = [];
                        if (rubro === 'Heladería') cats = ['Helados'];
                        else if (rubro === 'Market') cats = ['Snacks', 'Bebidas', 'Golosinas', 'Almacén', 'Higiene', 'Promos'];
                        else if (rubro === 'Farmacia') cats = ['Medicamentos (venta libre)', 'Higiene', 'Cuidado personal/Belleza', 'Bebés/Maternidad', 'Primeros Auxilios', 'Salud Sexual', 'Promos'];
                        else if (rubro === 'Panadería') cats = ['Pan', 'Facturas', 'Pastelería', 'Galletas', 'Salados', 'Desayuno/Merienda', 'Promos'];
                        else cats = ['Hamburguesas', 'Pizzas', 'Empanadas', 'Panchos', 'Panadería', 'Combos', 'Bebidas'];
                        
                        if (editItem && editItem.categoria && !cats.includes(editItem.categoria)) {
                          cats.push(editItem.categoria);
                        }
                        return cats.map(cat => <option key={cat} value={cat}>{cat}</option>);
                      })()
                    )}
                  </select>
                  {(isBaseProductMode || editItem?.categoria === 'Base') && <input type="hidden" name="categoria" value="Base" />}
                </div>
                <textarea name="descripcion" className="form-textarea" rows={2} placeholder="Descripción" defaultValue={editItem?.descripcion || ''} />
                
                <div className="rd-form-row rd-form-row-3" style={ (isBaseProductMode || editItem?.categoria === 'Base') ? { opacity: 0.5, pointerEvents: 'none' } : {} }>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Precio Regular ($)</label>
                    <input name="precio" type="number" className="form-input" placeholder="Precio" step="0.01" defaultValue={(isBaseProductMode || editItem?.categoria === 'Base') ? 0 : (editItem?.precio || '')} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Descuento (%)</label>
                    <input name="descuento" type="number" className="form-input" placeholder="Ej: 15" step="0.1" defaultValue={(isBaseProductMode || editItem?.categoria === 'Base') ? 0 : (editItem?.descuento || 0)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Disponibilidad</label>
                    <select name="disponibilidad" className="form-select" defaultValue={(isBaseProductMode || editItem?.categoria === 'Base') ? 'true' : (editItem ? (editItem.disponibilidad ? 'true' : 'false') : 'true')}>
                      <option value="true">Disponible/Visible</option>
                      <option value="false">Oculto/No disponible</option>
                    </select>
                  </div>
                </div>

                {/* ─── Helados Configuration ─── */}
                {(() => {
                  if (itemCategory !== 'Helados' && editItem?.categoria !== 'Helados') return null;
                  
                  let iceConfig = {};
                  try {
                    iceConfig = typeof editItem?.variantes === 'string' ? JSON.parse(editItem.variantes) : (editItem?.variantes || {});
                  } catch(e) {}
                  const p = iceConfig.precios || {};

                  return (
                    <div className="card" style={{ padding: '16px', marginBottom: '16px', background: '#fff5f5', border: '1px solid #feb2b2' }}>
                      <h3 style={{ fontSize: '1rem', color: 'var(--red-600)', marginBottom: '12px' }}>🍦 Configuración de Helados</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>1/4 kg</label>
                          <input name="p_14" type="number" className="form-input" placeholder="Precio" defaultValue={p['1/4kg']?.precio || ''} />
                          <input name="m_14" type="number" className="form-input" placeholder="Máx sabores" defaultValue={p['1/4kg']?.max || 3} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>1/2 kg</label>
                          <input name="p_12" type="number" className="form-input" placeholder="Precio" defaultValue={p['1/2kg']?.precio || ''} />
                          <input name="m_12" type="number" className="form-input" placeholder="Máx sabores" defaultValue={p['1/2kg']?.max || 3} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>1 kg</label>
                          <input name="p_1" type="number" className="form-input" placeholder="Precio" defaultValue={p['1kg']?.precio || ''} />
                          <input name="m_1" type="number" className="form-input" placeholder="Máx sabores" defaultValue={p['1kg']?.max || 4} />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ─── Burgers/Combos Configuration ─── */}
                {(['Hamburguesas', 'Combos', 'Panchos'].includes(itemCategory) || ['Hamburguesas', 'Combos', 'Panchos'].includes(editItem?.categoria)) && (
                  <div className="card" style={{ padding: '16px', marginBottom: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--red-600)', marginBottom: '12px' }}>✨ Configuración de {
                      (itemCategory === 'Combos' || editItem?.categoria === 'Combos') ? 'Combo' : 
                      (itemCategory === 'Panchos' || editItem?.categoria === 'Panchos') ? 'Pancho' : 'Hamburguesa'
                    }</h3>
                    
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--gray-700)' }}>Variantes (Simple, Doble, etc.)</p>
                      {burgerVariants.map((v, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input placeholder="Nombre" className="form-input" style={{ flex: 2, marginBottom: 0 }} value={v.nombre} onChange={(e) => { const newV = [...burgerVariants]; newV[idx].nombre = e.target.value; setBurgerVariants(newV); }} />
                          <input placeholder="Precio" type="number" className="form-input" style={{ flex: 1, marginBottom: 0 }} value={v.precio} onChange={(e) => { const newV = [...burgerVariants]; newV[idx].precio = e.target.value; setBurgerVariants(newV); }} />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBurgerVariants(burgerVariants.filter((_, i) => i !== idx))}>✕</button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => setBurgerVariants([...burgerVariants, { nombre: '', precio: '' }])}>+ Añadir Variante</button>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--gray-700)' }}>Extras (Bacon, Cheddar, etc.)</p>
                      {burgerExtras.map((ex, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input placeholder="Nombre extra" className="form-input" style={{ flex: 2, marginBottom: 0 }} value={ex.nombre} onChange={(e) => { const newE = [...burgerExtras]; newE[idx].nombre = e.target.value; setBurgerExtras(newE); }} />
                          <input placeholder="Precio" type="number" className="form-input" style={{ flex: 1, marginBottom: 0 }} value={ex.precio} onChange={(e) => { const newE = [...burgerExtras]; newE[idx].precio = e.target.value; setBurgerExtras(newE); }} />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBurgerExtras(burgerExtras.filter((_, i) => i !== idx))}>✕</button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => setBurgerExtras([...burgerExtras, { nombre: '', precio: '' }])}>+ Añadir Extra</button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderTop: '1px solid #edf2f7', paddingTop: '15px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input type="checkbox" name="ofrecer_papas" checked={burgerOfferPapas} onChange={(e) => setBurgerOfferPapas(e.target.checked)} />
                        Ofrecer con papas
                      </label>
                      {burgerOfferPapas && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem' }}>Precio extra papas: $</span>
                          <input name="precio_papas" type="number" className="form-input" style={{ width: '80px', marginBottom: 0 }} value={burgerPrecioPapas} onChange={(e) => setBurgerPrecioPapas(e.target.value)} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <input name="foto" type="file" className="form-input" accept="image/*" />
                {/* ─── Gestión de Stock (Solo Panadería) ─── */}
                {profileData?.rubro === 'Panadería' && (
                  <div style={{ marginTop: 20, padding: 16, background: '#fff7ed', borderRadius: 12, border: '1px solid #ffedd5' }}>
                    <h3 style={{ fontSize: '1rem', color: '#9a3412', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      📦 Control de Inventario
                    </h3>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          name="maneja_stock" 
                          checked={(isBaseProductMode || editItem?.categoria === 'Base') ? true : itemManejaStock} 
                          readOnly={isBaseProductMode || editItem?.categoria === 'Base'}
                          onChange={(e) => setItemManejaStock(e.target.checked)}
                        />
                        <span className="slider round"></span>
                      </label>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#c2410c' }}>
                        {(isBaseProductMode || editItem?.categoria === 'Base') ? 'Control de stock obligatorio para Productos Base' : 'Habilitar control de stock propio para este plato'}
                      </span>
                    </div>

                    {((isBaseProductMode || editItem?.categoria === 'Base') || itemManejaStock) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="rd-form-row rd-form-row-3">
                          {((isBaseProductMode || editItem?.categoria === 'Base')) ? (
                            <>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: '#9a3412' }}>Stock Actual</label>
                                <input name="stock_actual" type="number" className="form-input" defaultValue={editItem?.stock_actual || 0} required />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: '#9a3412' }}>Alerta Stock Bajo</label>
                                <input name="stock_minimo" type="number" className="form-input" defaultValue={editItem?.stock_minimo || 10} />
                              </div>
                              <input type="hidden" name="unidades_por_venta" value="1" />
                              <input type="hidden" name="stock_base_id" value="" />
                            </>
                          ) : (
                            <>
                              <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: '0.75rem', color: '#9a3412' }}>Vincular a Producto Base (Recomendado)</label>
                                <select name="stock_base_id" className="form-select" defaultValue={editItem?.stock_base_id || ''}>
                                  <option value="">-- Usar stock propio --</option>
                                  {menuItems
                                    .filter(mi => mi.categoria === 'Base' && mi.id !== editItem?.id)
                                    .map(mi => (
                                      <option key={mi.id} value={mi.id}>{mi.nombre} (Stock: {mi.stock_actual})</option>
                                    ))
                                  }
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: '#9a3412' }}>Unidades por Venta</label>
                                <input name="unidades_por_venta" type="number" className="form-input" placeholder="Ej: 1 o 6" defaultValue={editItem?.unidades_por_venta || 1} />
                              </div>
                              <div style={{ display: 'none' }}>
                                <input name="stock_actual" type="number" defaultValue={0} />
                                <input name="stock_minimo" type="number" defaultValue={0} />
                              </div>
                            </>
                          )}
                        </div>
                        
                        {!(isBaseProductMode || editItem?.categoria === 'Base') && (
                          <p style={{ fontSize: '0.7rem', color: '#c2410c' }}>
                            Al vincular un ítem base, el stock se descontará del producto original (Ej: Pack de 6 medialunas descuenta 6 del ítem base Medialuna).
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="rd-form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => { setEditItem(null); setView('menu'); loadMenu(); setIsBaseProductMode(false); }}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={itemLoading}>
                    {itemLoading ? <span className="spinner spinner-white" /> : (editItem ? 'Guardar Cambios' : (profileData?.rubro === 'Market' || profileData?.rubro === 'Farmacia' ? 'Guardar Artículo' : 'Guardar Plato'))}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ─── Gestión de Helados (Sabores, Salsas, Adicionales) ─── */}
        {view === 'sabores' && (
          <section className="animate-fade-in">
            <h2 style={{ color: 'var(--red-600)', marginBottom: 24, textAlign: 'center' }}>Gestión de Helados</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Sección Sabores y Salsas */}
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>🍦 Sabores y Salsas</h3>
                <div className="card card-body" style={{ marginBottom: 16 }}>
                  <form onSubmit={handleAddSabor} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input name="nombre" className="form-input" placeholder="Nombre (Ej: Dulce de Leche)" required />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select name="tipo" className="form-select" style={{ flex: 1 }}>
                        <option value="Sabor">Es un Sabor</option>
                        <option value="Salsa">Es una Salsa</option>
                      </select>
                      <button type="submit" className="btn btn-primary">Agregar</button>
                    </div>
                  </form>
                </div>

                {saboresLoading ? (
                  <div className="loading-state"><div className="spinner" /> Cargando...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                    {sabores.length === 0 ? <p className="rd-empty" style={{ padding: 10 }}>No hay sabores/salsas</p> : 
                     sabores.map(s => (
                      <div key={s.id} className="card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label className="toggle">
                            <input type="checkbox" checked={s.disponible} onChange={() => handleToggleSaborDisp(s.id, s.disponible)} />
                            <span className="toggle-track" />
                            <span className="toggle-thumb" />
                          </label>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: s.disponible ? 'inherit' : 'var(--gray-400)' }}>{s.nombre}</span>
                            <span className={`badge ${s.tipo === 'Salsa' ? 'badge-amber' : 'badge-blue'}`} style={{ marginLeft: 8, fontSize: '0.7rem' }}>{s.tipo}</span>
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteSabor(s.id)} style={{ color: 'var(--red-500)', padding: 4 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sección Adicionales (Pagos) */}
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>📦 Adicionales (Con Precio)</h3>
                <div className="card card-body" style={{ marginBottom: 16 }}>
                  <form onSubmit={handleAddAdicional} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input name="nombre" className="form-input" placeholder="Nombre (Ej: Cucurucho)" required />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input name="precio" type="number" className="form-input" placeholder="Precio $" style={{ flex: 1 }} required />
                      <button type="submit" className="btn btn-success">Agregar</button>
                    </div>
                  </form>
                </div>

                {adicionalesLoading ? (
                  <div className="loading-state"><div className="spinner" /> Cargando...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                    {adicionales.length === 0 ? <p className="rd-empty" style={{ padding: 10 }}>No hay adicionales</p> : 
                     adicionales.map(a => (
                      <div key={a.id} className="card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label className="toggle">
                            <input type="checkbox" checked={a.disponible} onChange={() => handleToggleAdicionalDisp(a.id, a.disponible)} />
                            <span className="toggle-track" />
                            <span className="toggle-thumb" />
                          </label>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: a.disponible ? 'inherit' : 'var(--gray-400)' }}>{a.nombre}</span>
                            <span style={{ marginLeft: 8, color: 'var(--red-600)', fontWeight: 700, fontSize: '0.9rem' }}>${a.precio}</span>
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteAdicional(a.id)} style={{ color: 'var(--red-500)', padding: 4 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ─── Settings View ─── */}
        {view === 'settings' && (
          <section className="animate-fade-in">
            <div className="rd-tabs" style={{ gap: 8, marginBottom: 24 }}>
              <button className={profileSubView === 'edit' ? 'active' : ''} onClick={() => setProfileSubView('edit')}>
                ⚙️ Configuración
              </button>
              <button className={profileSubView === 'printing' ? 'active' : ''} onClick={() => setProfileSubView('printing')}>
                🖨️ Impresión Ticket
              </button>
            </div>

            {profileSubView === 'edit' && (
              <div className="card card-body" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ color: 'var(--red-600)', marginBottom: 20, textAlign: 'center' }}>⚙️ Configuración del Local</h2>
                
                <form onSubmit={handleSaveSettings}>
                  {/* Rubro Selection (Keep instant update logic but inside form UI) */}
                  <div style={{ marginBottom: 24, padding: 16, background: 'var(--gray-50)', borderRadius: 12, border: '1px solid var(--gray-200)' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: 12, color: 'var(--gray-700)' }}>Rubro del Negocio</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: 20 }}>
                      Seleccioná el rubro de tu local para adaptar las opciones del panel.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <select 
                        className="form-select" 
                        style={{ padding: '12px', fontSize: '1rem' }}
                        value={profileData?.rubro || 'Comida Rápida'}
                        onChange={async (e) => {
                          const r = e.target.value;
                          try {
                            const success = await api.updatePerfilLocal({ localId: restaurant.id, rubro: r });
                            if (success) {
                              setProfileData({ ...profileData, rubro: r });
                              toast.success(`Rubro cambiado a ${r}`);
                            }
                          } catch (e) { toast.error('Error al cambiar rubro'); }
                        }}
                      >
                        {['Comida Rápida', 'Panadería', 'Heladería', 'Market', 'Farmacia'].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>


                  {/* Enlace Compartible */}
                  <div style={{ marginBottom: 24, padding: 16, background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: 12, color: '#0369a1' }}>🔗 Enlace Compartible</h3>
                    <p style={{ fontSize: '0.85rem', color: '#0c4a6e', marginBottom: 16 }}>
                      Compartí este enlace con tus clientes para que accedan directamente a tu menú en Wepi.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        className="form-input" 
                        readOnly 
                        value={`https://wepi.com.ar/pedir/${profileData?.slug || 'identificador-pendiente'}`} 
                        style={{ flex: 1, marginBottom: 0, background: '#fff', fontSize: '0.85rem' }}
                      />
                      <button 
                        type="button" 
                        className="btn btn-primary"
                        style={{ background: '#0284c7' }}
                        onClick={() => {
                          const link = `https://wepi.com.ar/pedir/${profileData?.slug || 'identificador-pendiente'}`;
                          navigator.clipboard.writeText(link);
                          toast.success('¡Enlace copiado!', { icon: '📋' });
                        }}
                      >
                        Copiar
                      </button>
                    </div>
                    {!profileData?.slug && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--red-600)', marginTop: 8, fontWeight: 600 }}>
                        ⚠️ Tu local aún no tiene un identificador único asignado.
                      </p>
                    )}
                  </div>

                  {/* Horarios */}
                  <div style={{ marginBottom: 24, padding: 16, background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: 16, color: 'var(--gray-700)' }}>🕒 Horarios de Atención</h3>
                    
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: 8, fontWeight: 600 }}>Primer Turno (Mañana/Mediodía)</p>
                      <div className="rd-form-row" style={{ marginBottom: 0, gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Apertura</label>
                          <input name="horario_apertura" type="time" className="form-input" defaultValue={profileData?.horario_apertura || '09:00'} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Cierre</label>
                          <input name="horario_cierre" type="time" className="form-input" defaultValue={profileData?.horario_cierre || '14:00'} />
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: 8, fontWeight: 600 }}>Segundo Turno (Tarde/Noche - Opcional)</p>
                      <div className="rd-form-row" style={{ marginBottom: 0, gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Apertura</label>
                          <input name="horario_apertura2" type="time" className="form-input" defaultValue={profileData?.horario_apertura2 || ''} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Cierre</label>
                          <input name="horario_cierre2" type="time" className="form-input" defaultValue={profileData?.horario_cierre2 || ''} />
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '12px', background: 'var(--gray-50)', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>Gestión de Estado</label>
                      <select name="modo_automatico" className="form-select" defaultValue={profileData?.modo_automatico ? 'true' : 'false'}>
                        <option value="true">Modo Automático (Abrir/Cerrar según horario)</option>
                        <option value="false">Modo Manual (Yo controlo el botón de Abrir/Cerrar)</option>
                      </select>
                    </div>
                  </div>

                  {/* Días */}
                  <div style={{ marginBottom: 24, padding: 16, background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: 16, color: 'var(--gray-700)' }}>📅 Días de Apertura</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => {
                        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                        const dayNorm = normalize(day);
                        const isSelected = profileData?.dias_apertura?.some(d => normalize(d) === dayNorm);
                        return (
                          <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--gray-100)', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input type="checkbox" name={`day_${day}`} defaultChecked={isSelected || !profileData?.dias_apertura} />
                            {day}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Entrega */}
                  <div style={{ marginBottom: 24, padding: 16, background: 'white', borderRadius: 12, border: '1px solid var(--gray-200)' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: 16, color: 'var(--gray-700)' }}>🛵 Métodos de Entrega</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.95rem' }}>
                        <input type="checkbox" name="acepta_retiro" defaultChecked={profileData?.acepta_retiro !== false} />
                        🏪 Ofrecer Retiro en Local
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.95rem' }}>
                        <input type="checkbox" name="acepta_envio" defaultChecked={profileData?.acepta_envio !== false} />
                        🛵 Ofrecer Envío a Domicilio
                      </label>
                    </div>
                  </div>

                  <div className="rd-form-actions" style={{ marginBottom: 32 }}>
                    <button type="submit" className="btn btn-success btn-full">Guardar Configuración</button>
                  </div>
                </form>

                {/* Mercado Pago connection (External to the main settings form) */}
                <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid var(--gray-200)' }} />
                <div style={{ backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                  <h3 style={{ color: '#0369a1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="https://i.postimg.cc/k47vV4h3/mercadopago.png" alt="MP" style={{ height: 24 }} onError={(e) => e.target.style.display = 'none'} />
                    Cobros con Mercado Pago
                  </h3>
                  <p style={{ color: '#0c4a6e', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
                    Conectá tu cuenta de Mercado Pago para recibir pagos online directamente en tu cuenta.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ backgroundColor: '#009ee3', borderColor: '#009ee3', padding: '10px 24px', fontWeight: 600 }}
                      onClick={() => {
                        const clientId = import.meta.env.VITE_MP_CLIENT_ID || prompt("Por favor, ingresa el CLIENT_ID de tu aplicación de Mercado Pago:");
                        if (!clientId) return;
                        const redirectUri = `${import.meta.env.VITE_SUPABASE_URL || 'https://jskxfescamdjesdrcnkf.supabase.co'}/functions/v1/mp-oauth-callback`;
                        const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${restaurant.id}&redirect_uri=${encodeURIComponent(redirectUri)}`;
                        window.location.href = authUrl;
                      }}
                    >
                      Vincular MercadoPago
                    </button>
                    {profileData?.mp_access_token && (
                      <span className="badge badge-green" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>✓ Vinculada</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {profileSubView === 'printing' && (
              <div className="card card-body animate-fade-in" style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🖨️</div>
                <h2 style={{ color: 'var(--red-600)', marginBottom: '16px' }}>Impresión Automática de Tickets</h2>
                <p style={{ color: 'var(--gray-600)', maxWidth: '500px', margin: '0 auto 32px', lineHeight: 1.6 }}>
                  Optimizá tu local con nuestra aplicación de escritorio. Imprime tickets automáticamente en tu comandera térmica apenas recibís un pedido.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px', margin: '0 auto' }}>
                  <a 
                    href="/download/weep-printer-latest.exe" 
                    download={`Wepi_${restaurant?.localId || restaurant?.id || 'LOCAL'}.exe`}
                    className="btn btn-primary btn-full"
                    style={{ padding: '16px', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                  >
                    🚀 Descargar instalador para Windows
                  </a>
                  
                  <div className="card" style={{ padding: '24px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', marginTop: '20px' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Tu ID de Configuración</h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                      <code style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--gray-800)', background: 'white', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--gray-300)' }}>
                        {restaurant?.id}
                      </code>
                      <button 
                        className="btn btn-sm btn-ghost" 
                        onClick={() => { navigator.clipboard.writeText(restaurant?.id); toast.success('ID Copiado'); }}
                        style={{ padding: '8px' }}
                      >
                        📋 Copiar
                      </button>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '16px' }}>
                      Copiá este ID y pegalo en la aplicación de escritorio para vincular tu local.
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: '40px', borderTop: '1px solid var(--gray-100)', paddingTop: '40px', textAlign: 'left', maxWidth: '600px', margin: '40px auto 0' }}>
                  <h4 style={{ marginBottom: '16px' }}>Pasos para configurar:</h4>
                  <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--gray-600)' }}>
                    <li><strong>Descargá e instalá</strong> el programa en la computadora que tiene conectada la impresora.</li>
                    <li><strong>Abrí Wepi Desktop</strong> e ingresá tu ID de Local (arriba).</li>
                    <li><strong>Seleccioná tu impresora</strong> térmica en el menú desplegable.</li>
                    <li>¡Listo! La app detectará tus pedidos y los imprimirá automáticamente.</li>
                  </ol>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ─── Planes y Comisiones View ─── */}
        {view === 'plans' && renderPlansView()}

        {/* ─── Profile ─── */}
        {view === 'profile' && (
          <section className="animate-fade-in">
            <div className="rd-tabs" style={{ gap: 8, marginBottom: 24 }}>
              <button className={profileSubView === 'ventas' ? 'active' : ''} onClick={() => setProfileSubView('ventas')}>
                💰 Mis Ventas
              </button>
              <button className={profileSubView === 'cobros' ? 'active' : ''} onClick={() => { setProfileSubView('cobros'); loadCobros(); }}>
                🏦 Gestión de Pagos
              </button>
              <button className={profileSubView === 'edit' ? 'active' : ''} onClick={() => setProfileSubView('edit')}>
                👤 Editar Perfil
              </button>
            </div>

            {profileSubView === 'ventas' && (
              <div className="card" style={{ padding: '16px', overflowX: 'auto' }}>
                <h2 style={{ color: 'var(--red-600)', marginBottom: 16 }}>Mis Ventas</h2>
                
                {finishedOrders.length > 0 && (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '16px', 
                    marginBottom: '32px' 
                  }}>
                    {/* Contador de Cantidad */}
                    <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid var(--red-600)', background: 'var(--gray-50)' }}>
                      <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Cantidad de Ventas</p>
                      <h3 style={{ margin: '8px 0 0', fontSize: '2.5rem', color: 'var(--red-600)', fontWeight: 800 }}>{finishedOrders.length}</h3>
                    </div>
                    {/* Contador de Monto Total */}
                    <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid var(--green-600)', background: 'var(--gray-50)' }}>
                      <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Monto Total Recaudado</p>
                      <h3 style={{ margin: '8px 0 0', fontSize: '2.5rem', color: 'var(--green-600)', fontWeight: 800 }}>
                        ${finishedOrders.reduce((sum, o) => sum + (Number(o.totalLocal) || 0), 0).toLocaleString('es-AR')}
                      </h3>
                    </div>
                  </div>
                )}

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
                          <td style={{ padding: '12px 8px' }}>#{o.idPedido.substring(0, 8)}</td>
                          <td style={{ padding: '12px 8px' }}>{o.fecha ? new Date(o.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : '---'}</td>
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
            )}

            {profileSubView === 'cobros' && (
              <div className="card card-body">
                <h2 style={{ color: 'var(--red-600)', marginBottom: 16, textAlign: 'center' }}>Gestión de Pagos</h2>
                <p style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: 24 }}>Comisión Wepi {planInfo?.comision_actual || 15}% • Abona tu saldo pendiente por transferencia</p>
                
                {cobrosLoading || !cobrosData ? (
                  <div className="loading-state"><div className="spinner" /> Cargando...</div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                      {/* Total */}
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid var(--gray-400)' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Total ventas</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem' }}>${cobrosData.totalVentas}</h3>
                      </div>
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid var(--amber-500)' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Comisión Total ({planInfo?.comision_actual || 15}%)</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem', color: 'var(--amber-600)' }}>${cobrosData.comisionTotal}</h3>
                      </div>

                      {/* Transferencia */}
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #bae6fd' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Ventas Transferencia</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem' }}>${cobrosData.ventasTransf}</h3>
                      </div>
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid var(--green-500)' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Comisión saldada</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem', color: 'var(--green-600)' }}>${cobrosData.comisionSaldada}</h3>
                      </div>

                      {/* Efectivo */}
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #fed7aa' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Ventas Efectivo</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem' }}>${cobrosData.ventasEfectivo}</h3>
                      </div>
                      <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid var(--red-600)' }}>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Comisión Pendiente</p>
                        <h3 style={{ margin: '8px 0 0', fontSize: '1.5rem', color: 'var(--red-600)' }}>${cobrosData.comisionPendiente}</h3>
                      </div>
                    </div>

                    {cobrosData.comisionPendiente > 0 && (
                      <div className="animate-fade-in" style={{ backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
                        <h3 style={{ color: '#9a3412', marginBottom: '16px', textAlign: 'center' }}>Pagar Saldo Pendiente</h3>
                        <p style={{ textAlign: 'center', fontSize: '0.95rem', color: '#7c2d12', marginBottom: '20px' }}>
                          Para saldar tu comisión de pedidos en efectivo, realizá una transferencia a la siguiente cuenta y adjuntá el comprobante.
                        </p>
                        
                        <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9a3412' }}>Nombre de cuenta</p>
                              <p style={{ margin: 0, fontWeight: '600' }}>Axel Damian Martinez</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9a3412' }}>Alias</p>
                              <p style={{ margin: 0, fontWeight: '600' }}>weep.ar</p>
                            </div>
                            <button className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard.writeText('weep.ar'); toast.success('Alias copiado'); }}>Copiar</button>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9a3412' }}>CVU</p>
                              <p style={{ margin: 0, fontWeight: '600', fontSize: '0.85rem' }}>0000003100022130092564</p>
                            </div>
                            <button className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard.writeText('0000003100022130092564'); toast.success('CVU copiado'); }}>Copiar</button>
                          </div>
                          
                          <div style={{ marginTop: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '600' }}>Adjuntar comprobante (imagen)</label>
                            <input type="file" id="comprobante_pago" accept="image/*" className="form-input" style={{ marginBottom: '16px' }} />
                            
                            <button 
                              className="btn btn-success btn-full" 
                              onClick={async () => {
                                const fileInput = document.getElementById('comprobante_pago');
                                const file = fileInput?.files[0];
                                if (!file) { toast.error('Debes adjuntar el comprobante'); return; }
                                
                                setCobrosLoading(true);
                                try {
                                  const imgUrl = await api.uploadImage(file);
                                  const res = await api.solicitarCobro(restaurant.id, cobrosData.comisionPendiente, imgUrl);
                                  if (res.success) {
                                    toast.success('Pago solicitado correctamente');
                                    loadCobros();
                                  } else {
                                    toast.error(res.error || 'Error al enviar');
                                  }
                                } catch (e) {
                                  toast.error('Error al subir comprobante');
                                }
                                setCobrosLoading(false);
                              }}
                            >
                              Confirmar y Pagar Saldo (${cobrosData.comisionPendiente})
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <h3 style={{ color: 'var(--red-600)', marginBottom: 16 }}>Historial de Pago</h3>
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
                              <th style={{ padding: '12px 8px' }}>Comprobante</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cobrosData.historial.map((h, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                <td style={{ padding: '12px 8px' }}>{new Date(h.fechaSolicitud).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</td>
                                <td style={{ padding: '12px 8px', fontWeight: '600' }}>${h.montoNeto}</td>
                                <td style={{ padding: '12px 8px' }}>
                                  <span className={`badge ${h.estado === 'Pendiente' ? 'badge-amber' : h.estado === 'Completado' ? 'badge-green' : 'badge-gray'}`}>
                                    {h.estado === 'Pendiente' ? 'Pago solicitado' : h.estado}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 8px' }}>
                                  {h.comprobanteUrl ? (
                                    <a href={h.comprobanteUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" style={{ fontSize: '0.75rem' }}>Ver</a>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Sin adjunto</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}


            {profileSubView === 'edit' && (
              <div className="card card-body">
                <h2 style={{ color: 'var(--red-600)', marginBottom: 16 }}>Editar Perfil del Local</h2>
                {profileData && (
                  <form onSubmit={handleSaveProfile} className="rd-item-form">
                    <input type="hidden" name="update_address" value="true" />
                    {profileData.foto_url && <img src={profileData.foto_url} alt="" style={{ width: 120, borderRadius: 12, margin: '0 auto 16px', display: 'block' }} />}
                    <input name="foto" type="file" className="form-input" accept="image/*" />
                    <div className="rd-form-row">
                      <input name="nombre" className="form-input" placeholder="Nombre del local" defaultValue={profileData.nombre || ''} required />
                      <div className="address-display-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px', 
                          background: 'var(--gray-50)', 
                          padding: '10px 14px', 
                          borderRadius: '8px', 
                          border: '1px solid var(--gray-200)',
                          cursor: 'pointer'
                        }} onClick={() => setShowAddressSelector(true)}>
                          <span style={{ fontSize: '1.2rem' }}>📍</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Ubicación en el mapa</p>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gray-800)', fontWeight: 500 }}>
                              {profileAddress || 'Configurar ubicación...'}
                            </p>
                          </div>
                          <button type="button" className="btn btn-ghost btn-xs" style={{ color: 'var(--blue-600)' }}>Cambiar</button>
                        </div>
                        <input 
                          name="direccion" 
                          className="form-input" 
                          placeholder="Dirección manual (opcional)" 
                          value={profileAddress} 
                          onChange={(e) => setProfileAddress(e.target.value)} 
                        />
                        {(!profileLat || !profileLng) && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--amber-600)', fontStyle: 'italic' }}>
                            ⚠️ Ubicación no configurada en el mapa
                          </span>
                        )}
                      </div>
                    </div>
                    <input name="email" type="email" className="form-input" placeholder="Email" defaultValue={profileData.email || ''} required />
                    <input name="password" type="password" className="form-input" placeholder="Nueva contraseña (dejar vacío para no cambiar)" />
                    

                    
                    <div className="rd-form-actions" style={{ marginTop: '24px' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => setView('orders')}>Cancelar</button>
                      <button type="submit" className="btn btn-success">Guardar Perfil</button>
                    </div>
                  </form>
                )}
                
                {showAddressSelector && (
                  <AddressSelector 
                    isLoaded={isMapLoaded}
                    initialAddress={profileAddress}
                    initialCoords={profileLat && profileLng ? { lat: profileLat, lng: profileLng } : null}
                    onConfirm={handleAddressConfirm}
                    onCancel={() => setShowAddressSelector(false)}
                    title="Ubicación de tu Local"
                    errorMsg="El local debe estar ubicado en Santo Tomé."
                    limitToCity="Santo Tomé"
                  />
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px 20px', background: 'var(--red-800)', color: 'white' }}>
        <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" style={{ height: '50px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        <p>© 2026 <strong>Wepi</strong> — Panel de Locales</p>
        <button 
          onClick={() => setShowTerms(true)} 
          style={{ background: 'none', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          Ver Términos y Condiciones
        </button>
        <button 
          onClick={() => setShowRegretModal(true)} 
          style={{ background: 'none', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem', marginTop: '4px', fontWeight: 'bold' }}
        >
          Botón de Arrepentimiento
        </button>
      </footer>
      {renderTermsModal()}
      {renderRegretModal()}
    </div>
  );
}

/* ─── Order Card Component ─── */
function OrderCard({ order: o, onAction, finished }) {
  const [loading, setLoading] = React.useState('');
  const handleAction = async (action) => {
    setLoading(action);
    await onAction(o, action);
    setLoading('');
  };
  const subtotal = o.items.reduce((sum, i) => sum + (i[7] || 0), 0);
  const statusColors = { Pendiente: 'badge-amber', Confirmado: 'badge-amber', Aceptado: 'badge-info', Listo: 'badge-blue', Entregado: 'badge-green', Rechazado: 'badge-red' };
  return (
    <div className="rd-order-card card">
      <div className="rd-order-header">
        <div>
          <strong>Pedido #{o.idPedido}</strong>
          <span className="rd-order-sub">Local #{o.idPedidoLocal}</span>
          {o.fecha && <span className="rd-order-sub" style={{ marginLeft: 8 }}>📅 {new Date(o.fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>}
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
        <p><strong>Repartidor:</strong> <span style={{ color: 'var(--blue-600)', fontWeight: 'bold' }}>{o.repartidorNombre || 'Buscando...'}</span> {o.repartidorTelefono && <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginLeft: 8 }}>({o.repartidorTelefono})</span>}</p>
        {o.observaciones !== 'Ninguna' && <p><strong>Obs:</strong> {o.observaciones}</p>}
        <div className="rd-order-items">
          {o.items.map((item, i) => (
            <div key={i} className="rd-order-item" style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px dashed var(--gray-100)', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 600 }}>
                <span>{item[4]} × {item[6]}</span>
                <span>${item[7].toFixed(2)}</span>
              </div>
              {/* El detalle ahora viene incluido en el nombre del producto (item[4]) */}
            </div>
          ))}
        </div>
        <div className="rd-order-footer">
          <p><strong>Subtotal (Local):</strong> <span style={{ color: 'var(--red-600)', fontSize: '1.2rem' }}>${o.totalLocal.toFixed(2)}</span></p>
        </div>
        {!finished && (
          <div className="rd-order-actions">
            {['Pendiente', 'Confirmado'].includes(o.estadoActual) ? (
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
