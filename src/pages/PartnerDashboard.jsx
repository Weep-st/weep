import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './DriverDashboard.css';

const isDriverOnShift = (d) => {
  if (!d.horario_apertura || !d.horario_cierre || !d.dias_apertura || d.dias_apertura.length === 0) {
    return false;
  }
  
  const now = new Date();
  const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  
  const daysOfWeekSpanish = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const currentDayName = daysOfWeekSpanish[argentinaTime.getDay()];
  
  if (!d.dias_apertura.includes(currentDayName)) {
    return false;
  }
  
  const currentHours = argentinaTime.getHours();
  const currentMinutes = argentinaTime.getMinutes();
  const currentTimeVal = currentHours * 60 + currentMinutes;
  
  const [startH, startM] = d.horario_apertura.split(':').map(Number);
  const startTimeVal = startH * 60 + startM;
  
  const [endH, endM] = d.horario_cierre.split(':').map(Number);
  let endTimeVal = endH * 60 + endM;
  
  if (endTimeVal < startTimeVal) {
    return currentTimeVal >= startTimeVal || currentTimeVal <= endTimeVal;
  }
  
  return currentTimeVal >= startTimeVal && currentTimeVal <= endTimeVal;
};

const PartnerDashboard = () => {
  const { driver, logoutDriver } = useAuth();

  // Route Guard Client-Side Redirect
  React.useEffect(() => {
    if (!driver || !driver.esPartner) {
      window.location.replace('/repartidores');
    }
  }, [driver]);

  // Tab & UI States
  const [partnerTab, setPartnerTab] = React.useState('pedidos');
  const [partnerData, setPartnerData] = React.useState({ activeOrders: [], historyOrders: [], broadcastOrders: [] });
  const [partnerDrivers, setPartnerDrivers] = React.useState([]);
  const [loadingPartner, setLoadingPartner] = React.useState(false);
  const [selectedDriverForAssign, setSelectedDriverForAssign] = React.useState({});
  const [showScheduleModal, setShowScheduleModal] = React.useState(false);
  const [scheduleDriver, setScheduleDriver] = React.useState(null);
  const [scheduleForm, setScheduleForm] = React.useState({ horario_apertura: '', horario_cierre: '', dias_apertura: [] });
  const [financialReport, setFinancialReport] = React.useState([]);
  const [financialStart, setFinancialStart] = React.useState('');
  const [financialEnd, setFinancialEnd] = React.useState('');

  const [partnerProfile, setPartnerProfile] = React.useState(null);
  const [pendingRequests, setPendingRequests] = React.useState([]);
  const [showPinModal, setShowPinModal] = React.useState(false);
  const [notificationStatus, setNotificationStatus] = React.useState('loading');
  const [dismissedBroadcasts, setDismissedBroadcasts] = React.useState({});
  const [selectedDriverForOverlayAssign, setSelectedDriverForOverlayAssign] = React.useState('');

  // Terms and Account Deletion
  const [showTerms, setShowTerms] = React.useState(false);
  const [showRegretModal, setShowRegretModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Chat States
  const [showChatModal, setShowChatModal] = React.useState(false);
  const [activeChatPedidoId, setActiveChatPedidoId] = React.useState(null);
  const [chatMessages, setChatMessages] = React.useState([]);
  const [chatInput, setChatInput] = React.useState('');

  // Data Fetching Function (supports silent reloading)
  const fetchPartnerData = React.useCallback(async (isSilent = false) => {
    if (!driver || !driver.esPartner) return;
    if (!isSilent) setLoadingPartner(true);
    try {
      const res = await api.repartidorGetDatos(driver.id);
      if (res.success) {
        setPartnerProfile(res.data);
      }
      const ciudad = res.success ? res.data?.ciudad : 'Santo Tomé';
      const data = await api.getPartnerPedidos(driver.id, ciudad);
      
      setPartnerData(prev => {
        const prevCount = prev?.broadcastOrders?.length || 0;
        const newCount = data?.broadcastOrders?.length || 0;
        if (newCount > prevCount && isSilent) {
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-120.wav');
            audio.play().catch(e => console.log('Audio play blocked:', e));
          } catch (e) {
            console.log('Audio init failed:', e);
          }
          toast.success('📢 ¡Nuevo pedido disponible para tu flota!', { duration: 5000 });
        }
        return data;
      });

      const drivers = await api.getPartnerDrivers(driver.id);
      setPartnerDrivers(drivers);
      const reqs = await api.getPartnerPendingRequests(driver.id);
      setPendingRequests(reqs);
    } catch (e) {
      console.error("Error fetching partner data:", e);
      if (!isSilent) toast.error("Error al cargar los datos del partner");
    } finally {
      if (!isSilent) setLoadingPartner(false);
    }
  }, [driver]);

  // Background Polling
  React.useEffect(() => {
    if (driver?.esPartner) {
      const hasData = partnerData.activeOrders?.length > 0 || partnerDrivers?.length > 0;
      fetchPartnerData(hasData);
      
      const interval = setInterval(() => {
        fetchPartnerData(true);
      }, 15000); // 15 seconds polling
      
      return () => clearInterval(interval);
    }
  }, [driver, fetchPartnerData]);

  // Realtime Orders Subscription
  React.useEffect(() => {
    if (!driver || !driver.esPartner) return;

    console.log("📡 [Partner] Subscribing to realtime updates for pedidos_general...");

    const channel = api.supabase
      .channel('public:pedidos_general_partner_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'pedidos_general'
      }, (payload) => {
        console.log("🔔 [Partner] Realtime update on pedidos_general received:", payload);
        fetchPartnerData(true);
      })
      .subscribe();

    return () => {
      api.supabase.removeChannel(channel);
    };
  }, [driver, fetchPartnerData]);

  // ─── Sync OneSignal ID ───
  React.useEffect(() => {
    if (!driver || !driver.esPartner) return;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (window.OneSignalDeferred) {
      window.OneSignalDeferred.push(async (OneSignal) => {
        try {
          console.log("🔔 OneSignal [Partner]: Checking subscription...");
          
          const updateStatus = () => {
            const perm = OneSignal.Notifications.permission;
            setNotificationStatus(perm ? 'granted' : (OneSignal.Notifications.permissionNative === 'denied' ? 'denied' : 'default'));
          };

          updateStatus();

          // 1. Initial Sync
          const currentSubscription = OneSignal.User.PushSubscription;
          if (currentSubscription.id) {
            console.log("🔔 OneSignal Partner Current ID:", currentSubscription.id);
            await api.repartidorUpdateOneSignalId(driver.id, currentSubscription.id).catch(console.error);
            console.log("✅ OneSignal Partner ID synced to database.");
          }

          // 2. Listeners for changes
          OneSignal.Notifications.addEventListener("permissionChange", async (permission) => {
            console.log("🔔 OneSignal Partner Permission changed:", permission);
            updateStatus();
            if (permission) {
              const sub = OneSignal.User.PushSubscription;
              if (sub.id) {
                await api.repartidorUpdateOneSignalId(driver.id, sub.id).catch(console.error);
              }
            }
          });

          OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
            const newId = event.current?.id || OneSignal.User.PushSubscription.id;
            console.log("🔔 OneSignal Partner ID Change Event:", newId);
            if (newId) {
              await api.repartidorUpdateOneSignalId(driver.id, newId).catch(console.error);
            }
          });

          // 3. Prompt logic
          if (!isIOS && OneSignal.Notifications.permissionNative === 'default') {
            console.log("🔔 OneSignal: Autoprompting Partner...");
            const granted = await OneSignal.Notifications.requestPermission();
            if (granted) {
              setTimeout(async () => {
                const subId = OneSignal.User.PushSubscription.id;
                if (subId) {
                  await api.repartidorUpdateOneSignalId(driver.id, subId).catch(console.error);
                }
              }, 1000);
            }
          }

        } catch (err) {
          console.error("❌ OneSignal Partner Sync Error:", err);
        }
      });
    }
  }, [driver]);

  // Realtime Chat Subscription
  React.useEffect(() => {
    if (!activeChatPedidoId) return;

    const channel = api.supabase
      .channel(`chat_partner_${activeChatPedidoId}`)
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

  // Load Financial Reports based on Date Filters
  React.useEffect(() => {
    if (driver?.esPartner && partnerTab === 'reportes') {
      const loadReport = async () => {
        try {
          const report = await api.partnerGetFinancialReport(driver.id, financialStart, financialEnd);
          setFinancialReport(report);
        } catch (e) {
          console.error("Error loading financial report:", e);
          toast.error("Error al generar el reporte");
        }
      };
      loadReport();
    }
  }, [driver, partnerTab, financialStart, financialEnd]);

  // Handlers
  const handleAssignPedido = async (pedidoId, driverId) => {
    if (!driverId) {
      toast.error("Selecciona un repartidor primero");
      return;
    }
    try {
      await api.partnerAssignPedido(pedidoId, driverId);
      toast.success("Pedido propuesto al repartidor con éxito");
      fetchPartnerData(true);
    } catch (e) {
      toast.error("Error al asignar pedido: " + e.message);
    }
  };

  const handleUnassignPedido = async (pedidoId) => {
    try {
      await api.partnerUnassignPedido(pedidoId);
      toast.success("Propuesta de pedido cancelada");
      fetchPartnerData(true);
    } catch (e) {
      toast.error("Error al desasignar: " + e.message);
    }
  };

  const handleConfirmVinculacion = async (driverId, aceptar) => {
    try {
      const res = await api.confirmarVinculacion(driverId, driver.id, aceptar);
      if (res.success) {
        toast.success(aceptar ? "Repartidor vinculado con éxito" : "Solicitud rechazada");
        fetchPartnerData(true);
      } else {
        toast.error("Error al procesar vinculación");
      }
    } catch (e) {
      toast.error("Error: " + e.message);
    }
  };

  const handleDesvincularDriver = async (driverId) => {
    if (!window.confirm("¿Seguro que deseas desvincular a este repartidor de tu empresa?")) return;
    try {
      const res = await api.desvincularDriver(driverId);
      if (res.success) {
        toast.success("Repartidor desvinculado con éxito");
        fetchPartnerData(true);
      } else {
        toast.error("Error al desvincular");
      }
    } catch (e) {
      toast.error("Error: " + e.message);
    }
  };

  const openScheduleModal = (drv) => {
    setScheduleDriver(drv);
    setScheduleForm({
      horario_apertura: drv.horario_apertura || '',
      horario_cierre: drv.horario_cierre || '',
      dias_apertura: drv.dias_apertura || []
    });
    setShowScheduleModal(true);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.partnerUpdateDriverSchedule(scheduleDriver.id, scheduleForm);
      toast.success("Horario del repartidor actualizado");
      setShowScheduleModal(false);
      fetchPartnerData(true);
    } catch (err) {
      toast.error("Error al actualizar horario: " + err.message);
    }
  };

  const toggleDayInSchedule = (day) => {
    const current = [...(scheduleForm.dias_apertura || [])];
    const idx = current.indexOf(day);
    if (idx === -1) {
      current.push(day);
    } else {
      current.splice(idx, 1);
    }
    setScheduleForm({ ...scheduleForm, dias_apertura: current });
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

  // Render Sub-Views
  const renderPartnerPedidos = () => {
    const list = partnerData.activeOrders || [];
    if (list.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '16px', color: '#64748b' }}>
          <h4 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>No hay pedidos activos en este momento</h4>
          <p style={{ margin: 0 }}>Los pedidos que asignes y que tus repartidores acepten aparecerán aquí.</p>
        </div>
      );
    }
    return (
      <div className="partner-orders-grid" style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {list.map(p => (
          <div key={p.id} className="partner-order-card" style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: '1px solid #edf2f7'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: 'var(--red-600)', fontSize: '1rem' }}>#{p.id.split('-')[1] || p.id}</strong>
              <span className={`dd-badge estado-${p.estado?.toLowerCase().replace(/\s+/g, '-')}--badge`} style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '50px',
                fontWeight: 'bold'
              }}>
                {p.estado}
              </span>
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: '700' }}>{p.nombre_local}</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>📍 {p.direccion}</p>
            </div>
            <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Cliente:</span>
                <strong>{p.nombre_cliente}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Repartidor:</span>
                <strong style={{ color: '#2563eb' }}>🛵 {p.nombre_repartidor}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #edf2f7' }}>
              <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Valor: <strong>${Math.round(p.monto)}</strong></span>
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setActiveChatPedidoId(p.id);
                  setShowChatModal(true);
                  api.getChatMessages(p.id).then(msgs => setChatMessages(msgs)).catch(console.error);
                }}
              >
                💬 Chat Cliente
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPartnerBroadcasts = () => {
    const list = partnerData.broadcastOrders || [];
    if (list.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '16px', color: '#64748b' }}>
          <h4 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>No hay alertas de pedidos en curso</h4>
          <p style={{ margin: 0 }}>Cuando entre un pedido para entrega en tu ciudad, aparecerá aquí.</p>
        </div>
      );
    }
    return (
      <div style={{ display: 'grid', gap: '16px' }}>
        {list.map(p => {
          return (
            <div key={p.id} className="partner-broadcast-card" style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              border: '1px solid #edf2f7'
            }}>
              <div style={{ flex: '1', minWidth: '240px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--red-600)', fontSize: '1.05rem' }}>#{p.id.split('-')[1] || p.id}</strong>
                  <span style={{ fontSize: '0.75rem', background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>NUEVO PEDIDO EN BROADCAST</span>
                </div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '700' }}>{p.nombre_local}</h4>
                <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#64748b' }}>📍 {p.direccion}</p>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: '#64748b' }}>
                  <span>Cliente: <strong>{p.nombre_cliente}</strong></span>
                  <span>Envío: <strong>${Math.round(p.precio_envio)}</strong></span>
                  <span>Pago: <strong>{p.pago}</strong></span>
                </div>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                flexWrap: 'wrap',
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #edf2f7',
                color: '#475569',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}>
                <span className="spinner-small" style={{ marginRight: '8px', display: 'inline-block' }}></span>
                <span>⚡ Enviado a toda tu flota (Esperando que un repartidor acepte...)</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPartnerDriversList = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            className="btn btn-primary"
            onClick={() => setShowPinModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🔑 Código de Vinculación
          </button>
        </div>

        {/* Solicitudes Pendientes */}
        {pendingRequests.length > 0 && (
          <div style={{ 
            background: '#fffbeb', 
            border: '1px solid #fef3c7', 
            borderRadius: '16px', 
            padding: '20px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '800', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span> Solicitudes de Vinculación Pendientes
            </h3>
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {pendingRequests.map(req => (
                <div key={req.id} style={{ 
                  background: 'white', 
                  borderRadius: '12px', 
                  padding: '16px', 
                  border: '1px solid #fde68a',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>{req.nombre}</strong>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>📞 {req.telefono}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn btn-primary btn-sm" 
                      style={{ flex: 1, background: '#10b981', borderColor: '#10b981' }}
                      onClick={() => handleConfirmVinculacion(req.id, true)}
                    >
                      Aceptar
                    </button>
                    <button 
                      className="btn btn-outline btn-sm text-red" 
                      style={{ flex: 1 }}
                      onClick={() => handleConfirmVinculacion(req.id, false)}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #edf2f7' }}>
          <table className="partner-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #edf2f7' }}>
                <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: '700', color: '#64748b' }}>Nombre</th>
                <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: '700', color: '#64748b' }}>Contacto</th>
                <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: '700', color: '#64748b' }}>Vehículo / Patente</th>
                <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: '700', color: '#64748b' }}>Estado</th>
                <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: '700', color: '#64748b' }}>Turno</th>
                <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: '700', color: '#64748b' }}>Promedio Retiro</th>
                <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: '700', color: '#64748b', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {partnerDrivers.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={d.foto_url || "https://i.postimg.cc/Z5N1N0c9/user-avatar.png"} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <strong style={{ display: 'block' }}>{d.nombre}</strong>
                        <small style={{ color: '#94a3b8' }}>ID: {d.id}</small>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '0.9rem' }}>
                    <div style={{ color: '#64748b' }}>📞 {d.telefono}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>📧 {d.email}</div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '0.9rem' }}>
                    <div>🚗 {d.tipo_vehiculo || 'Moto'} ({d.marca_modelo || '—'})</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>🪪 Patente: {d.patente || '—'}</div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className={`dd-badge estado-${d.estado?.toLowerCase() || 'inactivo'}`} style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '50px',
                      fontWeight: 'bold'
                    }}>
                      {d.estado || 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {isDriverOnShift(d) ? (
                        <span className="dd-badge" style={{
                          alignSelf: 'flex-start',
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '50px',
                          fontWeight: 'bold',
                          background: '#e6f4ea',
                          color: '#137333'
                        }}>
                          🟢 En Turno
                        </span>
                      ) : (
                        <span className="dd-badge" style={{
                          alignSelf: 'flex-start',
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '50px',
                          fontWeight: 'bold',
                          background: '#f1f3f4',
                          color: '#5f6368'
                        }}>
                          ⚪ Fuera de Turno
                        </span>
                      )}
                      {d.horario_apertura && d.horario_cierre && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          ⏰ {d.horario_apertura} - {d.horario_cierre}
                        </div>
                      )}
                      {d.dias_apertura && d.dias_apertura.length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          📅 {d.dias_apertura.map(day => day.substring(0, 3)).join(', ')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '0.9rem' }}>
                    {d.promedio_retiro !== undefined && d.promedio_retiro !== null ? (
                      <strong>{d.promedio_retiro} min</strong>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button 
                        className="btn btn-outline btn-sm"
                        onClick={() => openScheduleModal(d)}
                      >
                        ⚙️ Horarios
                      </button>
                      <button 
                        className="btn btn-outline btn-sm text-red"
                        onClick={() => handleDesvincularDriver(d.id)}
                      >
                        Desvincular
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {partnerDrivers.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No tienes repartidores vinculados. Comparte tu PIN de vinculación usando el botón superior.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPartnerReports = () => {
    const totalVolume = financialReport.reduce((acc, r) => acc + r.totalVolume, 0);
    const totalDeliveries = financialReport.reduce((acc, r) => acc + r.totalDeliveries, 0);
    const totalEarnings = financialReport.reduce((acc, r) => acc + r.totalEarnings, 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          border: '1px solid #edf2f7'
        }}>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '160px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 650 }}>Desde</label>
            <input 
              type="date" 
              className="form-input" 
              value={financialStart} 
              onChange={e => setFinancialStart(e.target.value)}
              style={{ margin: 0 }}
            />
          </div>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '160px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 650 }}>Hasta</label>
            <input 
              type="date" 
              className="form-input" 
              value={financialEnd} 
              onChange={e => setFinancialEnd(e.target.value)}
              style={{ margin: 0 }}
            />
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ alignSelf: 'flex-end', padding: '10px 20px' }}
            onClick={() => { setFinancialStart(''); setFinancialEnd(''); }}
          >
            Limpiar Filtros
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #edf2f7', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>VOLUMEN TOTAL VENDIDO</span>
            <h3 style={{ margin: '6px 0 0', fontSize: '1.6rem', color: '#1e293b', fontWeight: '800' }}>
              ${totalVolume.toLocaleString('es-AR')}
            </h3>
          </div>
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #edf2f7', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>ENTREGAS COMPLETADAS</span>
            <h3 style={{ margin: '6px 0 0', fontSize: '1.6rem', color: '#1e293b', fontWeight: '800' }}>
              {totalDeliveries}
            </h3>
          </div>
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #edf2f7', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>INGRESOS TOTALES ENVÍOS</span>
            <h3 style={{ margin: '6px 0 0', fontSize: '1.6rem', color: '#10b981', fontWeight: '800' }}>
              ${totalEarnings.toLocaleString('es-AR')}
            </h3>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #edf2f7' }}>
          <table className="partner-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #edf2f7' }}>
                <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: '700', color: '#64748b' }}>Repartidor</th>
                <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: '700', color: '#64748b', textAlign: 'center' }}>Entregas</th>
                <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: '700', color: '#64748b', textAlign: 'right' }}>Volumen Ventas</th>
                <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: '700', color: '#64748b', textAlign: 'right' }}>Ingreso Envios</th>
              </tr>
            </thead>
            <tbody>
              {financialReport.map(r => (
                <tr key={r.driverId} style={{ borderBottom: '1px solid #edf2f7' }}>
                  <td style={{ padding: '16px 20px', fontWeight: '600' }}>{r.driverName}</td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>{r.totalDeliveries}</td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>${r.totalVolume.toLocaleString('es-AR')}</td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>${r.totalEarnings.toLocaleString('es-AR')}</td>
                </tr>
              ))}
              {financialReport.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No hay datos registrados en este rango de fechas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBroadcastOverlay = () => {
    const todosDisponibles = (partnerData.broadcastOrders || [])
      .filter(p => !dismissedBroadcasts[p.id]);

    if (todosDisponibles.length === 0) return null;

    const p = todosDisponibles[0];
    const isLento = p.nivel_rapidez === 2;

    return (
      <div className="dd-broadcast-overlay" style={{ zIndex: 2500 }}>
        <div className={`dd-broadcast-popup animate-pop-in ${isLento ? 'lento' : ''}`} style={{ maxWidth: '380px' }}>
          <div className="popup-header" style={{ background: 'var(--red-600)' }}>
            <div className="popup-badge">NUEVO PEDIDO EN BROADCAST 📢</div>
          </div>
          
          <div className="popup-body" style={{ padding: '20px' }}>
            <div className="popup-amount" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span className="amount-label" style={{ color: '#64748b', fontSize: '0.85rem' }}>Ganancia Envío</span>
              <span className="amount-value" style={{ color: 'var(--red-600)', fontSize: '2rem', fontWeight: 'bold' }}>${Number(p.precio_envio || 0).toLocaleString('es-AR')}</span>
            </div>
            
            <div className="popup-details" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
              <div className="detail-item" style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem' }}>
                <span className="detail-icon">🏢</span>
                <span className="detail-text"><strong>Local:</strong> {p.nombre_local}</span>
              </div>
              <div className="detail-item" style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem' }}>
                <span className="detail-icon">👤</span>
                <span className="detail-text"><strong>Cliente:</strong> {p.nombre_cliente}</span>
              </div>
              <div className="detail-item" style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem' }}>
                <span className="detail-icon">📍</span>
                <span className="detail-text"><strong>Dirección:</strong> {p.direccion}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '16px', textAlign: 'center', color: '#475569', fontSize: '0.85rem', fontWeight: '500' }}>
              ⚡ Enviado automáticamente a tu flota de repartidores activos.
            </div>
          </div>

          <div className="popup-footer" style={{ display: 'flex', gap: '10px', padding: '15px 20px', background: '#f8fafc', borderTop: '1px solid #edf2f7' }}>
            <button 
              className="btn btn-primary btn-full" 
              style={{ flex: 1, padding: '10px', background: '#10b981', borderColor: '#10b981', color: 'white', borderRadius: '6px', fontWeight: 'bold' }}
              onClick={() => setDismissedBroadcasts(prev => ({ ...prev, [p.id]: true }))}
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPinModal = () => {
    return (
      <div className="dd-modal-overlay" onClick={() => setShowPinModal(false)}>
        <div className="dd-modal-content animate-slide-down" style={{ maxWidth: '400px', textAlign: 'center', padding: '24px' }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔑</div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', fontWeight: 'bold' }}>Código de Vinculación</h3>
          <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5', marginBottom: '20px' }}>
            Comparte este PIN con tus repartidores para que soliciten vincularse a tu empresa de logística:
          </p>
          <div style={{ 
            background: '#f1f5f9', 
            border: '2px dashed #cbd5e1', 
            borderRadius: '12px', 
            padding: '16px', 
            fontSize: '2rem', 
            fontWeight: '800', 
            letterSpacing: '4px', 
            color: 'var(--red-600)',
            marginBottom: '20px',
            display: 'inline-block',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {partnerProfile?.partner_pin || '------'}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 24px 0' }}>
            Deben ingresarlo desde su app en <strong>Menú &gt; Configuración</strong>.
          </p>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowPinModal(false)}>Cerrar</button>
        </div>
      </div>
    );
  };

  const renderScheduleModal = () => {
    const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return (
      <div className="dd-modal-overlay" onClick={() => setShowScheduleModal(false)}>
        <div className="dd-modal-content animate-slide-down" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
          <div className="dd-modal-header" style={{ background: 'var(--red-600)' }}>
            <h5 style={{ color: 'white', margin: 0 }}>⚙️ Horarios de {scheduleDriver?.nombre}</h5>
            <button className="dd-modal-close" onClick={() => setShowScheduleModal(false)}>×</button>
          </div>
          <form onSubmit={handleScheduleSubmit}>
            <div className="dd-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 650 }}>Hora Apertura</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={scheduleForm.horario_apertura} 
                    onChange={e => setScheduleForm({ ...scheduleForm, horario_apertura: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 650 }}>Hora Cierre</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={scheduleForm.horario_cierre} 
                    onChange={e => setScheduleForm({ ...scheduleForm, horario_cierre: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 650 }}>Días Laborales</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {daysOfWeek.map(day => {
                    const isChecked = scheduleForm.dias_apertura?.includes(day);
                    return (
                      <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => toggleDayInSchedule(day)}
                          style={{ width: '16px', height: '16px' }}
                        />
                        {day}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="dd-modal-footer" style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowScheduleModal(false)}>Cancelar</button>
              <button type="submit" className="dd-btn-rojo" style={{ flex: 1 }}>Guardar Cambios</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (!driver || !driver.esPartner) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px', color: '#64748b' }}>
        Redireccionando...
      </div>
    );
  }

  return (
    <div className="dd-page">
      <header className="dd-header">
        <div className="dd-header-top">
          <Link to="/">
            <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" className="dd-logo" />
          </Link>
          <button className="dd-header-menu-btn" style={{ width: 'auto', padding: '8px 16px', fontSize: '0.85rem' }} onClick={logoutDriver}>
            🚪 Cerrar Sesión
          </button>
        </div>
        <h1>Panel Partner Logístico</h1>
      </header>

      <main className="dd-main partner-container animate-fade-in" style={{
        background: '#f8f9fa',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        flex: 1,
        padding: '24px 16px',
        color: 'var(--gray-800)',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Banner de Advertencia de Notificaciones Push */}
        {notificationStatus !== 'granted' && (
          <div style={{
            background: '#fff2f2',
            border: '1px solid #fee2e2',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem' }}>🛎️</span>
              <div style={{ fontSize: '0.85rem', color: '#991b1b', textAlign: 'left' }}>
                <strong>Notificaciones desactivadas:</strong> Actívalas para enterarte en tiempo real de nuevos pedidos sin tener que recargar la página.
              </div>
            </div>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={() => {
                if (window.OneSignal) {
                  window.OneSignal.Notifications.requestPermission();
                }
              }}
              style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'var(--red-600)', borderColor: 'var(--red-600)', whiteSpace: 'nowrap', color: 'white' }}
            >
              Activar Notificaciones
            </button>
          </div>
        )}

        {/* Top Info Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--gray-900)' }}>Gestión Logística</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>Gestiona tus repartidores y envíos asignados en tiempo real</p>
          </div>
        </div>


        <div className="partner-tabs" style={{
          display: 'flex',
          gap: '8px',
          background: 'rgba(0,0,0,0.03)',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '24px',
          width: 'fit-content',
          overflowX: 'auto',
          maxWidth: '100%'
        }}>
          <button 
            className={`partner-tab-btn ${partnerTab === 'pedidos' ? 'active' : ''}`}
            onClick={() => setPartnerTab('pedidos')}
          >
            📋 Activos ({partnerData.activeOrders?.length || 0})
          </button>
          <button 
            className={`partner-tab-btn ${partnerTab === 'broadcasts' ? 'active' : ''}`}
            onClick={() => setPartnerTab('broadcasts')}
          >
            📡 Broadcasts ({partnerData.broadcastOrders?.length || 0})
          </button>
          <button 
            className={`partner-tab-btn ${partnerTab === 'repartidores' ? 'active' : ''}`}
            onClick={() => setPartnerTab('repartidores')}
          >
            🏍️ Repartidores
          </button>
          <button 
            className={`partner-tab-btn ${partnerTab === 'reportes' ? 'active' : ''}`}
            onClick={() => setPartnerTab('reportes')}
          >
            📊 Reportes Financieros
          </button>
        </div>

        {loadingPartner ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#64748b' }}>
            Cargando datos de partner...
          </div>
        ) : (
          <div>
            {partnerTab === 'pedidos' && renderPartnerPedidos()}
            {partnerTab === 'broadcasts' && renderPartnerBroadcasts()}
            {partnerTab === 'repartidores' && renderPartnerDriversList()}
            {partnerTab === 'reportes' && renderPartnerReports()}
          </div>
        )}

        {showPinModal && renderPinModal()}
        {showScheduleModal && renderScheduleModal()}

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
      </main>

      <footer className="footer" style={{ background: 'var(--red-800)', color: 'white', borderTop: 'none', padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" style={{ height: '50px', objectFit: 'contain' }} />
        <p style={{ margin: 0 }}>© 2026 Wepi - Todos los derechos reservados</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: 0 }}>Panel de Administración de Partners Logísticos • GPS en tiempo real</p>
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
              ¿Deseas arrepentirte de tu registro y eliminar tu cuenta de partner permanentemente de Wepi? <br/>
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
                    toast.success("Cuenta de partner eliminada correctamente.");
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
                <li>Seguimiento de seguridad</li>
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
      {renderBroadcastOverlay()}
    </div>
  );

};

export default PartnerDashboard;
