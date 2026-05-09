import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { useJsApiLoader } from '@react-google-maps/api';
import CountdownTimer from '../components/CountdownTimer';
import { isValidEmail } from '../utils/validation';
import toast from 'react-hot-toast';
import MapProbandoComponent from '../components/MapProbandoComponent';
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
  const [isActive, setIsActive] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('disponibles'); // 'disponibles', 'historial'
  const [pedidos, setPedidos] = React.useState([]);
  const [historial, setHistorial] = React.useState([]); 
  const [archivados, setArchivados] = React.useState([]);
  const [loadingArchivados, setLoadingArchivados] = React.useState(false);
  const [expandedCierre, setExpandedCierre] = React.useState(null);
  const [availableDriversCount, setAvailableDriversCount] = React.useState(0);

  const [localInfo, setLocalInfo] = React.useState({ nombre: '', direccion: '', lat: null, lng: null });
  const [montoLocal, setMontoLocal] = React.useState(0);
  const [realStats, setRealStats] = React.useState({ viajesHoy: 0, gananciasTotalesHoy: 0, viajesTotales: 0, gananciasGlobales: 0 });

  // Map state
  const [deliveryCoords, setDeliveryCoords] = React.useState({ lat: null, lng: null });
  const geocoderRef = React.useRef(null);

  // New views state
  const [view, setView] = React.useState('main'); // 'main', 'cobros', 'perfil', 'historial', 'archivados'
  const [showStats, setShowStats] = React.useState(true);
  const [cobrosData, setCobrosData] = React.useState(null);
  const [cobrosLoading, setCobrosLoading] = React.useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);

  // Gamification state
  const [gamificationStats, setGamificationStats] = React.useState(null);
  const [ranking, setRanking] = React.useState([]);
  const [showRankingModal, setShowRankingModal] = React.useState(false);
  const [pointsHistory, setPointsHistory] = React.useState([]);
  const [showHistoryModal, setShowHistoryModal] = React.useState(false);

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
  const [activeLocales, setActiveLocales] = React.useState([]);
  const [loadingLocales, setLoadingLocales] = React.useState(false);
  const [scheduledDates, setScheduledDates] = React.useState({});
  const [expandedOrders, setExpandedOrders] = React.useState({});
  const [directions, setDirections] = React.useState(null);
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleOrderExpand = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // ─── LÓGICA DE NAVEGACIÓN (DIRECTIONS) ───
  React.useEffect(() => {
    if (!isMapLoaded || !driverLocation.lat || !driverLocation.lng) return;

    // 1. Recolectar todos los puntos de interés (Retiros y Entregas)
    const pedidosEnCurso = pedidos.filter(p => !p.esBroadcast && ['Confirmado', 'Retirado', 'Pendiente de Pago', 'Pendiente', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado));
    const pointsMap = new Map(); // Usar Map para evitar duplicados en la misma coordenada
    
    pedidosEnCurso.forEach(p => {
      const isRetirado = p.estado === 'Retirado';
      const localObj = Array.isArray(p.locales) ? p.locales[0] : p.locales;
      
      const lat = isRetirado ? Number(p.lat) : Number(localObj?.lat || p.local_lat);
      const lng = isRetirado ? Number(p.lng) : Number(localObj?.lng || p.local_lng);
      
      if (lat && lng) {
        pointsMap.set(`${lat},${lng}`, { lat, lng });
      }
    });

    if (tutorialOrder && !tutorialOrder.id.includes('DUMMY')) {
       const isRetirado = tutorialOrder.estado === 'Retirado';
       const localObj = Array.isArray(tutorialOrder.locales) ? tutorialOrder.locales[0] : tutorialOrder.locales;
       const lat = isRetirado ? Number(tutorialOrder.lat) : Number(localObj?.lat || tutorialOrder.local_lat);
       const lng = isRetirado ? Number(tutorialOrder.lng) : Number(localObj?.lng || tutorialOrder.local_lng);
       if (lat && lng) pointsMap.set(`${lat},${lng}`, { lat, lng });
    }

    const uniquePoints = Array.from(pointsMap.values());

    if (uniquePoints.length === 0) {
      if (directions) setDirections(null);
      return;
    }

    // 2. Configurar la ruta con Waypoints
    // El último punto será el destino, los intermedios serán waypoints
    const destination = uniquePoints[uniquePoints.length - 1];
    const waypoints = uniquePoints.slice(0, -1).map(p => ({
      location: p,
      stopover: true
    }));

    const directionsService = new window.google.maps.DirectionsService();
    console.log("🛣️ Solicitando ruta multi-punto optimizada...");
    
    directionsService.route(
      {
        origin: { lat: Number(driverLocation.lat), lng: Number(driverLocation.lng) },
        destination: destination,
        waypoints: waypoints,
        optimizeWaypoints: true, // Google optimiza el orden de las paradas
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          console.log("✅ Ruta multi-punto optimizada con éxito");
          setDirections(result);
        } else {
          console.error(`❌ Error calculando ruta multi-punto: ${status}`);
          if (status === 'ZERO_RESULTS') {
            toast.error("No se encontró una ruta por calle.");
          }
        }
      }
    );
  }, [isMapLoaded, driverLocation, pedidos, tutorialOrder]);

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
          console.log("📍 Ubicación actualizada:", position.coords.latitude, position.coords.longitude, "Precisión:", position.coords.accuracy);
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("❌ Error en GPS Watcher:", error);
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

  const iniciarGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta GPS.');
      return;
    }
    
    toast.loading('Obteniendo ubicación exacta...', { id: 'gps-load' });
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.success('GPS Calibrado', { id: 'gps-load' });
        console.log("🎯 GPS Manual:", pos.coords.latitude, pos.coords.longitude, "Acc:", pos.coords.accuracy);
        setDriverLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        toast.error('Error: ' + err.message, { id: 'gps-load' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

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

  const fetchActiveLocales = React.useCallback(async () => {
    setLoadingLocales(true);
    try {
      const allLocales = await api.getLocales();
      const active = allLocales.filter(l => isLocalOpen(l));
      setActiveLocales(active);
    } catch (err) {
      console.error("Error fetching active locales:", err);
    } finally {
      setLoadingLocales(false);
    }
  }, [isLocalOpen]);

  // Modals state
  const [showEntregaModal, setShowEntregaModal] = React.useState(false);
  const [showRetiroModal, setShowRetiroModal] = React.useState(false);
  const [showChatModal, setShowChatModal] = React.useState(false);
  const [activeChatPedidoId, setActiveChatPedidoId] = React.useState(null);
  const [chatMessages, setChatMessages] = React.useState([]);
  const [chatInput, setChatInput] = React.useState('');
  const [pinInput, setPinInput] = React.useState('');
  const [showMap, setShowMap] = React.useState(false);
  const [showSessionModal, setShowSessionModal] = React.useState(false);
  const [activePedido, setActivePedido] = React.useState(null);

  // Sesion Timer Effect - ELIMINADO (Always active)
  React.useEffect(() => {
    if (isActive && driver) {
      iniciarGPS();
    }
  }, [isActive, driver]);

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
        // Sync email confirmation state with context
        if (d.data.EmailConfirmado !== driver.emailConfirmado) {
          loginAsDriver(d.data);
        }
      }
      // Load balance and history server-side
      loadCobros();
      fetchHistorial();
      loadRealStats();
      loadGamification();
      loadScheduledDates();
      fetchArchivados();
    } catch { toast.error('Error al cargar datos'); }
  }, [driver, loginAsDriver]);

  const loadScheduledDates = async () => {
    if (!driver) return;
    try {
      const dates = await api.repartidorGetScheduledPayments(driver.id);
      setScheduledDates(dates);
    } catch (err) {
      console.error("Error loading scheduled dates:", err);
    }
  };

  const loadGamification = async () => {
    if (!driver) return;
    try {
      const stats = await api.getDriverGamificationStats(driver.id);
      if (stats.success) setGamificationStats(stats.data);
      
      const rank = await api.getDriverRanking();
      if (rank.success) setRanking(rank.data);
    } catch (err) { console.error(err); }
  };

  const loadPointsHistory = async () => {
    if (!driver) return;
    try {
      const res = await api.getDriverPointsHistory(driver.id);
      if (res.success) setPointsHistory(res.data);
      setShowHistoryModal(true);
    } catch (err) { toast.error('Error al cargar historial'); }
  };

  const loadRealStats = async () => {
    if (!driver) return;
    try {
      const s = await api.repartidorGetDashboardStats(driver.id);
      if (s.success) setRealStats(s);
    } catch (err) { console.error(err); }
  };

  const fetchHistorial = async () => {
    if (!driver) return;
    try {
      const res = await api.getRepartidorHistorial(driver.id);
      if (res.success) setHistorial(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchArchivados = async () => {
    if (!driver) return;
    setLoadingArchivados(true);
    try {
      const res = await api.getRepartidorCierresArchivados(driver.id);
      if (res.success) {
        setArchivados(res.data);
      }
    } catch (err) {
      console.error("Error fetching archived closures:", err);
    } finally {
      setLoadingArchivados(false);
    }
  };

  const fetchPedidos = React.useCallback(async (silent = false) => {
    if (!driver) return;
    try {
      const res = await api.getPedidosDisponibles(driver.id);
      if (res.success) {
        // Enriquecer pedidos con datos del local si faltan (para evitar error 406 en join)
        const enriched = await Promise.all((res.data || []).map(async p => {
          if (['Confirmado', 'Retirado', 'En camino', 'Listo', 'Preparando', 'Aceptado'].includes(p.estado) && p.local_id) {
            try {
              const { data: lData } = await api.supabase.from('locales').select('nombre, direccion, lat, lng').eq('id', p.local_id).single();
              if (lData) {
                return { ...p, local_nombre: lData.nombre, local_direccion: lData.direccion, local_lat: lData.lat, local_lng: lData.lng };
              }
            } catch (e) { console.warn("Error enriqueciendo pedido:", p.id, e); }
          }
          return p;
        }));
        const sorted = enriched.sort((a, b) => a.id.localeCompare(b.id));
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
      console.error("❌ Error en fetchPedidos:", err);
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
            OneSignal.Notifications.addEventListener("permissionChange", async (permission) => {
              console.log("🔔 OneSignal Permission changed:", permission);
              updateStatus();
              // Si se concedió permiso, intentar sincronizar el ID de inmediato
              if (permission) {
                const sub = OneSignal.User.PushSubscription;
                if (sub.id) {
                  console.log("🔔 OneSignal Syncing on Permission Change:", sub.id);
                  await api.repartidorUpdateOneSignalId(driver.id, sub.id).catch(console.error);
                }
              }
            });

            OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
              const newId = event.current?.id || OneSignal.User.PushSubscription.id;
              console.log("🔔 OneSignal ID Change Event:", newId);
              if (newId) {
                await api.repartidorUpdateOneSignalId(driver.id, newId).catch(console.error);
              }
            });

            // 3. Prompt logic (Refined for Safari)
            // On iOS/Safari, autoprompting is blocked. We rely on the UI banner.
            // On other platforms, we can try to prompt if active.
            if (!isIOS && OneSignal.Notifications.permissionNative === 'default' && isActive) {
              console.log("🔔 OneSignal: Autoprompting (Non-iOS)...");
              const granted = await OneSignal.Notifications.requestPermission();
              if (granted) {
                // Pequeña espera para asegurar que la suscripción se cree
                setTimeout(async () => {
                  const subId = OneSignal.User.PushSubscription.id;
                  if (subId) {
                    console.log("🔔 OneSignal Syncing after Prompt (Deferred):", subId);
                    await api.repartidorUpdateOneSignalId(driver.id, subId).catch(console.error);
                  }
                }, 1000);
              }
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
    fetchActiveLocales();
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

    if (driver) {
      // 1. Consulta inicial (Siempre para ver broadcast)
      fetchPedidos();
      checkAvailability();
      fetchActiveLocales();
      
      // 2. Polling de pedidos (Siempre mientras esté logueado)
      interval = setInterval(() => {
        fetchPedidos();
        if (isActive) checkAvailability();
        fetchActiveLocales();
      }, 15000);

      // 3. Lógica solo si está ACTIVO (Interacción y Heartbeat)
      if (isActive) {
        window.addEventListener('mousemove', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);
        window.addEventListener('scroll', handleInteraction);

        // Heartbeat cada 60s para mantener sesión activa
        heartbeatInterval = setInterval(async () => {
          api.repartidorUpdateHeartbeat(driver.id, hadInteraction);
          hadInteraction = false;
          
          try {
            const d = await api.repartidorGetDatos(driver.id);
            if (d?.success && d.data) {
              if (d.data.Estado === 'Inactivo') {
                toast.error('Sesión terminada por inactividad.');
                setIsActive(false);
                setDriverData(d.data);
              }
            }
          } catch (e) { console.error(e); }
        }, 60000);

        api.repartidorUpdateHeartbeat(driver.id, true);
      }
    }

    return () => {
      clearInterval(interval);
      clearInterval(heartbeatInterval);
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
    };
  }, [driver, isActive, fetchPedidos, checkAvailability]);

  // React.useEffect(() => {
  //   const handleUnload = () => { ... } 
  //   Evitamos desconectar al refrescar. El CRON de inactividad se encarga si cierran la página.
  // }, [driver, isActive]);

  // Sincronizar localInfo con el pedido en viaje principal para retrocompatibilidad
  React.useEffect(() => {
    const enViaje = pedidos.find(p => ['Confirmado', 'Retirado', 'En camino', 'Pendiente de Pago', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado));
    if (enViaje && enViaje.local_nombre) {
      setLocalInfo({
        nombre: enViaje.local_nombre,
        direccion: enViaje.local_direccion,
        lat: enViaje.local_lat,
        lng: enViaje.local_lng
      });
    }
  }, [pedidos]);

  // Carga de datos del local para viaje en curso
  React.useEffect(() => {
    if (!isMapLoaded) return;

    const enViaje = pedidos.find(p => !p.esBroadcast && ['Confirmado', 'Retirado', 'Pendiente de Pago', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado));
    if (enViaje) {
      // 1. Cargar datos del local
      if (enViaje.local_id && !enViaje.local_nombre) {
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
        const latVal = results[0].geometry.location.lat();
        const lngVal = results[0].geometry.location.lng();

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

  const handleLogout = () => {
    logoutDriver();
    setDriverData(null);
    toast.success('Sesión cerrada');
  };



  // ─── PEDIDO ACTIONS ───
  const aceptarPedido = async (pedido) => {
    const pedidoId = typeof pedido === 'string' ? pedido : pedido.id;
    const isBroadcast = typeof pedido === 'object' ? pedido.esBroadcast : false;

    toast.loading('Aceptando...', { id: 'ac' });
    try {
      const res = isBroadcast 
        ? await api.aceptarPedidoBroadcast(pedidoId, driver.id)
        : await api.updateEstadoPedido(pedidoId, 'Confirmado', driver.id);
        
      if (res.success) {
        toast.success('¡Pedido aceptado!', { id: 'ac' });
        fetchPedidos();
      } else {
        toast.error(res.error || 'Error al aceptar', { id: 'ac' });
      }
    } catch { toast.error('Error de conexión', { id: 'ac' }); }
  };

  const finalizarRetiro = async (pedido, pin) => {
    if (!pin || pin.length !== 4) return toast.error('Ingresa el PIN de 4 dígitos brindado por el local');
    const tid = toast.loading('Actualizando...', { id: 'ret' });
    try {
      const res = await api.updateEstadoPedido(pedido.id, 'Retirado', driver.id, pin);
      if (res.success) {
        toast.success('Pedido marcado como RETIRADO', { id: tid });
        setShowRetiroModal(false);
        setPinInput('');
        await fetchPedidos(true);
      } else {
        toast.error(res.error || 'Error', { id: tid });
      }
    } catch (err) { 
      console.error("Error en finalizarRetiro:", err);
      toast.error('Error de conexión al marcar retiro', { id: tid }); 
    }
  };

  const confirmarRetiroClick = (pedido) => {
    setActivePedido(pedido);
    setPinInput('');
    setShowRetiroModal(true);
  };

  const confirmarEntregaClick = (pedido) => {
    setActivePedido(pedido);
    setPinInput('');
    setShowEntregaModal(true);
  };

  const finalizarEntrega = async (pedido) => {
    const pin = pinInput; // Capturar PIN actual
    if (!pin || pin.length !== 4) return toast.error('Ingresa el PIN de 4 dígitos brindado por el cliente');
    
    const tid = toast.loading('Confirmando entrega...', { id: 'ent' });
    console.log("🚀 Iniciando finalizarEntrega para pedido:", pedido.id, "con PIN:", pin);
    
    try {
      const res = await api.updateEstadoPedido(pedido.id, 'Entregado', driver.id, pin);
      console.log("✅ Respuesta de api.updateEstadoPedido:", res);
      
      if (res.success) {
        toast.success('¡Entrega confirmada!', { id: tid });
        
        try {
          console.log("🔄 Refrescando datos post-entrega...");
          if (typeof loadCobros === 'function') await loadCobros();
          if (typeof fetchHistorial === 'function') await fetchHistorial();
          await loadRealStats();
        } catch (e) { 
          console.warn("⚠️ Error no crítico refrescando stats:", e); 
        }

        setDriverData(prev => ({ ...prev, PedidosHoy: (prev?.PedidosHoy || 0) + 1 }));
        setShowEntregaModal(false);
        setPinInput('');
        setActiveTab('historial');
        await fetchPedidos(true);
      } else {
        console.warn("❌ Error reportado por el servidor:", res.error);
        toast.error(res.error || 'Error', { id: tid });
      }
    } catch (err) { 
      console.error("🔥 Error CRÍTICO en finalizarEntrega:", err);
      toast.error('Error de conexión al finalizar entrega', { id: tid }); 
    }
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

  const aceptarTutorial = () => {
    setTutorialOrder(prev => ({ ...prev, estado: 'Confirmado' }));
    setTutorialStep(3);
    toast.success('¡Pedido de prueba aceptado!');
  };

  const confirmarRetiroTutorial = () => {
    setTutorialOrder(prev => ({ ...prev, estado: 'Retirado' }));
    setTutorialStep(4);
    setShowRetiroModal(false);
    setPinInput('');
    toast.success('¡Retiro de prueba confirmado!');
  };

  const finalizarTutorial = () => {
    setTutorialOrder(null);
    setTutorialStep(5);
    setShowEntregaModal(false);
    setPinInput('');
    toast.success('¡Entrega de prueba finalizada!');
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
    // Buscar TODOS los pedidos asignados a mí que estén activos
    const pedidosEnCurso = pedidos.filter(p => !p.esBroadcast && ['Confirmado', 'Retirado', 'Pendiente de Pago', 'Pendiente', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado));
    
    // Si no hay pedidos en curso reales, ver si hay tutorial
    const tutorialActivo = (tutorialOrder && ['Confirmado', 'Retirado', 'Pendiente de Pago', 'Pendiente', 'Aceptado', 'Listo', 'Preparando'].includes(tutorialOrder.estado)) ? [tutorialOrder] : [];
    
    const todosEnCurso = [...tutorialActivo, ...pedidosEnCurso];

    if (todosEnCurso.length > 0) {
      return (
        <div className="dd-en-curso-container">


          {todosEnCurso.map(enViaje => {
            console.log("📦 Pedido en curso:", enViaje);
            const isTutorial = enViaje.id.includes('PRUEBA');
            const isRetirado = enViaje.estado === 'Retirado';
            const isLento = enViaje.nivel_rapidez === 2;
            
            const localObj = Array.isArray(enViaje.locales) ? enViaje.locales[0] : enViaje.locales;
            const localNombre = isTutorial ? 'Restaurante Tutorial' : (localObj?.nombre || enViaje.local_nombre || 'Local');
            const localDir = isTutorial ? 'Av. San Martín 456' : (localObj?.direccion || enViaje.local_direccion || 'Cargando...');
            const localLat = isTutorial ? -28.549 : (localObj?.lat || enViaje.local_lat);
            const localLng = isTutorial ? -56.032 : (localObj?.lng || enViaje.local_lng);
            const montoMostrar = isTutorial ? 2000 : (enViaje.monto_local || 0);

            const isExpanded = expandedOrders[enViaje.id];

            const diff = now - new Date(enViaje.created_at);
            const totalSecs = Math.max(0, Math.floor(diff / 1000));
            const mins = Math.floor(totalSecs / 60);
            const secs = totalSecs % 60;
            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
            const isUrgent = mins >= 15; // Urgente a los 15 min

            return (
              <div key={enViaje.id} className={`dd-simple-card animate-slide-up ${isLento ? 'lento-card' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`} style={{ borderLeft: isLento ? '6px solid #f97316' : '6px solid #22c55e' }}>
                <div className="dd-simple-header" onClick={() => toggleOrderExpand(enViaje.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>Pedido #{enViaje.id.split('-').pop()}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span className={`dd-time-counter-badge ${isUrgent ? 'urgent' : ''}`}>
                        ⏱️ {timeStr}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: '#999', fontWeight: 'bold' }}>
                        {isLento ? '🍳 LENTO' : '⚡ RÁPIDO'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className={`dd-status-badge ${enViaje.estado === 'Pendiente de Pago' ? 'pulse-orange' : ''}`} style={{ fontSize: '0.7rem' }}>
                      {enViaje.estado === 'Pendiente de Pago' ? 'Pago' : enViaje.estado}
                    </div>
                    <span style={{ fontSize: '1.2rem', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                  </div>
                </div>
                
                <div className={`dd-simple-body-wrapper ${isExpanded ? 'expanded' : 'collapsed'}`}>
                  <div className="dd-simple-body">
                    {enViaje.estado === 'Pendiente de Pago' ? (
                      <div className="dd-waiting-payment-box animate-pulse" style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '15px', borderRadius: '12px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#9a3412' }}><strong>Pendiente de pago del cliente</strong></p>
                        <CountdownTimer 
                          startTime={enViaje.pago_pendiente_at || enViaje.created_at} 
                          limitMinutes={8} 
                          onTimeout={() => fetchPedidos()} 
                        />
                      </div>
                    ) : !isRetirado ? (
                      <>
                        <div className="dd-section-title">📍 Punto de Retiro</div>
                        <div className="dd-info-block">
                          <div className="dd-info-row">
                            <span className="dd-info-label">Local</span>
                            <span className="dd-info-value">{localNombre}</span>
                          </div>
                          <div className="dd-info-row">
                            <span className="dd-info-label">Dirección</span>
                            <span className="dd-info-value">{localDir}</span>
                          </div>
                          {localLat && localLng && (
                            <div style={{ marginTop: '10px' }}>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${localLat},${localLng}`, '_blank')}
                                style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}
                              >
                                📍 Abrir en Google Maps (GPS)
                              </button>
                            </div>
                          )}
                          <div className="dd-info-row">
                            <span className="dd-info-value monto">
                              {(enViaje.metodo_pago || enViaje.pago)?.toLowerCase() === 'efectivo' 
                                ? `Debés pagar: $${Number(montoMostrar).toLocaleString('es-AR')}` 
                                : 'Ya Pago (Retirá sin pagar)'}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="dd-section-title">🏁 Punto de Entrega</div>
                        <div className="dd-info-block">
                          <div className="dd-info-row">
                            <span className="dd-info-label">Cliente</span>
                            <span className="dd-info-value" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              {enViaje.nombre_cliente || 'Cliente'}
                              {enViaje.telefono_cliente && (
                                <button 
                                  className="btn btn-sm btn-success"
                                  onClick={() => window.open(`https://wa.me/${enViaje.telefono_cliente.replace(/\D/g, '')}`, '_blank')}
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', background: '#25D366', border: 'none', color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                                >
                                  💬 WhatsApp
                                </button>
                              )}
                            </span>
                          </div>
                          <div className="dd-info-row">
                            <span className="dd-info-label">Dirección</span>
                            <span className="dd-info-value">{enViaje.direccion}</span>
                          </div>
                          {enViaje.lat && enViaje.lng && (
                            <div style={{ marginTop: '10px' }}>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${enViaje.lat},${enViaje.lng}`, '_blank')}
                                style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}
                              >
                                📍 Abrir en Google Maps (GPS)
                              </button>
                            </div>
                          )}
                          <div className="dd-info-row">
                            <span className="dd-info-value monto cobrar">
                              {(enViaje.metodo_pago || enViaje.pago)?.toLowerCase() === 'efectivo' 
                                ? `Debés cobrar: $${Number(enViaje.total || enViaje.monto || 0).toLocaleString('es-AR')}` 
                                : 'Ya Pago (No cobrar)'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="dd-simple-actions">
                      {enViaje.estado !== 'Pendiente de Pago' && (
                        <div className="dd-btn-row">
                          <button className="btn btn-light btn-full" onClick={() => isTutorial ? toast('Chat de simulación') : openChat(enViaje.id)}>
                            💬 Chat
                          </button>
                          {!isRetirado ? (
                            <button className="dd-btn-rojo" onClick={() => confirmarRetiroClick(enViaje)}>
                              🏍️ RETIRAR
                            </button>
                          ) : (
                            <button className="dd-btn-verde" onClick={() => confirmarEntregaClick(enViaje)}>
                              🚀 ENTREGAR
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Mostrar pedidos disponibles adicionales abajo si hay capacidad */}
          {renderPendientes(todosEnCurso)}
        </div>
      );
    }

    return renderPendientes([]);
  };

  const renderPendientes = (actuales = []) => {
    const pendientesReales = pedidos.filter(p => ['Pendiente', 'Buscando Repartidor', 'Listo', 'Preparando'].includes(p.estado) && p.esBroadcast);
    const pendientesTutorial = tutorialOrder && tutorialOrder.estado === 'Pendiente' ? [tutorialOrder] : [];
    const pendientes = [...pendientesTutorial, ...pendientesReales];

    if (pendientes.length === 0 && actuales.length === 0) {
      return null;
    }

    if (pendientes.length === 0) return null;

    return (
      <div className="dd-available-section">
        <h3 style={{ fontSize: '1.2rem', color: 'var(--gray-800)', marginBottom: '1rem', marginTop: actuales.length > 0 ? '2rem' : 0 }}>
          {actuales.length > 0 ? '➕ Otros pedidos disponibles' : 'Pedidos Disponibles'}
        </h3>
        <div className="dd-orders-grid animate-fade-in">
          {pendientes.map(p => {
            const isLento = p.nivel_rapidez === 2;
            const isStacking = p.esStacking;

            return (
              <div className={`dd-order-card broadcast-card ${isLento ? 'lento-card' : ''} ${isStacking ? 'stacking-card' : ''}`} key={p.id} style={{ borderTop: isStacking ? '6px solid #6366f1' : 'none' }}>
                <div className="dd-order-head">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h5>Pedido #{p.id.split('-').pop()}</h5>
                    {isStacking && <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 'bold' }}>📍 ¡MISMO LOCAL!</span>}
                  </div>
                  <span className={`dd-badge ${isLento ? 'bg-lento' : 'bg-broadcast'}`}>
                    {isLento ? 'LENTO 🍳' : 'RÁPIDO ⚡'}
                  </span>
                </div>
                <div className="dd-order-amount">
                  <small style={{ display: 'block', fontSize: '0.75rem', color: 'var(--gray-400)' }}>Ganancia Envío</small>
                  ${Number(p.precio_envio || 0).toLocaleString('es-AR')}
                </div>
                <div className="dd-order-info">
                  <p>👤 <strong>Cliente:</strong> {p.nombre_cliente}</p>
                  <p>📍 <strong>Destino:</strong> {p.direccion}</p>
                </div>
                <div className="dd-order-actions">
                  <button 
                    className={isStacking ? "dd-btn-stacking" : (isLento ? "dd-btn-lento" : "dd-btn-broadcast")}
                    onClick={() => p.id.includes('PRUEBA') ? aceptarTutorial() : aceptarPedido(p)}
                  >
                    {isStacking ? 'Tomar para este local' : 'Tomar Viaje →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderActiveLocales = () => {
    if (loadingLocales && activeLocales.length === 0) return null;
    
    return (
      <div className="dd-active-locales animate-fade-in" style={{ marginTop: '30px', marginBottom: '30px' }}>
        <div className="dd-section-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--gray-800)' }}>Locales Activos</h4>
          <span style={{ padding: '2px 8px', background: 'var(--green-100)', color: 'var(--green-700)', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
            {activeLocales.length}
          </span>
        </div>
        
        {activeLocales.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', fontSize: '0.9rem', textAlign: 'center', padding: '10px' }}>No hay locales abiertos en este momento.</p>
        ) : (
          <div className="dd-locales-scroll" style={{ 
            display: 'flex', 
            gap: '12px', 
            overflowX: 'auto', 
            paddingBottom: '15px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {activeLocales.map(local => (
              <div key={local.id} className="dd-local-badge" style={{
                flex: '0 0 auto',
                width: '80px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '15px',
                  background: 'white',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                  margin: '0 auto 8px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #f0f0f0'
                }}>
                  <img 
                    src={local.logo || "https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png"} 
                    alt={local.nombre} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.src = "https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png"; }}
                  />
                </div>
                <span style={{ 
                  fontSize: '0.7rem', 
                  color: 'var(--gray-600)', 
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: '500'
                }}>{local.nombre}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderHistorial = () => {
    if (historial.length === 0) {
      return (
        <div className="empty-state">
          <h3>No hay historial de entregas</h3>
          <p>Tus pedidos entregados aparecerán aquí.</p>
        </div>
      );
    }
    return (
      <div className="dd-orders-grid animate-fade-in">
        {historial.map((h, i) => (
          <div className="dd-order-card" key={i}>
            <div className="dd-order-head">
              <small style={{ color: 'var(--gray-500)' }}>
                {new Date(h.created_at).toLocaleDateString()}
              </small>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span className={`dd-badge ${h.cobro_repartidor_procesado ? 'bg-success' : (h.metodo_pago === 'Efectivo' ? 'bg-info' : 'bg-warning')}`} style={{ fontSize: '0.7rem' }}>
                  {h.cobro_repartidor_procesado ? '✓ Cobrado' : (h.metodo_pago === 'Efectivo' ? 'Cash Recibido' : 'Pendiente de cobro')}
                </span>
                {scheduledDates[h.id] && !h.cobro_repartidor_procesado && (
                  <span className="dd-badge" style={{ fontSize: '0.65rem', background: '#6366f1', color: 'white' }}>
                    📅 Pago: {scheduledDates[h.id].split('-').reverse().join('-')}
                  </span>
                )}
              </div>
            </div>
            <p style={{ margin: '8px 0', fontWeight: 'bold', fontSize: '0.9rem' }}>{h.direccion}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="dd-order-amount" style={{ margin: 0, fontSize: '1.2rem' }}>${Number(h.precio_envio || 0).toLocaleString('es-AR')}</div>
              <small style={{ color: 'var(--gray-400)', fontSize: '0.7rem' }}>Pago: {h.metodo_pago}</small>
            </div>
          </div>
        ))}
      </div>
    );
  };


  const renderArchivados = () => {
    if (loadingArchivados) return <div className="spinner-container" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><span className="spinner" /></div>;

    if (archivados.length === 0) {
      return (
        <div className="empty-state">
          <h3>No hay liquidaciones archivadas</h3>
          <p>Tus cierres de caja finalizados aparecerán aquí.</p>
        </div>
      );
    }

    return (
      <div className="dd-archivados-list animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {archivados.map((c, i) => (
          <div key={c.id} className="dd-order-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div 
              style={{ padding: '15px', cursor: 'pointer', background: expandedCierre === c.id ? 'var(--gray-50)' : 'white' }}
              onClick={() => setExpandedCierre(expandedCierre === c.id ? null : c.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <small style={{ color: 'var(--gray-500)', fontWeight: 600 }}>LIQUIDACIÓN #{c.id.slice(-6).toUpperCase()}</small>
                  <p style={{ margin: '4px 0', fontWeight: 'bold' }}>{new Date(c.fecha).toLocaleDateString('es-AR')}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--red-600)', fontWeight: 800, fontSize: '1.1rem' }}>${Number(c.monto_total).toLocaleString('es-AR')}</div>
                  <small style={{ color: 'var(--gray-500)' }}>{c.cantidad_viajes} viajes</small>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.75rem', color: 'var(--red-500)', fontWeight: 600 }}>
                {expandedCierre === c.id ? '🔼 Ocultar detalles' : '🔽 Ver detalle de viajes'}
              </div>
            </div>

            {expandedCierre === c.id && (
              <div style={{ background: '#f8fafc', borderTop: '1px solid #eee', padding: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {c.pedidos.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.direccion}</div>
                        <small style={{ color: 'var(--gray-500)', fontSize: '0.7rem' }}>#{p.id.slice(0,8)} • {p.metodo_pago}</small>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>${Number(p.precio_envio).toLocaleString('es-AR')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          <p style={{ color: 'var(--gray-600)' }}>Retirá tus ganancias acumuladas por pagos con transferencia o tarjeta.</p>
        </div>

        <div className="dd-stats-grid" style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          <div className="dd-stat-item highlight" style={{ background: 'var(--red-50)', border: '1px solid var(--red-200)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <small style={{ color: 'var(--gray-600)', display: 'block', marginBottom: '8px', fontSize: '1rem' }}>Saldo a Cobrar (Transferencia/Tarjeta)</small>
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
                  Para recibir <strong>ubicación y notificaciones</strong> correctamente en iOS, debes añadir Wepi a tu inicio:
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
        <div className="dd-header-top">
          <Link to="/">
            <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" className="dd-logo" />
          </Link>
          {driver && (
            <button className="dd-header-menu-btn" onClick={() => setProfileMenuOpen(true)}>☰ Menú</button>
          )}
        </div>
        <h1>Panel de Repartidores</h1>
      </header>

      <main className={`dd-main ${driver ? 'map-active' : ''}`}>
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
                📱 Instala Wepi en tu iPhone
              </h4>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.95, lineHeight: '1.4' }}>
                Para <strong>recibir pedidos</strong> en tiempo real, debes anclar la app al inicio:
                <br />
                1. Presiona el botón <img src="https://i.postimg.cc/T3yKbZy3/png-transparent-share-icon-computer-icons-button-graphical-user-interface-safari-button-angle-rectan.png" alt="compartir" style={{ height: '22px', verticalAlign: 'middle', margin: '0 2px' }} /> <strong>(icono de la imagen)</strong>.
                <br />
                2. Busca y elige <strong>"Agregar a inicio"</strong>.
                <br />
                3. Abre la app desde el icono creado.
              </p>
            </div>
            <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', fontSize: '80px', opacity: 0.1 }}>🔔</div>
          </div>
        )}

        {/* ─── Banner de Notificaciones ─── */}
        {driver && notificationStatus !== 'granted' && (
          <div className={`notification-status-banner ${notificationStatus === 'denied' ? 'denied' : 'pending'}`}>
            <span className="banner-text">
              {notificationStatus === 'denied' ? (
                <>🚫 <strong>Bloqueadas:</strong> No recibirás alertas de pedidos. Revisa los permisos.</>
              ) : (
                <>
                  {isIOS && !isStandalone ? (
                    <>🔔 <strong>Activa la App:</strong> Añade Wepi al inicio para habilitar el GPS.</>
                  ) : (
                    <>🔔 <strong>Activa alertas:</strong> Presiona el botón para recibir pedidos al instante.</>
                  )}
                </>
              )}
            </span>
            <div className="banner-actions">
              {(isIOS || isAndroid) && !isStandalone ? (
                <button 
                  className="btn btn-outline btn-sm" 
                  onClick={() => setShowPWAInstructions(true)}
                >
                  {isIOS ? '📱 Instrucciones' : (deferredPrompt ? '📲 Descargar' : '📱 Info')}
                </button>
              ) : null}
              {notificationStatus !== 'denied' && (!isIOS || isStandalone) && (
                <button 
                  className="btn btn-primary btn-sm" 
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
          <div style={{ 
            position: 'relative', 
            height: 'calc(100vh - 120px)', // Ocupar el resto de la pantalla con margen para el header
            width: '100%', 
            overflow: 'hidden',
            background: '#f8f9fa'
          }}>
            {/* ─── MAPA DE FONDO ─── */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
              <MapProbandoComponent 
                localLat={localInfo.lat} 
                localLng={localInfo.lng} 
                pedidosActivos={pedidos.filter(p => !p.esBroadcast && ['Confirmado', 'Retirado', 'Pendiente de Pago', 'Pendiente', 'Aceptado', 'Listo', 'Preparando'].includes(p.estado))}
                driverLat={driverLocation.lat} 
                driverLng={driverLocation.lng}
                localName={localInfo.nombre} 
                isLoaded={isMapLoaded}
                directions={directions}
              />
            </div>

            {/* ─── CAPA SUPERIOR (Estadísticas y Locales) ─── */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: '12px 16px', pointerEvents: 'none' }}>
              <div className="dd-stats-box animate-slide-down" style={{ 
                pointerEvents: 'auto', 
                background: 'rgba(255,255,255,0.95)', 
                backdropFilter: 'blur(10px)',
                marginBottom: '10px',
                padding: '12px 16px',
                borderRadius: '16px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                border: '1px solid rgba(0,0,0,0.05)'
              }}>
                <div className="dd-stats-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showStats ? 12 : 0 }}>
                   <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                     Hola, <span>{driverData?.Nombre?.split(' ')[0] || '...'}</span>
                   </h3>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => setShowStats(!showStats)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--red-600)', display: 'flex', alignItems: 'center' }}>
                        {showStats ? '▴' : '▾'}
                      </button>
                   </div>
                </div>

                {showStats && (
                  <div className="dd-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    <div className="dd-stat-item" onClick={() => setShowRankingModal(true)} style={{ padding: '6px 4px', border: 'none', background: '#fff9f0' }}>
                      <small style={{ fontSize: '0.55rem' }}>🏆 Rank</small>
                      <strong style={{ fontSize: '0.9rem' }}>#{gamificationStats?.rank_posicion || '—'}</strong>
                    </div>
                    <div className="dd-stat-item" onClick={loadPointsHistory} style={{ padding: '6px 4px', border: 'none', background: '#f1f8ff' }}>
                      <small style={{ fontSize: '0.55rem' }}>💎 Pts</small>
                      <strong style={{ fontSize: '0.9rem' }}>{gamificationStats?.puntos_totales || 0}</strong>
                    </div>
                    <div className="dd-stat-item" style={{ padding: '6px 4px', border: 'none' }}>
                      <small style={{ fontSize: '0.55rem' }}>📦 Env</small>
                      <strong style={{ fontSize: '0.9rem' }}>{realStats.viajesTotales}</strong>
                    </div>
                    <div className="dd-stat-item" onClick={() => setView('cobros')} style={{ padding: '6px 4px', border: 'none' }}>
                      <small style={{ fontSize: '0.55rem' }}>💰 Gan</small>
                      <strong style={{ fontSize: '0.9rem' }}>${Math.round(realStats.gananciasGlobales / 1000)}k</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Locales Activos + Botón Ubicación (GPS) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div className="animate-fade-in" style={{ 
                  pointerEvents: 'auto',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  overflowX: 'auto', 
                  scrollbarWidth: 'none',
                  background: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(5px)',
                  padding: '6px 14px',
                  borderRadius: '50px',
                  width: 'fit-content',
                  maxWidth: '70%',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Locales:</span>
                  {activeLocales.map(local => (
                    <div key={local.id} style={{ flex: '0 0 auto', position: 'relative' }}>
                      <img 
                        src={local.logo || "https://i.postimg.cc/Z5N1N0c9/user-avatar.png"} 
                        alt={local.nombre} 
                        style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1.5px solid #fff', objectFit: 'cover' }}
                      />
                      <span style={{ position: 'absolute', bottom: '0', right: '0', width: '8px', height: '8px', background: '#22c55e', border: '1.5px solid white', borderRadius: '50%' }}></span>
                    </div>
                  ))}
                  {activeLocales.length === 0 && !loadingLocales && <small style={{ fontSize: '0.6rem', color: '#999' }}>Ninguno</small>}
                </div>

                <button 
                  onClick={iniciarGPS} 
                  style={{ 
                    pointerEvents: 'auto',
                    background: 'rgba(255,255,255,0.95)', 
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(225,29,72,0.2)',
                    borderRadius: '50px',
                    padding: '10px 18px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    color: 'var(--red-600)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                  className="animate-pulse"
                >
                  <span style={{ fontSize: '1.1rem' }}>🎯</span> GPS
                </button>
              </div>
            </div>

            {/* ─── CAPA INFERIOR (Pedidos Flotantes) ─── */}
            <div style={{ 
              position: 'absolute', 
              bottom: '20px', // Subido para evitar cortes en celulares
              left: 0, 
              right: 0, 
              zIndex: 10, 
              maxHeight: '48%', 
              overflowY: 'auto', 
              overflowX: 'hidden', 
              padding: '10px 16px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.15) 0%, transparent 100%)',
              pointerEvents: 'none',
              scrollbarWidth: 'none'
            }}>
              {view === 'main' && (
                <div style={{ pointerEvents: 'auto' }}>
                  <div className="dd-floating-orders-list">
                    {renderDisponibles()}
                  </div>
                </div>
              )}

              {/* Vistas Full (Cobros, Perfil, Historial, Archivados) */}
              <div style={{ pointerEvents: 'auto' }}>
                {view === 'cobros' && (
                  <div className="animate-slide-up" style={{ background: 'white', borderRadius: '24px 24px 0 0', padding: '24px', minHeight: '80vh', boxShadow: '0 -8px 30px rgba(0,0,0,0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                       <button className="btn btn-outline btn-sm" onClick={() => setView('main')}>Cerrar ✕</button>
                    </div>
                    {renderCobros()}
                  </div>
                )}
                {view === 'perfil' && (
                  <div className="animate-slide-up" style={{ background: 'white', borderRadius: '24px 24px 0 0', padding: '24px', minHeight: '80vh', boxShadow: '0 -8px 30px rgba(0,0,0,0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                       <button className="btn btn-outline btn-sm" onClick={() => setView('main')}>Cerrar ✕</button>
                    </div>
                    {renderPerfil()}
                  </div>
                )}
                {view === 'historial' && (
                  <div className="animate-slide-up" style={{ background: 'white', borderRadius: '24px 24px 0 0', padding: '24px', minHeight: '80vh', boxShadow: '0 -8px 30px rgba(0,0,0,0.15)' }}>
                    <div className="dd-section-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Historial de Entregas</h2>
                      <button className="btn btn-outline btn-sm" onClick={() => setView('main')}>Cerrar ✕</button>
                    </div>
                    {renderHistorial()}
                  </div>
                )}
                {view === 'archivados' && (
                  <div className="animate-slide-up" style={{ background: 'white', borderRadius: '24px 24px 0 0', padding: '24px', minHeight: '80vh', boxShadow: '0 -8px 30px rgba(0,0,0,0.15)' }}>
                    <div className="dd-section-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Liquidaciones Archivadas</h2>
                      <button className="btn btn-outline btn-sm" onClick={() => setView('main')}>Cerrar ✕</button>
                    </div>
                    {renderArchivados()}
                  </div>
                )}
              </div>
            </div>
          </div>
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
              <button className={`dd-nav-item ${view === 'historial' ? 'active' : ''}`} style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: view === 'historial' ? 'var(--red-50)' : 'transparent', color: view === 'historial' ? 'var(--red-600)' : 'var(--gray-700)', fontWeight: view === 'historial' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={() => { setView('historial'); setProfileMenuOpen(false); }}>
                📜 Historial de Entregas
              </button>
              <button className={`dd-nav-item ${view === 'archivados' ? 'active' : ''}`} style={{ 
                width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', background: view === 'archivados' ? 'var(--red-50)' : 'transparent', color: view === 'archivados' ? 'var(--red-600)' : 'var(--gray-700)', fontWeight: view === 'archivados' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '12px' 
              }} onClick={() => { setView('archivados'); fetchArchivados(); setProfileMenuOpen(false); }}>
                📁 Liquidaciones Archivadas
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

      {/* Retiro Modal */}
      {showRetiroModal && (
        <div className="dd-modal-overlay" onClick={() => { setShowRetiroModal(false); setActivePedido(null); }}>
          <div className="dd-modal-content animate-slide-down" onClick={e => e.stopPropagation()}>
            <div className="dd-modal-header">
              <h5>Confirmar Retiro</h5>
              <button className="dd-modal-close" onClick={() => { setShowRetiroModal(false); setActivePedido(null); }}>×</button>
            </div>
            <div className="dd-modal-body" style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🏍️</div>
              <p style={{ color: 'var(--gray-600)', marginBottom: '20px' }}>
                Ingresa el <strong>PIN de 4 dígitos</strong> proporcionado por el local para confirmar el retiro del pedido.
              </p>
              <input
                type="number"
                pattern="\d*"
                inputMode="numeric"
                className="form-input"
                style={{ fontSize: '2rem', textAlign: 'center', letterSpacing: '8px', height: '60px' }}
                placeholder="0000"
                value={pinInput}
                onChange={e => setPinInput(e.target.value.slice(0, 4))}
              />
            </div>
            <div className="dd-modal-footer">
              <button 
                className="dd-btn-rojo dd-btn-large" 
                onClick={() => activePedido?.id?.includes('PRUEBA') || !activePedido ? confirmarRetiroTutorial() : finalizarRetiro(activePedido, pinInput)}
              >
                Confirmar Retiro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entrega Modal */}
      {showEntregaModal && (
        <div className="dd-modal-overlay" onClick={() => { setShowEntregaModal(false); setActivePedido(null); }}>
          <div className="dd-modal-content animate-slide-down" onClick={e => e.stopPropagation()}>
            <div className="dd-modal-header">
              <h5>Confirmar Entrega</h5>
              <button className="dd-modal-close" onClick={() => { setShowEntregaModal(false); setActivePedido(null); }}>×</button>
            </div>
            <div className="dd-modal-body" style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🚀</div>
              <p style={{ color: 'var(--gray-600)', marginBottom: '20px' }}>
                Ingresa el <strong>PIN de 4 dígitos</strong> proporcionado por el cliente para finalizar la entrega.
              </p>
              <input
                type="number"
                pattern="\d*"
                inputMode="numeric"
                className="form-input"
                style={{ fontSize: '2rem', textAlign: 'center', letterSpacing: '8px', height: '60px' }}
                placeholder="0000"
                value={pinInput}
                onChange={e => setPinInput(e.target.value.slice(0, 4))}
              />
            </div>
            <div className="dd-modal-footer">
              <button 
                className="dd-btn-verde dd-btn-large" 
                onClick={() => activePedido?.id?.includes('PRUEBA') || !activePedido ? finalizarTutorial() : finalizarEntrega(activePedido)}
              >
                Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer" style={{ background: 'var(--red-800)', color: 'white', borderTop: 'none', padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" style={{ height: '50px', objectFit: 'contain' }} />
        <p style={{ margin: 0 }}>© 2026 Wepi - Todos los derechos reservados</p>
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
              ¿Deseas arrepentirte de tu registro y eliminar tu cuenta de repartidor permanentemente de Wepi? <br/>
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
              <p>El repartidor es un trabajador independiente, no tiene relación laboral con Wepi y opera bajo su propio riesgo.</p>
              <p><strong>2. Autonomía</strong></p>
              <p>Puede aceptar/rechazar pedidos libremente, define sus propios horarios y no existe exclusividad.</p>
              <p><strong>3. Logística</strong></p>
              <p>Wepi solo facilita la asignación de pedidos. No dirige la actividad como empleador.</p>
              <p><strong>4. Responsabilidad total</strong></p>
              <p>El repartidor es responsable de accidentes, daños, estado del vehículo y cumplimiento de normas viales.</p>
              <p><strong>5. Seguro</strong></p>
              <p>Debe contar con seguro propio y cobertura médica. Wepi no provee seguros.</p>
              <p><strong>6. Exención de responsabilidad</strong></p>
              <p>Wepi no será responsable por accidentes, lesiones o daños a terceros durante la actividad.</p>
              <p><strong>7. Indemnidad</strong></p>
              <p>El repartidor mantiene indemne a Wepi ante cualquier reclamo de terceros.</p>
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
      {showSessionModal && (
        <div className="dd-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }} onClick={() => setShowSessionModal(false)}>
          <div className="dd-modal-content animate-slide-up" style={{ background: 'white', padding: '30px', borderRadius: '24px', maxWidth: '400px', width: '92%', textAlign: 'center', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div className="dd-modal-title">¿Cuánto tiempo vas a trabajar?</div>
            <p className="dd-modal-subtitle">Elegí tu tiempo de disponibilidad. <br/> Al terminar, pasarás a modo Inactivo automáticamente.</p>
            <div className="dd-duration-grid">
              <button 
                className="dd-duration-btn"
                style={{ borderColor: 'var(--red-600)' }}
                onClick={() => confirmarActivacion(1)}
              >
                <span className="icon">🧪</span>
                <span className="time">1 min</span>
                <span className="label">Solo Prueba</span>
              </button>
              <button 
                className="dd-duration-btn"
                onClick={() => confirmarActivacion(15)}
              >
                <span className="icon">⏱️</span>
                <span className="time">15 min</span>
                <span className="label">Sesión corta</span>
              </button>

              <button 
                className="dd-duration-btn"
                onClick={() => confirmarActivacion(30)}
              >
                <span className="icon">🛵</span>
                <span className="time">30 min</span>
                <span className="label">Sesión normal</span>
              </button>
            </div>

            <button 
              className="btn btn-secondary dd-btn-large" 
              style={{ width: '100%', marginTop: '24px', borderRadius: '14px', border: '1px solid #eee', color: '#666', fontWeight: 'bold' }} 
              onClick={() => setShowSessionModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {/* Ranking Modal */}
      {showRankingModal && (
        <div className="dd-modal-overlay" onClick={() => setShowRankingModal(false)}>
          <div className="dd-modal-content animate-slide-down" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="dd-modal-header" style={{ background: 'var(--red-600)' }}>
              <h5 style={{ color: 'white' }}>🏆 Top 5 Semanal</h5>
              <button className="dd-modal-close" onClick={() => setShowRankingModal(false)}>×</button>
            </div>
            <div className="dd-modal-body" style={{ padding: '0' }}>
              <div className="ranking-list">
                {ranking.map((r, i) => (
                  <div key={i} className={`ranking-item ${r.nombre === driverData?.Nombre ? 'is-me' : ''}`} style={{
                    display: 'flex', alignItems: 'center', gap: 15, padding: '15px 20px', borderBottom: '1px solid #eee',
                    background: r.posicion <= 3 ? '#fffcf0' : 'white'
                  }}>
                    <div className="rank-number" style={{ width: 30, fontWeight: 'bold', fontSize: '1.2rem', color: r.posicion <= 3 ? '#eab308' : '#999' }}>
                      {r.posicion === 1 ? '🥇' : r.posicion === 2 ? '🥈' : r.posicion === 3 ? '🥉' : r.posicion}
                    </div>
                    <img src={r.foto_url || "https://i.postimg.cc/Z5N1N0c9/user-avatar.png"} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{r.nombre} {r.nombre === driverData?.Nombre && '(Tú)'}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>{r.streak_actual || 0} racha 🔥</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--red-600)' }}>{r.puntos_totales} <small>pts</small></div>
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>{r.entregas_totales || 0} entregas</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Points History Modal */}
      {showHistoryModal && (
        <div className="dd-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="dd-modal-content animate-slide-down" onClick={e => e.stopPropagation()}>
            <div className="dd-modal-header">
              <h5>📜 Historial de Puntos</h5>
              <button className="dd-modal-close" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="dd-modal-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
              {pointsHistory.length === 0 ? (
                <p style={{ textAlign: 'center', padding: 20 }}>Aún no has acumulado puntos. ¡Responde a las alertas para ganar!</p>
              ) : (
                <div className="history-list">
                  {pointsHistory.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                          {p.motivo.startsWith('RESPONSE') ? '🎯 Respuesta a Alerta' : 
                           p.motivo.startsWith('STREAK') ? '🔥 Bonus de Racha' : p.motivo}
                        </div>
                        <small style={{ color: '#999' }}>{new Date(p.created_at).toLocaleString()}</small>
                      </div>
                      <div style={{ color: 'var(--red-500)', fontWeight: 'bold' }}>+{p.puntos}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
