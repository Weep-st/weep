import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { useJsApiLoader } from '@react-google-maps/api';
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

  const [authView, setAuthView] = useState('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Dashboard state
  const [driverData, setDriverData] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [activeTab, setActiveTab] = useState('disponibles'); // 'disponibles', 'historial'
  const [pedidos, setPedidos] = useState([]);
  const [historial, setHistorial] = useState([]); 

  const [sessionGanancias, setSessionGanancias] = useState(0);
  const [localInfo, setLocalInfo] = useState({ nombre: '', direccion: '', lat: null, lng: null });
  const [montoLocal, setMontoLocal] = useState(0);

  // Map state
  const [deliveryCoords, setDeliveryCoords] = useState({ lat: null, lng: null });
  const geocoderRef = useRef(null);

  // New views state
  const [view, setView] = useState('main'); // 'main', 'cobros', 'perfil'
  const [cobrosData, setCobrosData] = useState(null);
  const [cobrosLoading, setCobrosLoading] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [driverLocation, setDriverLocation] = useState({ lat: null, lng: null });

  // Geolocation Watcher
  useEffect(() => {
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
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [activeChatPedidoId, setActiveChatPedidoId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showMap, setShowMap] = useState(false);

  // Realtime Chat Subscription
  useEffect(() => {
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

  const loadData = useCallback(async () => {
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

  const fetchPedidos = useCallback(async (silent = false) => {
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

  // On Login/Load
  useEffect(() => {
    if (driver) {
      loadData();
      // Check if tutorial was already seen
      const hasSeenTutorial = localStorage.getItem(`tutorial_seen_driver_${driver.id}`);
      if (!hasSeenTutorial) {
        setShowTutorial(true);
        setTutorialStep(1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver]);

  // Polling para pedidos disponibles
  useEffect(() => {
    let interval;
    if (driver && isActive) {
      // First fetch
      fetchPedidos();
      // Polling cada 30 segundos
      interval = setInterval(fetchPedidos, 30000);
    } else {
      setPedidos([]);
    }
    return () => clearInterval(interval);
  }, [driver, isActive]);

  // Carga de datos del local para viaje en curso
  useEffect(() => {
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
        if (newState === 'Activo') iniciarGPS();
      }
    } catch { setIsActive(isActive); toast.error('Error de conexión'); }
  };

  const handleLogout = () => {
    logoutDriver();
    setDriverData(null);
    setIsActive(false);
    toast.success('Sesión cerrada');
  };

  const iniciarGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => toast.success('GPS activado (Demostración)'),
        () => toast.error('No se pudo activar GPS')
      );
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
        setSessionGanancias(prev => prev + 2000);
        setHistorial([{ ...pedido, fecha: new Date().toLocaleTimeString() }, ...historial]);
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

  const handleTutorialNext = () => {
    if (tutorialStep === 1) setTutorialStep(2);
    else if (tutorialStep === 2) setTutorialStep(3);
    else if (tutorialStep === 3) setTutorialStep(4);
    else if (tutorialStep === 4) setTutorialStep(5);
    else {
      setShowTutorial(false);
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
              <input type="checkbox" id="terms_accepted" name="terms_accepted" required style={{ width: 'auto', marginTop: '4px' }} />
              <label htmlFor="terms_accepted" style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
                Acepto los <button type="button" style={{ background: 'none', border: 'none', color: 'var(--red-500)', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setShowTerms(true)}>Términos y Condiciones y Política de Privacidad</button> para Repartidores.
              </label>
            </div>

            <button type="submit" className="btn btn-success btn-full" disabled={authLoading}>
              {authLoading ? <span className="spinner spinner-white" /> : 'Registrarme'}
            </button>
          </form>
        )}

        {showTerms && (
          <div className="dd-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowTerms(false)}>
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
    </div>
  );

  const renderDisponibles = () => {
    // Si hay pedidos Confirmado/Retirado, estamos "En Viaje"
    const enViaje = pedidos.find(p => p.estado === 'Confirmado' || p.estado === 'Retirado');

    if (enViaje) {
      const isRetirado = enViaje.estado === 'Retirado';
      const mapLink = !isRetirado 
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${localInfo.direccion}, Santo Tomé, Corrientes`)}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${enViaje.direccion}, Santo Tomé, Corrientes`)}`;

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
                    <span className="dd-info-value">{localInfo.nombre || 'Cargando...'}</span>
                  </div>
                  <div className="dd-info-row">
                    <span className="dd-info-label">Dirección</span>
                    <span className="dd-info-value">{localInfo.direccion || 'Cargando...'}</span>
                  </div>
                  <div className="dd-info-row">
                    <span className="dd-info-label">Efectivo a pagar al local</span>
                    <span className="dd-info-value monto">
                      {enViaje.pago === 'Efectivo' ? `$${Number(montoLocal).toLocaleString('es-AR')}` : '$0 (Ya Pago)'}
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
                  localLat={localInfo.lat}
                  localLng={localInfo.lng}
                  localName={localInfo.nombre}
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
              <button className="btn btn-light btn-full" onClick={() => openChat(enViaje.id)}>
                💬 Chat Cliente
              </button>
              {!isRetirado ? (
                <button
                  className="dd-btn-rojo"
                  onClick={() => retirarPedido(enViaje.id)}
                >
                  🏍️ Marcar RETIRADO
                </button>
              ) : (
                <button
                  className="dd-btn-verde dd-btn-large"
                  onClick={confirmarEntregaClick}
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
                  <button className="dd-btn-verde dd-btn-large" onClick={() => finalizarEntrega(enViaje)}>Confirmar Entrega</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // List of pending orders (Disponibles)
    const pendientes = pedidos.filter(p => p.estado === 'Pendiente');
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
                  <button className="dd-btn-rojo" onClick={() => aceptarPedido(p.id)}>Aceptar pedido →</button>
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
                    <span className="dd-date" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--gray-500)' }}>{new Date(h.fechaSolicitud).toLocaleDateString()}</span>
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

  // ─── MAIN RENDER ───
  return (
    <div className="dd-page">
      <header className="dd-header">
        <Link to="/">
          <img src="https://i.postimg.cc/ncZsRB0r/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(1).png" alt="Weep" className="dd-logo" />
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
                  {isActive ? 'Activo' : 'Inactivo'}
                </span>
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
        <div className="dd-tutorial-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="dd-tutorial-content animate-slide-up" style={{ background: 'white', borderRadius: '20px', maxWidth: '450px', width: '100%', overflow: 'hidden' }}>
            <div className="dd-tutorial-header" style={{ background: 'var(--red-600)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <img src="https://i.postimg.cc/ncZsRB0r/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(1).png" alt="Weep" style={{ height: '30px' }} />
              <button className="close-btn" style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }} onClick={() => { setShowTutorial(false); localStorage.setItem(`tutorial_seen_driver_${driver?.id}`, 'true'); }}>×</button>
            </div>
            <div className="dd-tutorial-body" style={{ padding: '30px', textAlign: 'center' }}>
              {tutorialStep === 1 && (
                <>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>¡Bienvenido al Panel de Repartidores! 🏍️</h3>
                  <p style={{ color: 'var(--gray-600)', lineHeight: '1.6' }}>Aquí gestionarás tus entregas y ganancias de forma rápida y sencilla.</p>
                </>
              )}
              {tutorialStep === 2 && (
                <>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>Pedidos en Tiempo Real</h3>
                  <p style={{ color: 'var(--gray-600)', lineHeight: '1.6' }}>Activa el modo <strong>"Activo"</strong> arriba a la izquierda para empezar a recibir pedidos asignados por el sistema.</p>
                </>
              )}
              {tutorialStep === 3 && (
                <>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>Cobros Online</h3>
                  <p style={{ color: 'var(--gray-600)', lineHeight: '1.6' }}>En el menú <strong>"Gestión de Cobros"</strong> podrás ver lo acumulado por pedidos con transferencia y solicitar tu pago a Weep.</p>
                </>
              )}
              {tutorialStep === 4 && (
                <>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>Configura tus Horarios</h3>
                  <p style={{ color: 'var(--gray-600)', lineHeight: '1.6' }}>En <strong>"Editar Perfil"</strong> carga tus días y horarios de disponibilidad para que el sistema sepa cuándo asignarte viajes automáticamente.</p>
                </>
              )}
              {tutorialStep === 5 && (
                <>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>¡Todo listo!</h3>
                  <p style={{ color: 'var(--gray-600)', lineHeight: '1.6' }}>Mantén siempre la app abierta y el GPS activo mientras estés de turno. ¡Buen viaje!</p>
                </>
              )}
            </div>
            <div className="dd-tutorial-footer" style={{ padding: '0 30px 30px' }}>
              <button className="dd-btn-rojo dd-btn-large" onClick={handleTutorialNext}>
                {tutorialStep === 5 ? '¡Entendido!' : 'Siguiente'}
              </button>
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
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

      <footer className="footer" style={{ background: 'var(--red-600)', color: 'white', borderTop: 'none', padding: 24, textAlign: 'center' }}>
        <p style={{ margin: 0 }}>© 2026 Weep - Todos los derechos reservados</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: '8px 0 0' }}>PWA optimizada para uso en moto • GPS en tiempo real</p>
      </footer>
    </div>
  );
}
