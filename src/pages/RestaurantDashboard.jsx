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

  // ─── Modal Arrepentimiento ───
  const renderRegretModal = () => (
    showRegretModal && (
      <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowRegretModal(false)}>
        <div className="modal-box animate-fade-in" style={{ maxWidth: '400px', textAlign: 'center', background: 'white', padding: '24px', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ color: 'var(--red-600)', marginBottom: '16px' }}>Botón de Arrepentimiento</h3>
          <p style={{ marginBottom: '20px', color: 'var(--gray-600)', fontSize: '0.95rem' }}>
            ¿Deseas arrepentirte de tu registro y eliminar tu cuenta de local permanentemente de Weep? <br/>
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
            <p>El comercio utiliza Weep como plataforma de visibilidad y gestión de pedidos. No existe relación societaria ni laboral.</p>
            <p><strong>2. Calidad</strong></p>
            <p>El local es el único responsable por el estado, higiene y veracidad de los productos entregados.</p>
            <p><strong>3. Gestión de Pedidos</strong></p>
            <p>El comercio debe mantener su menú actualizado y responder a los pedidos en tiempo y forma.</p>
            <p><strong>4. Comisiones</strong></p>
            <p>Weep percibirá una comisión acordada sobre las ventas realizadas a través de la plataforma.</p>
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

  /* ─── Modo Automático ─── */
  const estaDentroDeHorario = React.useCallback((apertura, cierre, diasApertura) => {
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

  const verificarEstadoAutomatico = React.useCallback(() => {
    if (!profileData || !profileData.modo_automatico || !profileData.horario_apertura || !profileData.horario_cierre) return;
    
    const shouldBeOpen = estaDentroDeHorario(profileData.horario_apertura, profileData.horario_cierre, profileData.dias_apertura);
    
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
      setMenuItems(Array.isArray(items) ? items : []);
    } catch { toast.error('Error al cargar menú'); }
    setMenuLoading(false);
  }, [restaurant]);

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
          } else if (pedido.tipoEntrega?.toLowerCase().includes('envío') || pedido.tipoEntrega?.toLowerCase().includes('delivery')) {
            // Auto-asignar primer repartidor disponible si es delivery y no tiene uno
            api.assignRepartidor(pedido.idPedido).catch(e => console.error("Error auto-assigning driver:", e));
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
    const direccion = fd.get('direccion');
    const selectedDays = [];
    const email = fd.get('email');
    if (!isValidEmail(email)) { toast.error('Ingresá un email válido'); return; }
    
    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(day => {
      if (fd.get(`day_${day}`) === 'on') selectedDays.push(day);
    });

    try {
      let fotoUrl = '';
      if (file && file.size > 0) fotoUrl = await api.uploadImage(file);
      
      const discountDays = [];
      ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(day => {
        if (fd.get(`desc_${day}`) === 'on') discountDays.push(day);
      });

      const params = {
        localId: restaurant.id, 
        nombre: fd.get('nombre'),
        direccion: profileAddress,
        lat: profileLat,
        lng: profileLng,
        email: fd.get('email'),
        horario_apertura: fd.get('horario_apertura'),
        horario_cierre: fd.get('horario_cierre'),
        modo_automatico: fd.get('modo_automatico') === 'true',
        dias_apertura: selectedDays,
        dias_descuento: discountDays,
        descuento_general: parseInt(fd.get('descuento_general')) || 0,
        acepta_retiro: fd.get('acepta_retiro') === 'on',
        acepta_envio: fd.get('acepta_envio') === 'on'
      };

      const pass = fd.get('password');
      if (pass) params.password = pass;
      if (fotoUrl) params.foto_url = fotoUrl;
      const success = await api.updatePerfilLocal(params);
      if (success) {
        toast.success('Perfil actualizado correctamente');
        setProfileData(prev => ({ ...prev, ...params }));
        if (view !== 'profile') setView('orders'); // Don't jump if we are in profile
      }
    } catch { toast.error('Error al guardar perfil'); }
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
    nombre: 'Hamburguesa Weep (Muestra)',
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
    items: [[null, null, 'sample-dish-1', 1, 'Hamburguesa Weep (Muestra)', '', 1, 4500]],
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

  const processOrders = orders.filter(o => ['Pendiente', 'Aceptado', 'Listo'].includes(o.estadoActual));
  const finishedOrders = orders.filter(o => o.estadoActual === 'Entregado');
  
  const pendientesOrders = processOrders.filter(o => o.estadoActual === 'Pendiente').sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
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
          <img src="https://res.cloudinary.com/dw10wkbac/image/upload/v1775234747/gvapffe3wwp4ljgr33le.png" alt="Weep" className="rd-logo" />
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
        <img src="https://res.cloudinary.com/dw10wkbac/image/upload/v1775234747/gvapffe3wwp4ljgr33le.png" alt="Weep" style={{ height: '50px', objectFit: 'contain' }} />
        <p>© 2026 <strong>Weep</strong> — Panel de Locales</p>
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
        title: "¡Bienvenido a Weep!",
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

  // ─── Dashboard ───
  return (
    <div className="rd-page">
      {renderTutorial()}
      <header className="rd-header">
        <Link to="/">
          <img src="https://res.cloudinary.com/dw10wkbac/image/upload/v1775234747/gvapffe3wwp4ljgr33le.png" alt="Weep" className="rd-logo" />
        </Link>
        <h1>Panel de Gestión</h1>
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
        <div className="rd-topbar animate-fade-in">
          <div className="rd-topbar-left">
            <label className="toggle" onClick={toggleEstado}>
              <input type="checkbox" checked={localOpen} readOnly />
              <span className="toggle-track" />
              <span className="toggle-thumb" />
            </label>
            <span className={`rd-status ${localOpen ? 'open' : ''}`}>{localOpen ? 'Abierto' : 'Cerrado'}</span>
            
            <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #ddd', paddingLeft: '16px' }}>
               <div style={{ 
                 width: '10px', 
                 height: '10px', 
                 borderRadius: '50%', 
                 backgroundColor: hasRepartidores ? '#00e676' : '#ffa000',
                 boxShadow: hasRepartidores ? '0 0 8px #00e676' : '0 0 8px #ffa000'
               }}></div>
               <span style={{ fontSize: '0.75rem', fontWeight: 700, color: hasRepartidores ? 'var(--green-600)' : 'var(--amber-600)' }}>
                 REPARTIDORES: {hasRepartidores ? 'ACTIVOS' : 'NO DISPONIBLES'}
               </span>
            </div>
          </div>
          <div className="rd-topbar-right">
            {profileData?.foto_url && <img src={profileData.foto_url} alt="" className="rd-avatar" />}
            
            <div className="rd-dropdown-container">
              <button 
                className={`btn btn-ghost btn-sm ${view === 'profile' ? 'active' : ''}`} 
                onClick={(e) => { e.stopPropagation(); setProfileMenuOpen(!profileMenuOpen); }}
              >
                Mi Perfil ▾
              </button>
              
              {profileMenuOpen && (
                <div className="rd-dropdown-menu animate-fade-in">
                  <button className="rd-dropdown-item" onClick={() => { setView('profile'); setProfileSubView('ventas'); loadOrders(); }}>
                    💰 Mis Ventas
                  </button>
                  <button className="rd-dropdown-item" onClick={() => { setView('profile'); setProfileSubView('cobros'); loadCobros(); }}>
                    🏦 Gestión de Pagos
                  </button>
                  <button className="rd-dropdown-item" onClick={() => { setView('profile'); setProfileSubView('edit'); loadProfile(); }}>
                    👤 Editar Perfil
                  </button>
                  <button className="rd-dropdown-item" onClick={() => { setShowTutorial(true); setTutorialStep(1); setView('orders'); setProfileMenuOpen(false); }} style={{ color: 'var(--blue-600)', fontWeight: 'bold' }}>
                    📖 Ver tutorial
                  </button>
                </div>
              )}
            </div>

            <button 
              className="btn btn-sm" 
              style={{ backgroundColor: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }} 
              onClick={() => {
                const localId = restaurant?.localId || restaurant?.id || 'LOCAL';
                const downloadUrl = '/Weep_Desktop.exe'; // Servido desde la carpeta public/
                
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', `Weep_${localId}.exe`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                toast.success('Iniciando descarga de WEEP Desktop...');
              }}
            >
              📄 Impresión de Ticket
            </button>

            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }} onClick={() => { logoutRestaurant(); window.location.reload(); }}>Salir</button>
          </div>
        </div>

        {/* Persistent Alerts for Missing Configs */}
        {profileData && (
          <div className="rd-alerts" style={{ padding: '0 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(!profileData.mp_access_token) && (
              <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#d48800', fontWeight: '500' }}>⚠️ <strong>Mercado Pago desvinculado:</strong> Vinculá tu cuenta para recibir pagos online.</span>
                <button className="btn btn-sm" style={{ backgroundColor: '#faad14', color: '#fff', border: 'none' }} onClick={() => { setView('profile'); loadProfile(); }}>Vincular</button>
              </div>
            )}
            {(!profileData.horario_apertura || !profileData.horario_cierre) && (
              <div style={{ backgroundColor: '#fff1f0', border: '1px solid #ffa39e', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#cf1322', fontWeight: '500' }}>⏰ <strong>Horarios sin configurar:</strong> Establecé el horario de cierre de cocina para gestionar pedidos automáticos.</span>
                <button className="btn btn-sm" style={{ backgroundColor: '#ff4d4f', color: '#fff', border: 'none' }} onClick={() => { setView('profile'); loadProfile(); }}>Configurar</button>
              </div>
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
          
          <div className="rd-dropdown-container">
            <button 
              className={`rd-nav-btn ${(view === 'addItem' || view === 'sabores') ? 'active' : ''}`} 
              onClick={(e) => { e.stopPropagation(); setAddMenuOpen(!addMenuOpen); }}
            >
              ➕ Añadir ▾
            </button>
            {addMenuOpen && (
              <div className="rd-dropdown-menu animate-fade-in" style={{ left: 0, right: 'auto' }}>
                <button className="rd-dropdown-item" onClick={() => { setEditItem(null); setView('addItem'); setItemCategory(''); setAddMenuOpen(false); }}>
                  🍔 Nuevo Plato
                </button>
                <button className="rd-dropdown-item" onClick={() => { setView('sabores'); loadSabores(); setAddMenuOpen(false); }}>
                  🍦 Sabores y Adicionales
                </button>
              </div>
            )}
          </div>
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
            <div className="card card-body" style={{ marginBottom: 24, border: '1px solid #feb2b2', background: '#fff5f5' }}>
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
                        <button type="submit" className="btn btn-success btn-sm">Guardar %</button>
                     </div>
                     
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => {
                          const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                          const isSelected = profileData?.dias_descuento?.some(d => normalize(d) === normalize(day));
                          return (
                            <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: 'white', padding: '4px 10px', borderRadius: '8px', border: '1px solid #feb2b2', fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input type="checkbox" name={`desc_${day}`} defaultChecked={isSelected} onChange={() => {
                                  // We trigger form submit on checkbox change for convenience
                                  // but keep the hidden inputs for other profile fields
                              }} />
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
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
                   <button className="btn btn-success" onClick={() => { setEditItem(null); setItemCategory(''); setItemName(''); setView('addItem'); }}>+ Nuevo Plato</button>
                   <div style={{ padding: '8px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>
                      Estado hoy: {(() => {
                        const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
                        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                        const isPromo = profileData?.dias_descuento?.some(d => normalize(d) === normalize(today));
                        return isPromo ? <span style={{ color: 'var(--red-600)' }}>🔥 PROMO {profileData?.descuento_general}% OFF</span> : <span style={{ color: 'var(--gray-500)' }}>Sin promo general</span>;
                      })()}
                   </div>
                </div>
              </div>
            </div>
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
              <p className="rd-empty">No hay platos. ¡Agregá tu primer plato!</p>
            ) : finalMenu.map(item => (
              <div key={item.id} className="rd-menu-item card">
                {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} className="rd-menu-img" /> :
                  <div className="rd-menu-img-placeholder">Sin foto</div>}
                <div className="rd-menu-info">
                  <div className="rd-menu-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3>{item.nombre}</h3>
                      <p>{item.descripcion || ''}</p>
                      <span className="badge badge-gray">{item.categoria || 'Sin categoría'}</span>
                    </div>
                    
                    <div style={{ textAlign: 'right', minWidth: '120px' }}>
                      {(() => {
                         const basePrice = Number(item.precio);
                         const itemDiscountPercent = Number(item.descuento || 0);
                         
                         const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                         const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
                         const isPromoDay = profileData?.dias_descuento?.some(d => normalize(d) === normalize(today));
                         const generalDiscountPercent = isPromoDay ? Number(profileData?.descuento_general || 0) : 0;
                         
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
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input 
                        name="nombre" 
                        className="form-input" 
                        placeholder="Nombre del plato" 
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
                    defaultValue={editItem?.categoria || ''} 
                    required 
                    onChange={(e) => setItemCategory(e.target.value)}
                  >
                    <option value="">Categoría</option>
                    <option value="Hamburguesas">Hamburguesas</option>
                    <option value="Pizzas">Pizzas</option>
                    <option value="Empanadas">Empanadas</option>
                    <option value="Panchos">Panchos</option>
                    <option value="Panadería">Panadería</option>
                    <option value="Helados">Helados</option>
                    <option value="Combos">Combos</option>
                    <option value="Bebidas">Bebidas</option>
                  </select>
                </div>
                <textarea name="descripcion" className="form-textarea" rows={2} placeholder="Descripción" defaultValue={editItem?.descripcion || ''} />
                
                <div className="rd-form-row rd-form-row-3">
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Precio Regular ($)</label>
                    <input name="precio" type="number" className="form-input" placeholder="Precio" step="0.01" defaultValue={editItem?.precio || ''} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Descuento Ítem (%)</label>
                    <input name="descuento" type="number" className="form-input" placeholder="Ej: 15" step="0.1" defaultValue={editItem?.descuento || 0} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Disponibilidad</label>
                    <select name="disponibilidad" className="form-select" defaultValue={editItem ? (editItem.disponibilidad ? 'true' : 'false') : 'true'}>
                      <option value="true">Disponible</option>
                      <option value="false">No disponible</option>
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
                <p style={{ textAlign: 'center', color: 'var(--gray-500)', marginBottom: 24 }}>Comisión Weep 8% • Abona tu saldo pendiente por transferencia</p>
                
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
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.85rem' }}>Comisión Total (8%)</p>
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
                        {(!profileLat || !profileLng) && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--amber-600)', fontStyle: 'italic' }}>
                            ⚠️ Ubicación no configurada en el mapa
                          </span>
                        )}
                      </div>
                    </div>
                    <input name="email" type="email" className="form-input" placeholder="Email" defaultValue={profileData.email || ''} required />
                    <input name="password" type="password" className="form-input" placeholder="Nueva contraseña (dejar vacío para no cambiar)" />
                    
                    <h3 style={{ marginTop: '24px', marginBottom: '12px', fontSize: '1.1rem', color: 'var(--gray-700)' }}>Horarios de Atención</h3>
                    <div className="rd-form-row rd-form-row-3" style={{ marginBottom: 16 }}>
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

                    <label style={{ fontSize: '0.8rem', color: 'var(--gray-500)', display: 'block', marginBottom: '8px' }}>Días de Apertura</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => {
                        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                        const dayNorm = normalize(day);
                        const isSelected = profileData.dias_apertura?.some(d => normalize(d) === dayNorm);
                        return (
                          <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--gray-100)', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input type="checkbox" name={`day_${day}`} defaultChecked={isSelected || !profileData.dias_apertura} />
                            {day}
                          </label>
                        );
                      })}
                    </div>


                    <h3 style={{ marginTop: '12px', marginBottom: '12px', fontSize: '1.1rem', color: 'var(--gray-700)' }}>Métodos de Entrega Disponibles</h3>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="checkbox" name="acepta_retiro" defaultChecked={profileData.acepta_retiro !== false} />
                        🏪 Ofrecer Retiro en Local
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="checkbox" name="acepta_envio" defaultChecked={profileData.acepta_envio !== false} />
                        🛵 Ofrecer Envío a Domicilio
                      </label>
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
                
                {showAddressSelector && (
                  <AddressSelector 
                    isLoaded={isMapLoaded}
                    initialAddress={profileAddress}
                    initialCoords={profileLat && profileLng ? { lat: profileLat, lng: profileLng } : null}
                    onConfirm={handleAddressConfirm}
                    onCancel={() => setShowAddressSelector(false)}
                    title="Ubicación de tu Local"
                    errorMsg="El local debe estar ubicado en Santo Tomé."
                  />
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 20px' }}>
        <img src="https://res.cloudinary.com/dw10wkbac/image/upload/v1775234747/gvapffe3wwp4ljgr33le.png" alt="Weep" style={{ height: '50px', objectFit: 'contain' }} />
        <p>© 2026 <strong>Weep</strong> — Panel de Locales</p>
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
  const statusColors = { Pendiente: 'badge-amber', Aceptado: 'badge-info', Listo: 'badge-blue', Entregado: 'badge-green', Rechazado: 'badge-red' };
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
