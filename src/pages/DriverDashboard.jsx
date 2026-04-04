import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { useJsApiLoader } from '@react-google-maps/api';
import { isValidEmail } from '../utils/validation';
import toast from 'react-hot-toast';
import MapComponent from '../components/MapComponent';
import './DriverDashboard.css';

const GOOGLE_MAPS_LIBRARIES = ['places'];

export default function DriverDashboard() {
  const { driver, loginAsDriver, logoutDriver } = useAuth();
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
    console.error("❌ Error loading Google Maps in DriverDashboard:", loadError);
  }

  const [authView, setAuthView] = React.useState('login');
  const [authLoading, setAuthLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showTerms, setShowTerms] = React.useState(false);
  const [showRegretModal, setShowRegretModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Dashboard state
  const [driverData, setDriverData] = React.useState(null);
  const [isActive, setIsActive] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('disponibles'); // 'disponibles', 'historial'
  const [pedidos, setPedidos] = React.useState([]);
  const [historial, setHistorial] = React.useState([]); 
  const [availableDriversCount, setAvailableDriversCount] = React.useState(0);

  const [sessionGanancias, setSessionGanancias] = React.useState(0);
  const [localInfo, setLocalInfo] = React.useState({ nombre: '', direccion: '', lat: null, lng: null });
  const [montoLocal, setMontoLocal] = React.useState(0);

  // Map state
  const [deliveryCoords, setDeliveryCoords] = React.useState({ lat: null, lng: null });
  const geocoderRef = React.useRef(null);

  // New views state
  const [view, setView] = React.useState('main'); // 'main', 'cobros', 'perfil'
  const [cobrosData, setCobrosData] = React.useState(null);
  const [cobrosLoading, setCobrosLoading] = React.useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);

  // Tutorial State
  const [showTutorial, setShowTutorial] = React.useState(false);
  const [tutorialStep, setTutorialStep] = React.useState(1);
  const [driverLocation, setDriverLocation] = React.useState({ lat: null, lng: null });
  const [tutorialOrder, setTutorialOrder] = React.useState(null);
  const [timeLeftStr, setTimeLeftStr] = React.useState('');
  const [notificationStatus, setNotificationStatus] = React.useState('loading'); // 'loading', 'granted', 'denied', 'default'
  const [isIOS, setIsIOS] = React.useState(false);
  const [isAndroid, setIsAndroid] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [showPWAInstructions, setShowPWAInstructions] = React.useState(false);

  React.useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroidDevice = /Android/.test(navigator.userAgent);
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsStandalone(isStandaloneMode);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Geolocation Watcher
  React.useEffect(() => {
    let watchId = null;
    if (isActive && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error watching location:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isActive]);

  // Modals state
  const [showEntregaModal, setShowEntregaModal] = React.useState(false);
  const [showChatModal, setShowChatModal] = React.useState(false);
  const [activeChatPedidoId, setActiveChatPedidoId] = React.useState(null);
  const [chatMessages, setChatMessages] = React.useState([]);
  const [chatInput, setChatInput] = React.useState('');
  const [pinInput, setPinInput] = React.useState('');
  const [showMap, setShowMap] = React.useState(false);

  // Sesion Timer Effect
  React.useEffect(() => {
    let timerId;
    if (isActive && driverData?.SesionVenceEn) {
      const updateTimer = () => {
        const diff = new Date(driverData.SesionVenceEn).getTime() - Date.now();
        if (diff <= 0) {
          setTimeLeftStr('Expirada');
          setIsActive(false);
          setDriverData(prev => ({...prev, Estado: 'Inactivo'}));
        } else {
          const mins = Math.floor(diff / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          setTimeLeftStr(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
        }
      };
      updateTimer();
      timerId = setInterval(updateTimer, 1000);
    } else {
      setTimeLeftStr('');
    }
    return () => clearInterval(timerId);
  }, [isActive, driverData?.SesionVenceEn]);

  // Realtime Chat Subscription
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

  const loadData = React.useCallback(async () => {
    try {
      if (!driver) return;
      const d = await api.repartidorGetDatos(driver.id);
      if (d?.success && d.data) {
        setDriverData(d.data);
        setIsActive(d.data.Estado === 'Activo' || d.data.Estado === 'Ocupado');
        // Sync email confirmation state with context
        if (d.data.EmailConfirmado !== driver.emailConfirmado) {
          loginAsDriver(d.data);
        }
      }
    } catch { toast.error('Error al cargar datos'); }
  }, [driver, loginAsDriver]);

  const fetchPedidos = React.useCallback(async (silent = false) => {
    if (!driver) return;
    try {
      const res = await api.getPedidosDisponibles(driver.id);
      if (res.success) {
        const sorted = res.data.sort((a, b) => a.id.localeCompare(b.id));
        setPedidos(prev => {
          const pendientesNuevos = sorted.filter(p => p.estado === 'Pendiente');
          const pendientesViejos = prev.filter(p => p.estado === 'Pendiente');
          if (pendientesNuevos.length > pendientesViejos.length) {
            api.playNotificationSound();
          }
          return sorted;
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, [driver]);

  const checkAvailability = React.useCallback(async () => {
    if (!driver) return;
    try {
      const count = await api.getRepartidoresActivosCount(driver.id);
      setAvailableDriversCount(count);
    } catch (err) {
      console.error("Error checking availability:", err);
    }
  }, [driver]);

  // On Login/Load
  React.useEffect(() => {
    if (driver) {
      loadData();
      
      // ─── Sync OneSignal ID ───
      if (window.OneSignalDeferred) {
        window.OneSignalDeferred.push(async (OneSignal) => {
          try {
            console.log("🔔 OneSignal: Checking subscription for driver...");
            
            const updateStatus = () => {
              const perm = OneSignal.Notifications.permission;
              setNotificationStatus(perm ? 'granted' : (OneSignal.Notifications.permissionNative === 'denied' ? 'denied' : 'default'));
            };

            updateStatus();

            // 1. Initial Sync
            const currentSubscription = OneSignal.User.PushSubscription;
            if (currentSubscription.id) {
              console.log("🔔 OneSignal Current ID:", currentSubscription.id);
              await api.repartidorUpdateOneSignalId(driver.id, currentSubscription.id);
              console.log("✅ OneSignal ID synced to database.");
            }

            // 2. Listeners for changes (e.g. user clears cache/re-registers)
            OneSignal.Notifications.addEventListener("permissionChange", (permission) => {
              console.log("🔔 OneSignal Permission changed:", permission);
              updateStatus();
            });

            OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
              const newId = event.current.id;
              if (newId) {
                console.log("🔔 OneSignal ID changed:", newId);
                await api.repartidorUpdateOneSignalId(driver.id, newId);
              }
            });

            // 3. Prompt logic (Refined for Safari)
            // On iOS/Safari, autoprompting is blocked. We rely on the UI banner.
            // On other platforms, we can try to prompt if active.
            if (!isIOS && OneSignal.Notifications.permissionNative === 'default' && isActive) {
              console.log("🔔 OneSignal: Autoprompting (Non-iOS)...");
              await OneSignal.Notifications.requestPermission();
            }

          } catch (err) {
            console.error("❌ OneSignal Sync Error:", err);
          }
        });
      }

      // Check if tutorial was already seen
      const hasSeenTutorial = localStorage.getItem(`tutorial_seen_driver_${driver.id}`);
      if (!hasSeenTutorial) {
        setShowTutorial(true);
        setTutorialStep(1);
        localStorage.setItem(`tutorial_seen_driver_${driver.id}`, 'true');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver]);

  // Polling para pedidos disponibles y Heartbeat
  React.useEffect(() => {
    let interval;
    let heartbeatInterval;
    let hadInteraction = true; // assume true initially

    const handleInteraction = () => {
      hadInteraction = true;
    };

    if (driver && isActive) {
      window.addEventListener('mousemove', handleInteraction);
      window.addEventListener('touchstart', handleInteraction);
      window.addEventListener('scroll', handleInteraction);

      // First fetch
      fetchPedidos();
      checkAvailability();
      
      // Polling de pedidos cada 30 segundos
      interval = setInterval(() => {
        fetchPedidos();
        checkAvailability();
      }, 30000);

      heartbeatInterval = setInterval(async () => {
        api.repartidorUpdateHeartbeat(driver.id, hadInteraction);
        hadInteraction = false; // Reset for next minute
        
        // Sincronizar estado real con la BD. Si el CRON lo apagó, se actualizará el estado
        try {
          const d = await api.repartidorGetDatos(driver.id);
          if (d?.success && d.data) {
            if (d.data.Estado === 'Inactivo') {
              toast.error('Fuiste desconectado del sistema automáticamente por inactividad o métricas.');
              setIsActive(false);
              setDriverData(d.data);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 60000);
      
      // Actualización inmediata al activar
      api.repartidorUpdateHeartbeat(driver.id, true);
    } else {
      setPedidos([]);
    }

    return () => {
      clearInterval(interval);
      clearInterval(heartbeatInterval);
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
    };
  }, [driver, isActive, fetchPedidos, checkAvailability]);

  // Manejo de cierre de pestaña / Navegación fuera
  React.useEffect(() => {
    const handleUnload = () => {
      if (isActive && driver) {
        // Usar fetch con keepalive para asegurar que la petición se complete
        // incluso si la pestaña se cierra.
        const url = `${api.SUPABASE_URL}/rest/v1/repartidores?id=eq.${driver.id}`;
        const now = new Date().toISOString();
        fetch(url, {
          method: 'PATCH',
          headers: {
            'apikey': api.SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ 
            estado: 'Inactivo', 
            ultima_actividad: now
          }),
          keepalive: true
        });
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [driver, isActive]);

  // Carga de datos del local para viaje en curso
  React.useEffect(() => {
    if (!isMapLoaded) return;

    const enViaje = pedidos.find(p => p.estado === 'Confirmado' || p.estado === 'Retirado');
    if (enViaje) {
      // 1. Cargar datos del local
      if (enViaje.local_id) {
        Promise.all([
          api.getLocalDatos(enViaje.local_id),
          api.getMontoLocalPedido(enViaje.id, enViaje.local_id)
        ]).then(([lData, monto]) => {
          if (lData) {
            setLocalInfo({ 
              nombre: lData.nombre, 
              direccion: lData.direccion,
              lat: lData.lat,
              lng: lData.lng
            });

            // Si el local no tiene coordenadas, intentar geocodificar (FALLBACK)
            if (!lData.lat || !lData.lng) {
              geocodeAndSave(lData.direccion, 'local', enViaje.local_id);
            }
          }
          setMontoLocal(monto || 0);
        }).catch(e => console.error(e));
      }

      // 2. Manejar coordenadas de entrega (estrictamente desde pedidos_general)
      if (enViaje.lat && enViaje.lng) {
        setDeliveryCoords({ lat: enViaje.lat, lng: enViaje.lng });
      } else {
        // Si no existen, intentar geocodificar (FALLBACK)
        geocodeAndSave(enViaje.direccion, 'pedido', enViaje.id);
      }
    } else {
      setLocalInfo({ nombre: '', direccion: '', lat: null, lng: null });
      setDeliveryCoords({ lat: null, lng: null });
      setMontoLocal(0);
    }
  }, [pedidos, isMapLoaded]);

  const geocodeAndSave = (address, type, id) => {
    if (!address || !window.google) return;
    
    const fullAddress = `${address}, Santo Tomé, Corrientes, Argentina`;
    
    if (!geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }

    geocoderRef.current.geocode({ 
      address: fullAddress,
      componentRestrictions: { country: 'AR' }
    }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const { lat, lng } = results[0].geometry.location;
        const latVal = lat();
        const lngVal = lng();

        // VALIDACIÓN: Solo guardar si está en Santo Tomé (aprox)
        const isSafe = latVal <= -28.4 && latVal >= -28.7 && lngVal <= -55.9 && lngVal >= -56.2;
        
        if (isSafe) {
          if (type === 'local') {
            setLocalInfo(prev => ({ ...prev, lat: latVal, lng: lngVal }));
            api.updateLocalCoords(id, latVal, lngVal).catch(console.error);
          } else {
            setDeliveryCoords({ lat: latVal, lng: lngVal });
            api.updatePedidoCoords(id, latVal, lngVal).catch(console.error);
          }
        } else {
          console.warn('Geocoding result outside Santo Tomé bounds, ignoring:', latVal, lngVal);
        }
      }
    });
  };

  // ─── AUTH ACTIONS ───
  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setAuthLoading(true);
    try {
      const d = await api.repartidorLogin(fd.get('email'), fd.get('password'));
      if (d?.success && d.data) {
        loginAsDriver(d.data);
        toast.success('¡Bienvenido!');
      } else toast.error(d?.error || 'Credenciales incorrectas');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (!driverData?.Email) return;
    const loading = toast.loading('Reenviando email...');
    try {
      const res = await api.reenviarEmailConfirmacion(driverData.Email, 'repartidor');
      if (res.success) toast.success('¡Email reenviado!', { id: loading });
      else toast.error(res.error || 'Error al reenviar', { id: loading });
    } catch { toast.error('Error de conexión', { id: loading }); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!isValidEmail(fd.get('email'))) { toast.error('Ingresá un email válido'); return; }
    setAuthLoading(true);
    try {
      const d = await api.repartidorRegister({
        nombre: fd.get('nombre'), telefono: fd.get('telefono'),
        email: fd.get('email'), password: fd.get('password'),
        patente: fd.get('patente').toUpperCase(), marcaModelo: fd.get('marcaModelo'),
        termsAccepted: fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
        privacyAccepted: fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
      });
      if (d?.success) {
        toast.success('¡Registro exitoso! Iniciá sesión.');
        setAuthView('login');
      } else toast.error(d?.error || 'Error al registrar');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const loadCobros = async () => {
    if (!driver) return;
    setCobrosLoading(true);
    try {
      const d = await api.repartidorGetCobros(driver.id);
      if (d.success) setCobrosData(d);
    } catch { toast.error('Error al cargar cobros'); }
    setCobrosLoading(false);
  };

  const handleSolicitarCobro = async (monto) => {
    try {
      setCobrosLoading(true);
      const res = await api.repartidorSolicitarCobro(driver.id, monto);
      if (res.success) {
        toast.success('Solicitud enviada');
        loadCobros();
      } else {
        toast.error(res.error || 'Error al solicitar');
      }
    } catch { toast.error('Error de red'); }
    setCobrosLoading(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!isValidEmail(fd.get('email'))) { toast.error('Ingresá un email válido'); return; }
    
    const file = fd.get('foto');
    const selectedDays = [];
    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(day => {
      if (fd.get(`day_${day}`) === 'on') selectedDays.push(day);
    });

    const loading = toast.loading('Guardando perfil...');
    try {
      let fotoUrl = driverData?.FotoUrl || '';
      if (file && (file instanceof File || file instanceof Blob) && file.size > 0) {
        fotoUrl = await api.uploadImage(file);
      }
      
      const params = {
        driverId: driver.id,
        nombre: fd.get('nombre'),
        telefono: fd.get('telefono'),
        email: fd.get('email'),
        patente: fd.get('patente'),
        marca_modelo: fd.get('marca_modelo'),
        horario_apertura: fd.get('horario_apertura'),
        horario_cierre: fd.get('horario_cierre'),
        dias_apertura: selectedDays,
        foto_url: fotoUrl
      };
      
      const pass = fd.get('password');
      if (pass) params.password = pass;

      await api.repartidorUpdatePerfil(params);
      toast.success('Perfil actualizado', { id: loading });
      loadData();
      setView('main');
    } catch (err) { 
      toast.error('Error: ' + err.message, { id: loading }); 
    }
  };

  const toggleEstado = async () => {
    const newState = isActive ? 'Inactivo' : 'Activo';
    setIsActive(!isActive);
    try {
      const d = await api.repartidorActualizarEstado(driver.id, newState);
      if (!d.success) { setIsActive(isActive); toast.error('No se pudo actualizar'); }
      else {
        toast.success(`Modo ${newState}`);
        if (newState === 'Activo') {
          iniciarGPS();
        }
        loadData(); // To fetch new SesionVenceEn
      }
    } catch { setIsActive(isActive); toast.error('Error de conexión'); }
  };

  const extenderSesion = async () => {
    const loading = toast.loading('Extendiendo sesión...');
    try {
      const res = await api.repartidorRenovarSesion(driver.id, 30);
      if (res.success) {
        toast.success('Sesión extendida 30 min', { id: loading });
        loadData();
      } else {
        toast.error('Error al extender', { id: loading });
      }
    } catch { toast.error('Error de red', { id: loading }); }
  };

  const handleLogout = () => {
    logoutDriver();
    setDriverData(null);
    setIsActive(false);
    toast.success('Sesión cerrada');
  };

  const iniciarGPS = () => {
    if ('geolocation' in navigator) {
      toast.loading('Iniciando GPS...', { id: 'gps-init' });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDriverLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          toast.success('GPS activado correctamente', { id: 'gps-init' });
        },
        (err) => {
          console.error("GPS Error:", err);
          let msg = 'No se pudo activar GPS';
          if (err.code === 1) msg = 'Permiso de ubicación denegado';
          else if (err.code === 2) msg = 'Ubicación no disponible';
          else if (err.code === 3) msg = 'Tiempo de espera agotado';
          toast.error(msg, { id: 'gps-init' });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      toast.error('Tu navegador no soporta GPS');
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
    if (!window.confirm('¿Confirmas que ya RETIRASTE el pedido del local?')) return;
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
        setSessionGanancias(prev => prev + 1800);
        setHistorial([{ ...pedido, fecha: new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }, ...historial]);
        setDriverData(prev => ({ ...prev, PedidosHoy: (prev?.PedidosHoy || 0) + 1 }));
        setShowEntregaModal(false);
        setPinInput('');
        setActiveTab('historial');
        fetchPedidos();
      } else {
        toast.error(res.error || 'Error', { id: 'ent' });
      }
    } catch { toast.error('Error de conexión', { id: 'ent' }); }
  };

  const rechazarPedido = async (pedidoId) => {
    if (!window.confirm('¿Estás seguro de que quieres RECHAZAR este pedido? Se buscará otro repartidor disponible.')) return;
    
    const tid = toast.loading('Reasignando pedido...');
    try {
      const res = await api.repartidorRechazarPedido(pedidoId, driver.id);
      if (res.success) {
        toast.success(`Pedido rechazado. Reasignado a: ${res.nuevoRepartidor || 'otro repartidor'}`, { id: tid });
        fetchPedidos();
        checkAvailability();
      } else {
        toast.error(res.error || 'No se pudo rechazar el pedido', { id: tid });
      }
    } catch (err) {
      toast.error('Error de conexión', { id: tid });
    }
  };

  const handleTutorialNext = () => {
    if (tutorialStep === 1) {
      setTutorialOrder({
        id: 'PEDIDO-PRUEBA-01',
        estado: 'Pendiente',
        direccion: 'Calle Falsa 123, Santo Tomé',
        nombre_cliente: 'Cliente de Prueba',
        pago: 'Efectivo',
        monto: 2500,
        envio: 'Con Envío',
        local_id: 'local-tutorial',
        lat: -28.549,
        lng: -56.032
      });
      setTutorialStep(2);
      // Mark as seen as soon as they start step 1
      if (driver?.id) {
        localStorage.setItem(`tutorial_seen_driver_${driver.id}`, 'true');
      }
    }
    else if (tutorialStep === 2) {
      if (tutorialOrder?.estado === 'Confirmado') setTutorialStep(3);
      else toast('Primero debes aceptar el pedido de prueba');
    }
    else if (tutorialStep === 3) {
      if (tutorialOrder?.estado === 'Retirado') setTutorialStep(4);
      else toast('Primero debes retirar el pedido (Botón Rojo)');
    }
    else if (tutorialStep === 4) {
      if (!tutorialOrder) setTutorialStep(5);
      else toast('Primero debes completar la entrega (PIN)');
    }
    else if (tutorialStep === 5) {
      setShowTutorial(false);
      setTutorialOrder(null);
      localStorage.setItem(`tutorial_seen_driver_${driver.id}`, 'true');
    }
  };

  const openChat = async (pedidoId) => {
    setActiveChatPedidoId(pedidoId);
    setShowChatModal(true);
    setChatMessages([]);
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
      await api.sendChatMessage(activeChatPedidoId, driver.id, msg);
    } catch { toast.error('Error al enviar mensaje'); }
  };

  // ─── RENDERS ───
  const renderAuth = () => (
    <div className="dd-auth-card card animate-fade-in">
      <div className="card-body">
        <h2>Acceso Repartidor</h2>
        <div className="rd-auth-tabs">
          <button className={`btn ${authView === 'login' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setAuthView('login'); setShowPassword(false); }}>Iniciar Sesión</button>
          <button className={`btn ${authView === 'register' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setAuthView('register'); setShowPassword(false); }}>Registrarme</button>
        </div>
        {authView === 'login' ? (
          <form onSubmit={handleLogin} className="dd-form" key="login">
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
              {authLoading ? <span className="spinner spinner-white" /> : 'Iniciar Sesión'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="dd-form" key="register">
            <input name="email" type="email" className="form-input" placeholder="Email (Este será tu usuario)" required autoComplete="username" />
            <input name="nombre" className="form-input" placeholder="Nombre completo" required autoComplete="name" />
            <input name="telefono" type="tel" className="form-input" placeholder="Teléfono (ej: +54911...)" required autoComplete="tel" />
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
            <input name="patente" className="form-input" placeholder="Patente de la moto" required />
            <input name="marcaModelo" className="form-input" placeholder="Marca y modelo" required />

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px', textAlign: 'left' }}>
              {authView === 'register' && (
                <input type="checkbox" id="terms_accepted" name="terms_accepted" required style={{ width: 'auto', marginTop: '4px' }} />
              )}
              <label htmlFor="terms_accepted" style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
                {authView === 'register' ? (
                  <>
                    Acepto los <button type="button" style={{ background: 'none', border: 'none', color: 'var(--red-500)', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setShowTerms(true)}>Términos y Condiciones y Política de Privacidad</button> para Repartidores.
                  </>
                ) : (
                  <span>Términos y Condiciones y Política de Privacidad para Repartidores.</span>
                )}
              </label>
            </div>

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
    const enViajeReal = pedidos.find(p => p.estado === 'Confirmado' || p.estado === 'Retirado');
    const enViajeTutorial = tutorialOrder && (tutorialOrder.estado === 'Confirmado' || tutorialOrder.estado === 'Retirado');
    const enViaje = enViajeTutorial ? tutorialOrder : enViajeReal;

    if (enViaje) {
      const isTutorial = enViaje.id.includes('PRUEBA');
      const isRetirado = enViaje.estado === 'Retirado';
      
      const localNombre = isTutorial ? 'Restaurante Tutorial' : localInfo.nombre;
      const localDir = isTutorial ? 'Av. San Martín 456' : localInfo.direccion;
      const localLat = isTutorial ? -28.555 : localInfo.lat;
      const localLng = isTutorial ? -56.038 : localInfo.lng;
      const montoMostrar = isTutorial ? 2000 : montoLocal;

      const mapLink = isTutorial 
        ? '#' 
        : (!isRetirado 
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${localInfo.direccion}, Santo Tomé, Corrientes`)}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${enViaje.direccion}, Santo Tomé, Corrientes`)}`);

      return (
        <div className="dd-simple-card animate-slide-up">
          <div className="dd-simple-header">
            <h4>Pedido #{enViaje.id.split('-').pop()}</h4>
            <div className="dd-status-badge">{enViaje.estado}</div>
          </div>
          
          <div className="dd-simple-body">
            {!isRetirado ? (
              <>
                {/* RETIRO */}
                <div className="dd-section-title">📍 Punto de Retiro</div>
                <div className="dd-info-block">
                  <div className="dd-info-row">
                    <span className="dd-info-label">Local</span>
                    <span className="dd-info-value">{localNombre || 'Cargando...'}</span>
                  </div>
                  <div className="dd-info-row">
                    <span className="dd-info-label">Dirección</span>
                    <span className="dd-info-value">{localDir || 'Cargando...'}</span>
                  </div>
                  <div className="dd-info-row">
                    <span className="dd-info-label">Efectivo a pagar al local</span>
                    <span className="dd-info-value monto">
                      {enViaje.pago === 'Efectivo' ? `$${Number(montoMostrar).toLocaleString('es-AR')}` : '$0 (Ya Pago)'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ENTREGA */}
                <div className="dd-section-title">🏁 Punto de Entrega</div>
                <div className="dd-info-block">
                  <div className="dd-info-row">
                    <span className="dd-info-label">Cliente</span>
                    <span className="dd-info-value">{enViaje.nombre_cliente || 'Cliente'}</span>
                  </div>
                  <div className="dd-info-row">
                    <span className="dd-info-label">Dirección</span>
                    <span className="dd-info-value">{enViaje.direccion}</span>
                  </div>
                  <div className="dd-info-row">
                    <span className="dd-info-label">Efectivo a cobrar al cliente</span>
                    <span className="dd-info-value monto cobrar">
                      {enViaje.pago === 'Efectivo' ? `$${Number(enViaje.monto).toLocaleString('es-AR')}` : '$0 (Ya Pago)'}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="dd-envio-status">
              Metodo: {enViaje.pago} | Tipo: {enViaje.envio}
            </div>

            {showMap && (
              <div className="dd-map-container" style={{ marginTop: '20px' }}>
                <MapComponent 
                  isLoaded={isMapLoaded}
                  localLat={isTutorial ? localLat : localInfo.lat}
                  localLng={isTutorial ? localLng : localInfo.lng}
                  localName={localNombre}
                  deliveryLat={enViaje.lat || deliveryCoords.lat}
                  deliveryLng={enViaje.lng || deliveryCoords.lng}
                  deliveryAddress={enViaje.direccion}
                  driverLat={driverLocation.lat}
                  driverLng={driverLocation.lng}
                />
              </div>
            )}
          </div>

          <div className="dd-simple-actions">
            <div className="dd-btn-row">
              <button className="btn btn-light btn-full" onClick={() => isTutorial ? toast('Chat de simulación') : openChat(enViaje.id)}>
                💬 Chat Cliente
              </button>
              {!isRetirado ? (
                <button
                  className="dd-btn-rojo"
                  onClick={() => {
                    if (isTutorial) {
                      setTutorialOrder({ ...tutorialOrder, estado: 'Retirado' });
                      if (tutorialStep === 3) setTutorialStep(4);
                    } else {
                      retirarPedido(enViaje.id);
                    }
                  }}
                >
                  🏍️ Marcar RETIRADO
                </button>
              ) : (
                <button
                  className="dd-btn-verde dd-btn-large"
                  onClick={() => isTutorial ? setShowEntregaModal(true) : confirmarEntregaClick()}
                >
                  🚀 Marcar ENTREGADO
                </button>
              )}
            </div>
            
            <button 
              onClick={() => setShowMap(!showMap)} 
              className="dd-btn-outline" 
              style={{ marginTop: '10px' }}
            >
              📍 {showMap ? 'Ocultar mapa' : `Ver mapa del ${!isRetirado ? 'Local' : 'Cliente'}`}
            </button>
          </div>

          {showEntregaModal && (
            <div className="dd-modal-overlay">
              <div className="dd-modal-content animate-slide-down">
                <div className="dd-modal-header">
                  <h5>Prueba de Entrega</h5>
                  <button className="dd-modal-close" onClick={() => setShowEntregaModal(false)}>×</button>
                </div>
                <div className="dd-modal-body">
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>Ingresa el PIN de 4 dígitos del cliente</label>
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
                  <button className="dd-btn-verde dd-btn-large" onClick={() => {
                    if (isTutorial) {
                      if (pinInput.length === 4) {
                        toast.success('¡Excelente! Entrega de prueba completada.');
                        setTutorialOrder(null);
                        setShowEntregaModal(false);
                        setPinInput('');
                        if (tutorialStep < 5) setTutorialStep(5);
                      } else toast.error('Ingresa un PIN de 4 dígitos');
                    } else {
                      finalizarEntrega(enViaje);
                    }
                  }}>Confirmar Entrega</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // List of pending orders (Disponibles)
    const pendientesReales = pedidos.filter(p => p.estado === 'Pendiente');
    const pendientesTutorial = tutorialOrder && tutorialOrder.estado === 'Pendiente' ? [tutorialOrder] : [];
    const pendientes = [...pendientesTutorial, ...pendientesReales];
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
                <h5>Pedido #{p.id.split('-').pop()}</h5>
                <span className="dd-badge bg-warning text-dark">Pendiente</span>
              </div>
              <div className="dd-order-amount">${Number(p.monto).toLocaleString('es-AR')}</div>
              <div className="dd-order-info">
                <p>👤 <strong>Cliente:</strong> {p.nombre_cliente || 'Cliente'}</p>
                <p>📍 <strong>Destino:</strong> {p.direccion}</p>
                <p>💳 <strong>Pago:</strong> {p.pago}</p>
              </div>
              <div className="dd-order-actions">
                {esFirst ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <button 
                      className="dd-btn-rojo" 
                      onClick={() => {
                        if (p.id.includes('PRUEBA')) {
                          setTutorialOrder({ ...tutorialOrder, estado: 'Confirmado' });
                          toast.success('¡Pedido aceptado! Ahora búscalo en el local.');
                          if (tutorialStep === 2) setTutorialStep(3);
                        } else {
                          aceptarPedido(p.id);
                        }
                      }}
                    >
                      Aceptar pedido →
                    </button>
                    {p.id.includes('PRUEBA') ? (
                      <button className="dd-btn-outline" onClick={() => toast('No se puede rechazar en el tutorial')}>✖ Rechazar Pedido</button>
                    ) : (
                      <button 
                        className="dd-btn-outline" 
                        onClick={() => rechazarPedido(p.id)}
                        disabled={availableDriversCount < 1}
                        title={availableDriversCount < 1 ? "No hay otros repartidores disponibles para tomar este pedido" : ""}
                      >
                        ✖ Rechazar Pedido
                      </button>
                    )}
                    {!p.id.includes('PRUEBA') && availableDriversCount < 1 && (
                      <small style={{ fontSize: '0.75rem', color: 'var(--red-500)', textAlign: 'center' }}>
                        No hay otros repartidores disponibles.
                      </small>
                    )}
                  </div>
                ) : (
                  <small style={{ color: 'var(--gray-500)', textAlign: 'center', display: 'block' }}>Debes aceptar el pedido más antiguo primero.</small>
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
              <small style={{ color: 'var(--gray-500)' }}>{h.fecha}</small>
              <span className="dd-badge bg-success">Entregado</span>
            </div>
            <p style={{ margin: '8px 0', fontWeight: 'bold' }}>{h.direccion}</p>
            <div className="dd-order-amount" style={{ margin: 0 }}>${Number(h.monto).toLocaleString('es-AR')}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderCobros = () => {
    if (cobrosLoading && !cobrosData) return <div className="spinner-container" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><span className="spinner" /></div>;
    
    return (
      <div className="dd-cobros-view animate-fade-in">
        <div className="dd-card-header" style={{ marginBottom: '24px' }}>
          <h3>Gestión de Cobros</h3>
          <p style={{ color: 'var(--gray-600)' }}>Retirá tus ganancias acumuladas por pagos con transferencia.</p>
        </div>

        <div className="dd-stats-grid" style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          <div className="dd-stat-item highlight" style={{ background: 'var(--red-50)', border: '1px solid var(--red-200)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <small style={{ color: 'var(--gray-600)', display: 'block', marginBottom: '8px', fontSize: '1rem' }}>Saldo a Cobrar</small>
            <strong style={{ fontSize: '2.5rem', color: 'var(--red-600)' }}>${Number(cobrosData?.totalDisponible || 0).toLocaleString('es-AR')}</strong>
          </div>
        </div>

        <button 
          className="dd-btn-rojo dd-btn-large" 
          disabled={!cobrosData?.totalDisponible || cobrosData.totalDisponible <= 0 || cobrosLoading}
          onClick={() => handleSolicitarCobro(cobrosData.totalDisponible)}
        >
          {cobrosLoading ? 'Procesando...' : 'Solicitar Cobro'}
        </button>

        <div className="dd-history-section" style={{ marginTop: 32 }}>
          <h4 style={{ marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Historial de Solicitudes</h4>
          {cobrosData?.historial?.length === 0 ? (
            <p className="empty-msg" style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '20px' }}>No hay solicitudes previas.</p>
          ) : (
            <div className="dd-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cobrosData?.historial?.map((h, i) => (
                <div className="dd-history-item" key={i} style={{ background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="dd-history-info">
                    <span className="dd-date" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--gray-500)' }}>{new Date(h.fechaSolicitud).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</span>
                    <span className="dd-amount" style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>${Number(h.montoNeto).toLocaleString('es-AR')}</span>
                  </div>
                  <span className={`dd-badge status-${h.estado.toLowerCase()}`} style={{ 
                    padding: '4px 12px', 
                    borderRadius: '20px', 
                    fontSize: '0.8rem', 
                    fontWeight: 'bold',
                    backgroundColor: h.estado === 'Pagado' ? '#e6fffa' : '#fff7ed',
                    color: h.estado === 'Pagado' ? '#047481' : '#c2410c'
                  }}>{h.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPerfil = () => {
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const currentDays = driverData?.DiasApertura || [];

    return (
      <div className="dd-perfil-view animate-fade-in" style={{ paddingBottom: '40px' }}>
        <form onSubmit={handleSaveProfile} className="dd-profile-form">
          <div className="dd-form-section" style={{ marginBottom: '32px' }}>
            <h4 style={{ marginBottom: '20px', color: 'var(--gray-800)', borderLeft: '4px solid var(--red-500)', paddingLeft: '12px' }}>Información Personal</h4>
            
            <div className="dd-photo-upload" style={{ textAlign: 'center', marginBottom: 24 }}>
              <div className="dd-avatar-preview" style={{ position: 'relative', display: 'inline-block' }}>
                <img src={driverData?.FotoUrl || "https://i.postimg.cc/Z5N1N0c9/user-avatar.png"} alt="Perfil" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <label className="dd-photo-edit-badge" style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--red-500)', color: 'white', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                  📷
                  <input name="foto" type="file" accept="image/*" style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Nombre Completo</label>
              <input name="nombre" className="form-input" defaultValue={driverData?.Nombre} required />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Email</label>
              <input name="email" type="email" className="form-input" defaultValue={driverData?.Email} required />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Teléfono</label>
              <input name="telefono" className="form-input" defaultValue={driverData?.Telefono} required />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Nueva Contraseña (opcional)</label>
              <input name="password" type="password" className="form-input" placeholder="Dejar vacío para no cambiar" />
            </div>
          </div>

          <div className="dd-form-section" style={{ marginBottom: '32px' }}>
            <h4 style={{ marginBottom: '20px', color: 'var(--gray-800)', borderLeft: '4px solid var(--red-500)', paddingLeft: '12px' }}>Vehículo</h4>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Patente</label>
              <input name="patente" className="form-input" defaultValue={driverData?.Patente} required />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Marca y Modelo</label>
              <input name="marca_modelo" className="form-input" defaultValue={driverData?.MarcaModelo} required />
            </div>
          </div>

          <div className="dd-form-section" style={{ marginBottom: '32px' }}>
            <h4 style={{ marginBottom: '20px', color: 'var(--gray-800)', borderLeft: '4px solid var(--red-500)', paddingLeft: '12px' }}>Disponibilidad y Horarios</h4>
            <div className="dd-time-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Desde</label>
                <input name="horario_apertura" type="time" className="form-input" defaultValue={driverData?.HorarioApertura || '09:00'} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', fontWeight: '500' }}>Hasta</label>
                <input name="horario_cierre" type="time" className="form-input" defaultValue={driverData?.HorarioCierre || '23:00'} />
              </div>
            </div>
            
            <div className="dd-days-selector">
              <label style={{ display: 'block', marginBottom: 12, fontSize: '0.9rem', fontWeight: '500' }}>Días Activo</label>
              <div className="dd-days-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {diasSemana.map(day => (
                  <label key={day} className="dd-day-chip" style={{ 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '20px',
                    background: currentDays.includes(day) ? 'var(--red-500)' : '#f3f4f6',
                    color: currentDays.includes(day) ? 'white' : 'var(--gray-600)',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}>
                    <input type="checkbox" name={`day_${day}`} defaultChecked={currentDays.includes(day)} style={{ display: 'none' }} />
                    <span>{day.substring(0, 3)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="dd-profile-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button type="submit" className="dd-btn-rojo dd-btn-large">Guardar Cambios</button>
            <button type="button" className="dd-btn-outline dd-btn-large" onClick={() => setView('main')}>Cancelar</button>
          </div>
        </form>
      </div>
    );
  };
  const renderPWAInstructionsModal = () => {
    if (!showPWAInstructions) return null;

    return (
      <div className="dd-modal-overlay" onClick={() => setShowPWAInstructions(false)}>
        <div className="dd-modal-content animate-slide-down" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
          <div className="dd-modal-header" style={{ background: 'var(--red-600)' }}>
            <h5 style={{ color: 'white', margin: 0 }}>
              {isIOS ? '📱 Instrucciones para iPhone' : '📲 Instalar en Android'}
            </h5>
            <button className="dd-modal-close" onClick={() => setShowPWAInstructions(false)}>×</button>
          </div>
          <div className="dd-modal-body" style={{ textAlign: 'center', padding: '24px' }}>
            {isIOS ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '1rem', color: 'var(--gray-700)', lineHeight: '1.5' }}>
                  Para recibir <strong>ubicación y notificaciones</strong> correctamente en iOS, debes añadir Weep a tu inicio:
                </p>
                <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', textAlign: 'left', border: '1px solid #eee' }}>
                  <p style={{ margin: '0 0 8px 0' }}>1. Presiona el botón <strong>Compartir</strong> <img src="https://i.postimg.cc/85zPzCH7/ios-share.png" alt="share" style={{ height: '20px', verticalAlign: 'middle' }} /> abajo en Safari.</p>
                  <p style={{ margin: '0 0 8px 0' }}>2. Desliza hacia abajo y selecciona <strong>"Añadir a la pantalla de inicio"</strong>.</p>
                  <p style={{ margin: 0 }}>3. Abre la aplicación desde el nuevo icono en tu pantalla.</p>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                  * Esto habilitará los permisos nativos requeridos por el sistema.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '1rem', color: 'var(--gray-700)', lineHeight: '1.5' }}>
                  Habilita la <strong>App de Repartidores</strong> para asegurar el seguimiento GPS y alertas en tiempo real.
                </p>
                
                {deferredPrompt ? (
                  <button 
                    className="dd-btn-rojo dd-btn-large" 
                    onClick={async () => {
                      deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === 'accepted') setDeferredPrompt(null);
                      setShowPWAInstructions(false);
                    }}
                  >
                    🚀 Descargar / Instalar Ahora
                  </button>
                ) : (
                  <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', textAlign: 'left', border: '1px solid #eee' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--red-600)' }}>Si no ves el botón de instalar:</p>
                    <p style={{ margin: '0 0 8px 0' }}>1. Toca los <strong>tres puntos</strong> (⋮) arriba a la derecha en Chrome.</p>
                    <p style={{ margin: 0 }}>2. Selecciona <strong>"Instalar aplicación"</strong> o "Añadir a pantalla de inicio".</p>
                  </div>
                )}
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                  Al usar la App dedicada, Android prioriza la ubicación y evita que el sistema cierre la aplicación.
                </p>
              </div>
            )}
          </div>
          <div className="dd-modal-footer">
            <button className="btn btn-secondary btn-full" onClick={() => setShowPWAInstructions(false)}>Entendido</button>
          </div>
        </div>
      </div>
    );
  };

  // ─── MAIN RENDER ───
  return (
    <div className="dd-page">
      <header className="dd-header">
        <Link to="/">
          <img src="https://res.cloudinary.com/dw10wkbac/image/upload/v1775234747/gvapffe3wwp4ljgr33le.png" alt="Weep" className="dd-logo" />
        </Link>
        <h1>Panel de Repartidores</h1>
      </header>

      <main className="dd-main">
        {driver && !driver.emailConfirmado && (
          <div className="unconfirmed-banner" style={{
            background: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
            color: '#874d00'
          }}>
            <span>⚠️ <strong>Email no confirmado:</strong> Por favor confirma tu correo.</span>
            <button 
              className="btn btn-sm" 
              style={{ background: '#faad14', color: '#fff', border: 'none' }}
              onClick={handleResendConfirmation}
            >
              Reenviar
            </button>
          </div>
        )}

        {/* ─── Banner PWA para iPhone ─── */}
        {isIOS && !isStandalone && (
          <div className="pwa-install-banner" style={{
            background: 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)',
            color: 'white',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            margin: '0 16px 20px',
            boxShadow: '0 8px 24px rgba(198, 40, 40, 0.25)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📱 Instala Weep en tu iPhone
              </h4>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.95, lineHeight: '1.4' }}>
                Para <strong>recibir pedidos</strong> en tiempo real, debes anclar la app al inicio:
                <br />
                1. Presiona el botón <img src="https://i.postimg.cc/85zPzCH7/ios-share.png" alt="compartir" style={{ height: '18px', verticalAlign: 'middle', margin: '0 2px' }} /> <strong>Compartir</strong> abajo.
                <br />
                2. Busca y elige <strong>"Añadir a la pantalla de inicio"</strong>.
                <br />
                3. Abre la app desde el icono creado.
              </p>
            </div>
            <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', fontSize: '80px', opacity: 0.1 }}>🔔</div>
          </div>
        )}

        {/* ─── Banner de Notificaciones ─── */}
        {driver && notificationStatus !== 'granted' && (
          <div className="notification-status-banner" style={{
            background: notificationStatus === 'denied' ? '#fff1f0' : '#e6f7ff',
            border: `1px solid ${notificationStatus === 'denied' ? '#ffa39e' : '#91d5ff'}`,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            margin: '0 16px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
            color: notificationStatus === 'denied' ? '#cf1322' : '#0050b3',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {notificationStatus === 'denied' ? (
                <>🚫 <strong>Notificaciones bloqueadas:</strong> No recibirás alertas de nuevos pedidos. Revisa los permisos de tu navegador.</>
              ) : (
                <>
                  {isIOS && !isStandalone ? (
                    <>🔔 <strong>Activa la App:</strong> Añade Weep al inicio para habilitar el GPS y alertas.</>
                  ) : (
                    <>🔔 <strong>Activa las notificaciones:</strong> Para recibir pedidos al instante presiona el botón.</>
                  )}
                </>
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {(isIOS || isAndroid) && !isStandalone ? (
                <button 
                  className="btn btn-outline btn-sm" 
                  style={{ whiteSpace: 'nowrap', padding: '6px 12px', background: 'white', borderColor: '#91d5ff', color: '#0050b3' }}
                  onClick={() => setShowPWAInstructions(true)}
                >
                  {isIOS ? '¿Cómo activar? 📱' : (deferredPrompt ? 'Descargar App 📲' : 'Instrucciones 📱')}
                </button>
              ) : null}
              {notificationStatus !== 'denied' && (!isIOS || isStandalone) && (
                <button 
                  className="btn btn-primary btn-sm" 
                  style={{ whiteSpace: 'nowrap', padding: '6px 12px' }}
                  onClick={() => {
                    if (window.OneSignal) {
                      window.OneSignal.Notifications.requestPermission();
                    }
                  }}
                >
                  Activar 🛎️
                </button>
              )}
            </div>
          </div>
        )}
        {renderPWAInstructionsModal()}
        {!driver ? renderAuth() : (
          <>
            <div className="dd-topbar animate-fade-in">
              <div className="dd-topbar-left">
                <div className="toggle" onClick={toggleEstado} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={isActive} readOnly />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </div>
                <span className={`dd-status ${isActive ? 'active' : ''}`}>
                  {isActive ? 'Activo (30 min)' : 'Inactivo'}
                </span>
                {isActive && timeLeftStr && (
                  <button className="btn btn-secondary btn-sm" style={{marginLeft:8, fontSize:'0.75rem', padding:'2px 6px'}} onClick={extenderSesion}>
                    ⏳ {timeLeftStr} (Extender)
                  </button>
                )}
              </div>
              <div className="dd-topbar-actions">
                <button className="btn btn-secondary btn-sm" onClick={iniciarGPS}>📍 GPS</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setProfileMenuOpen(true)}>☰ Menú</button>
              </div>
            </div>

            <div className="dd-tab-content" style={{ marginTop: '20px' }}>
              {view === 'main' && (
                <>
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
                      <div className="dd-stat-item" style={{ gridColumn: 'span 2' }}>
                        <small>Tasa de Aceptación</small>
                        <strong>
                          {driverData ? (
                            (() => {
                              const a = driverData.PedidosAceptados || 0;
                              const r = driverData.PedidosRechazados || 0;
                              const i = driverData.PedidosIgnorados || 0;
                              const total = a + r + i;
                              if (total === 0) return '100% ⭐';
                              return Math.round((a / total) * 100) + '% ⭐';
                            })()
                          ) : '...'}
                        </strong>
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
                  {activeTab === 'disponibles' ? renderDisponibles() : renderHistorial()}
                </>
              )}
              {view === 'cobros' && renderCobros()}
              {view === 'perfil' && renderPerfil()}
            </div>
          </>
        )}
      </main>

      {/* Tutorial Overlay */}
      {showTutorial && (
        <div 
          className={(tutorialStep >= 2 && tutorialStep <= 4) ? "dd-tutorial-step-wrapper" : "dd-modal-overlay"} 
          style={(tutorialStep >= 2 && tutorialStep <= 4) ? {
            position: 'fixed',
            top: 0, left: 0, width: '100%', height: '100%',
            pointerEvents: 'none',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '20px'
          } : {}}
        >
          <div 
            className={(tutorialStep >= 2 && tutorialStep <= 4) ? "dd-tutorial-card-floating animate-slide-up" : "dd-modal-content animate-slide-down"} 
            style={
              (tutorialStep >= 2 && tutorialStep <= 4) ? {
                pointerEvents: 'auto',
                width: '100%',
                maxWidth: '450px',
                background: 'white',
                borderRadius: '20px',
                boxShadow: '0 -4px 30px rgba(0,0,0,0.2)',
                border: '3px solid var(--red-600)',
                overflow: 'hidden'
              } : {}
            } 
            onClick={e => e.stopPropagation()}
          >
            <div className="dd-tutorial-body" style={{ padding: (tutorialStep >= 2 && tutorialStep <= 4) ? '20px' : '30px', textAlign: 'center' }}>
              {tutorialStep === 1 && (
                <>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>¡Bienvenido al Panel de Repartidores! 🏍️</h3>
                  <p style={{ color: 'var(--gray-600)', lineHeight: '1.6' }}>Aquí gestionarás tus entregas y ganancias de forma rápida y sencilla.</p>
                </>
              )}
              {tutorialStep === 2 && (
                <>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: 'var(--red-600)', fontWeight: 800 }}>PASO 2: ACEPTAR PEDIDO</h3>
                  <p style={{ color: 'var(--gray-700)', fontSize: '0.95rem', lineHeight: '1.4' }}>He generado un pedido de prueba abajo. 👋 Presiona el botón rojo <strong>"Aceptar pedido →"</strong> para comenzar.</p>
                </>
              )}
              {tutorialStep === 3 && (
                <>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: 'var(--red-600)', fontWeight: 800 }}>PASO 3: RETIRAR DEL LOCAL</h3>
                  <p style={{ color: 'var(--gray-700)', fontSize: '0.95rem', lineHeight: '1.4' }}>¡Confirmado! Ahora dirígete al local y una vez tengas el paquete presiona <strong>"🏍️ Marcar RETIRADO"</strong>.</p>
                </>
              )}
              {tutorialStep === 4 && (
                <>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: 'var(--red-600)', fontWeight: 800 }}>PASO 4: ENTREGAR AL CLIENTE</h3>
                  <p style={{ color: 'var(--gray-700)', fontSize: '0.95rem', lineHeight: '1.4' }}>Ve a la dirección del cliente, presiona <strong>"🚀 Marcar ENTREGADO"</strong> e ingresa el PIN de 4 dígitos.</p>
                </>
              )}
              {tutorialStep === 5 && (
                <>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>¡Todo listo!</h3>
                  <p style={{ color: 'var(--gray-600)', lineHeight: '1.6' }}>Mantén siempre la app abierta y el GPS activo mientras estés de turno. ¡Buen viaje!</p>
                </>
              )}
            </div>
            <div className="dd-tutorial-footer" style={{ padding: (tutorialStep >= 2 && tutorialStep <= 4) ? '0 20px 20px' : '0 30px 30px' }}>
              <button 
                className="dd-btn-rojo dd-btn-large" 
                onClick={handleTutorialNext}
                disabled={tutorialStep >= 2 && tutorialStep <= 4}
                style={{ 
                  opacity: (tutorialStep >= 2 && tutorialStep <= 4) ? 0.3 : 1,
                  fontSize: (tutorialStep >= 2 && tutorialStep <= 4) ? '0.8rem' : '1rem',
                  height: (tutorialStep >= 2 && tutorialStep <= 4) ? '40px' : 'auto',
                  display: (tutorialStep >= 2 && tutorialStep <= 4) ? 'none' : 'block'
                }}
              >
                {tutorialStep === 5 ? '¡Entendido!' : 'Siguiente'}
              </button>
              {tutorialStep === 1 && (
                <button 
                  className="dd-btn-outline dd-btn-large" 
                  style={{ marginTop: '10px' }}
                  onClick={() => {
                    setShowTutorial(false);
                    if (driver?.id) {
                      localStorage.setItem(`tutorial_seen_driver_${driver.id}`, 'true');
                    }
                  }}
                >
                  Saltar Tutorial
                </button>
              )}
              {(tutorialStep >= 2 && tutorialStep <= 4) && (
                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--gray-500)', fontWeight: 600 }}>
                  ⚡ Realiza la acción en el pedido para continuar
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Sidebar/Menu */}
      {driver && profileMenuOpen && (
        <div className="dd-sidebar-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1500 }} onClick={() => setProfileMenuOpen(false)}>
          <div className="dd-sidebar animate-slide-right" style={{ background: 'white', width: '280px', height: '100%', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="dd-sidebar-header" style={{ padding: '30px 20px', background: 'var(--gray-50)', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <img src={driverData?.FotoUrl || "https://i.postimg.cc/Z5N1N0c9/user-avatar.png"} alt="Avatar" className="dd-user-avatar" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--red-500)' }} />
              <div className="dd-user-info">
                <strong style={{ display: 'block', fontSize: '1.1rem' }}>{driverData?.Nombre}</strong>
                <small style={{ color: 'var(--gray-500)' }}>{driverData?.Email}</small>
              </div>
            </div>
            <nav className="dd-sidebar-nav" style={{ flex: 1, padding: '20px 0' }}>
              <button className={`dd-nav-item ${view === 'main' ? 'active' : ''}`} style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: view === 'main' ? 'var(--red-50)' : 'transparent', color: view === 'main' ? 'var(--red-600)' : 'var(--gray-700)', fontWeight: view === 'main' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={() => { setView('main'); setProfileMenuOpen(false); }}>
                🏁 Mis Entregas
              </button>
              <button className={`dd-nav-item ${view === 'cobros' ? 'active' : ''}`} style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: view === 'cobros' ? 'var(--red-50)' : 'transparent', color: view === 'cobros' ? 'var(--red-600)' : 'var(--gray-700)', fontWeight: view === 'cobros' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={() => { setView('cobros'); loadCobros(); setProfileMenuOpen(false); }}>
                💰 Gestión Cobros
              </button>
              <button className={`dd-nav-item ${view === 'perfil' ? 'active' : ''}`} style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: view === 'perfil' ? 'var(--red-50)' : 'transparent', color: view === 'perfil' ? 'var(--red-600)' : 'var(--gray-700)', fontWeight: view === 'perfil' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={() => { setView('perfil'); setProfileMenuOpen(false); }}>
                👤 Editar Perfil
              </button>
              <button className="dd-nav-item" style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: 'transparent', color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={() => { setShowTutorial(true); setTutorialStep(1); setProfileMenuOpen(false); }}>
                📖 Ver Tutorial
              </button>
              <div style={{ margin: '20px 0', height: '1px', background: '#eee' }}></div>
              <button className="dd-nav-item text-red" style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: 'transparent', color: 'var(--red-600)', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={handleLogout}>
                🚪 Cerrar Sesión
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && (
        <div className="dd-modal-overlay" onClick={() => { setShowChatModal(false); setActiveChatPedidoId(null); }}>
          <div className="dd-modal-content animate-slide-down" onClick={e => e.stopPropagation()} style={{ height: '500px' }}>
            <div className="dd-modal-header">
              <h5>Chat con Cliente</h5>
              <button className="dd-modal-close" onClick={() => { setShowChatModal(false); setActiveChatPedidoId(null); }}>×</button>
            </div>
            <div className="dd-modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--gray-400)', margin: 'auto' }}>Inicia la conversación con el cliente</div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} style={{ 
                    textAlign: msg.sender_id === driver.id ? 'right' : 'left',
                    marginBottom: '8px'
                  }}>
                    <div style={{ 
                      background: msg.sender_id === driver.id ? 'var(--red-600)' : '#f0f0f0', 
                      color: msg.sender_id === driver.id ? 'white' : 'black', 
                      padding: '8px 12px', 
                      borderRadius: '12px', 
                      display: 'inline-block',
                      maxWidth: '80%',
                      fontSize: '0.9rem',
                      lineHeight: '1.4'
                    }}>
                      {msg.message}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '2px' }}>
                      {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </div>
                  </div>
                ))
              )}
            </div>
            <form className="dd-modal-footer" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="dd-chat-input"
                placeholder="Escribe aquí..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button type="submit" className="dd-btn-rojo" style={{ width: 'auto', padding: '10px 16px' }}>Enviar</button>
            </form>
          </div>
        </div>
      )}

      <footer className="footer" style={{ background: 'var(--red-800)', color: 'white', borderTop: 'none', padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <img src="https://res.cloudinary.com/dw10wkbac/image/upload/v1775234747/gvapffe3wwp4ljgr33le.png" alt="Weep" style={{ height: '50px', objectFit: 'contain' }} />
        <p style={{ margin: 0 }}>© 2026 Weep - Todos los derechos reservados</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: 0 }}>PWA optimizada para uso en moto • GPS en tiempo real</p>
        <button 
          onClick={() => setShowTerms(true)} 
          style={{ background: 'none', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.9 }}
        >
          Ver Términos y Condiciones
        </button>
        <button 
          onClick={() => setShowRegretModal(true)} 
          style={{ background: 'none', border: 'none', color: '#ffb3b3', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
        >
          Botón de Arrepentimiento
        </button>
      </footer>

      {showRegretModal && (
        <div className="dd-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => setShowRegretModal(false)}>
          <div className="dd-modal-content animate-slide-down" style={{ background: 'white', padding: '24px', borderRadius: '12px', maxWidth: '400px', width: '90%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h4 style={{ color: 'var(--red-600)', marginBottom: '16px', fontSize: '1.2rem' }}>Botón de Arrepentimiento</h4>
            <p style={{ fontSize: '0.92rem', color: 'var(--gray-600)', lineHeight: 1.5, overflowY: 'auto', maxHeight: '400px', marginBottom: '20px' }}>
              ¿Deseas arrepentirte de tu registro y eliminar tu cuenta de repartidor permanentemente de Weep? <br/>
              <strong>Esta acción no se puede deshacer.</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="dd-btn-rojo dd-btn-large" 
                style={{ width: '100%' }} 
                disabled={deleting}
                onClick={async () => {
                  if (!driver?.id) {
                    toast.error("Debes iniciar sesión para eliminar tu cuenta.");
                    setShowRegretModal(false);
                    return;
                  }
                  setDeleting(true);
                  try {
                    await api.deleteRepartidorAccount(driver.id);
                    toast.success("Cuenta eliminada correctamente.");
                    logoutDriver();
                    window.location.href = "/";
                  } catch (e) {
                    toast.error("No se pudo eliminar la cuenta. Verifica que no tengas pedidos en curso.");
                  } finally {
                    setDeleting(false);
                    setShowRegretModal(false);
                  }
                }}
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar mi registro'}
              </button>
              <button className="btn btn-secondary dd-btn-large" style={{ width: '100%', border: '1px solid #ddd' }} onClick={() => setShowRegretModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTerms && (
        <div className="dd-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => setShowTerms(false)}>
          <div className="dd-modal-content animate-slide-down" style={{ background: 'white', padding: '24px', borderRadius: '12px', maxWidth: '500px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <h4 style={{ color: 'var(--red-600)', marginBottom: '16px', fontSize: '1.2rem' }}>Términos y Condiciones y Política de Privacidad</h4>
            <div style={{ fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.5, overflowY: 'auto', paddingRight: '10px', textAlign: 'left', flex: 1 }}>
              <h5 style={{ color: 'red', marginTop: 0 }}>📄 3. REPARTIDORES – TÉRMINOS Y CONDICIONES</h5>
              <p><strong>1. Naturaleza</strong></p>
              <p>El repartidor es un trabajador independiente, no tiene relación laboral con Weep y opera bajo su propio riesgo.</p>
              <p><strong>2. Autonomía</strong></p>
              <p>Puede aceptar/rechazar pedidos libremente, define sus propios horarios y no existe exclusividad.</p>
              <p><strong>3. Logística</strong></p>
              <p>Weep solo facilita la asignación de pedidos. No dirige la actividad como empleador.</p>
              <p><strong>4. Responsabilidad total</strong></p>
              <p>El repartidor es responsable de accidentes, daños, estado del vehículo y cumplimiento de normas viales.</p>
              <p><strong>5. Seguro</strong></p>
              <p>Debe contar con seguro propio y cobertura médica. Weep no provee seguros.</p>
              <p><strong>6. Exención de responsabilidad</strong></p>
              <p>Weep no será responsable por accidentes, lesiones o daños a terceros durante la actividad.</p>
              <p><strong>7. Indemnidad</strong></p>
              <p>El repartidor mantiene indemne a Weep ante cualquier reclamo de terceros.</p>
              <p><strong>8. Conducta</strong></p>
              <p>Debe actuar de forma segura, legal y respetuosa.</p>
              <hr style={{ margin: '15px 0', borderColor: '#eee' }} />
              <h5 style={{ color: 'red' }}>🔒 REPARTIDORES – POLÍTICA DE PRIVACIDAD</h5>
              <p><strong>Datos recolectados:</strong></p>
              <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                <li>Datos personales (nombre, teléfono, email)</li>
                <li>Ubicación en tiempo real (GPS)</li>
                <li>Actividad de entregas</li>
              </ul>
              <p><strong>Uso de datos:</strong></p>
              <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                <li>Asignación de pedidos y optimización de rutas</li>
                <li>Seguimiento del pedido por el cliente</li>
                <li>Seguridad del sistema</li>
              </ul>
              <p><strong>Compartición:</strong></p>
              <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                <li>Usuarios (clientes)</li>
                <li>Comercios (locales)</li>
              </ul>
            </div>
            <button className="btn btn-secondary btn-full" onClick={() => setShowTerms(false)} style={{ marginTop: 16 }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
