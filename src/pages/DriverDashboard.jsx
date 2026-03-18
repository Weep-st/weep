import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './DriverDashboard.css';

export default function DriverDashboard() {
  const { driver, loginAsDriver, logoutDriver } = useAuth();
  const [authView, setAuthView] = useState('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [driverData, setDriverData] = useState(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (driver) loadData();
  }, [driver]);

  const loadData = async () => {
    try {
      const d = await api.repartidorGetDatos(driver.id);
      if (d?.success && d.data) {
        setDriverData(d.data);
        setIsActive(d.data.Estado === 'Activo');
      }
    } catch { toast.error('Error al cargar datos'); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setAuthLoading(true);
    try {
      const d = await api.repartidorLogin(fd.get('email'), fd.get('password'));
      if (d?.success && d.data) {
        loginAsDriver(d.data.ID);
        toast.success('¡Bienvenido!');
      } else toast.error(d?.error || 'Credenciales incorrectas');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
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
      });
      if (d?.success) {
        toast.success('¡Registro exitoso! Iniciá sesión.');
        setAuthView('login');
      } else toast.error(d?.error || 'Error al registrar');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const toggleEstado = async () => {
    const newState = isActive ? 'Inactivo' : 'Activo';
    setIsActive(!isActive);
    try {
      const d = await api.repartidorActualizarEstado(driver.id, newState);
      if (!d.success) { setIsActive(isActive); toast.error('No se pudo actualizar'); }
    } catch { setIsActive(isActive); toast.error('Error de conexión'); }
  };

  const handleLogout = () => {
    logoutDriver();
    setDriverData(null);
    toast.success('Sesión cerrada');
  };

  // ─── Auth ───
  if (!driver) return (
    <div className="dd-page">
      <header className="dd-header">
        <Link to="/">
          <img src="https://i.postimg.cc/ncZsRB0r/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(1).png" alt="Weep" className="dd-logo" />
        </Link>
        <h1>Panel de Repartidores</h1>
      </header>
      <main className="dd-main">
        <div className="dd-auth-card card animate-fade-in">
          <div className="card-body">
            <h2>Acceso Repartidor</h2>
            <div className="rd-auth-tabs">
              <button className={`btn ${authView === 'login' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setAuthView('login')}>Iniciar Sesión</button>
              <button className={`btn ${authView === 'register' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setAuthView('register')}>Registrarme</button>
            </div>
            {authView === 'login' ? (
              <form onSubmit={handleLogin} className="dd-form">
                <input name="email" type="email" className="form-input" placeholder="Email" required />
                <input name="password" type="password" className="form-input" placeholder="Contraseña" required />
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Iniciar Sesión'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="dd-form">
                <input name="nombre" className="form-input" placeholder="Nombre completo" required />
                <input name="telefono" type="tel" className="form-input" placeholder="Teléfono (ej: +54911...)" required />
                <input name="email" type="email" className="form-input" placeholder="Email" required />
                <input name="password" type="password" className="form-input" placeholder="Contraseña" required />
                <input name="patente" className="form-input" placeholder="Patente de la moto" required />
                <input name="marcaModelo" className="form-input" placeholder="Marca y modelo" required />
                <button type="submit" className="btn btn-success btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Registrarme'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
      <footer className="footer"><p>© 2026 <strong>Weep</strong></p></footer>
    </div>
  );

  // ─── Dashboard ───
  return (
    <div className="dd-page">
      <header className="dd-header">
        <Link to="/">
          <img src="https://i.postimg.cc/ncZsRB0r/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(1).png" alt="Weep" className="dd-logo" />
        </Link>
        <h1>Panel de Repartidores</h1>
      </header>

      <main className="dd-main">
        {/* Top bar */}
        <div className="dd-topbar animate-fade-in">
          <div className="dd-topbar-left">
            <label className="toggle" onClick={toggleEstado}>
              <input type="checkbox" checked={isActive} readOnly />
              <span className="toggle-track" />
              <span className="toggle-thumb" />
            </label>
            <span className={`dd-status ${isActive ? 'active' : ''}`}>
              {isActive ? '🟢 Activo' : '⚫ Inactivo'}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }} onClick={handleLogout}>Cerrar sesión</button>
        </div>

        {/* Welcome */}
        <div className="dd-welcome card animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="card-body" style={{ textAlign: 'center' }}>
            <h3 style={{ color: 'var(--gray-800)', marginBottom: 4 }}>
              Bienvenido, <span style={{ color: 'var(--red-500)' }}>{driverData?.Nombre || '...'}</span>
            </h3>
            <div className="dd-stats">
              <div className="dd-stat-card">
                <span className="dd-stat-number">{driverData?.PedidosHoy || 0}</span>
                <span className="dd-stat-label">Viajes hoy</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trip Card */}
        <div className="dd-trip card animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="dd-trip-header">
            <h3>🏍️ Viaje Asignado</h3>
          </div>
          <div className="card-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: '1.1rem', color: 'var(--gray-500)' }}>No hay viaje asignado en este momento</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)', marginTop: 8 }}>Cuando te asignen un pedido aparecerá aquí</p>
          </div>
        </div>

        {/* Driver Info */}
        {driverData && (
          <div className="dd-info card animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="card-body">
              <h3 style={{ color: 'var(--red-600)', marginBottom: 16 }}>Mis Datos</h3>
              <div className="dd-info-grid">
                <div className="dd-info-item">
                  <span className="dd-info-label">Nombre</span>
                  <span className="dd-info-value">{driverData.Nombre}</span>
                </div>
                <div className="dd-info-item">
                  <span className="dd-info-label">Email</span>
                  <span className="dd-info-value">{driverData.Email}</span>
                </div>
                <div className="dd-info-item">
                  <span className="dd-info-label">Teléfono</span>
                  <span className="dd-info-value">{driverData.Telefono}</span>
                </div>
                <div className="dd-info-item">
                  <span className="dd-info-label">Vehículo</span>
                  <span className="dd-info-value">{driverData.MarcaModelo} — {driverData.Patente}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="footer"><p>© 2026 <strong>Weep</strong> — Panel de Repartidores</p></footer>
    </div>
  );
}
