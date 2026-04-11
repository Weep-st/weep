import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Landing from './pages/Landing';
import Maintenance from './pages/Maintenance';
import CustomerApp from './pages/CustomerApp';
import RestaurantDashboard from './pages/RestaurantDashboard';
import DriverDashboard from './pages/DriverDashboard';
import MisPedidos from './pages/MisPedidos';
import ConfirmarEmail from './pages/ConfirmarEmail';
import AdminDashboard from './pages/AdminDashboard';
import ConsentBanner from './components/ConsentBanner';
import { useAuth } from './context/AuthContext';
import * as api from './services/api';

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function MaintenanceGuard({ children, configKey }) {
  const { user } = useAuth();
  const [inMaintenance, setInMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkMaintenance() {
      try {
        const config = await api.getConfiguracion();
        if (config[configKey] && user?.role !== 'admin') {
          setInMaintenance(true);
        }
      } catch (error) {
        console.error("Error checking maintenance status:", error);
      } finally {
        setLoading(false);
      }
    }
    checkMaintenance();
  }, [configKey, user]);

  if (loading) return null;
  if (inMaintenance) return <Navigate to="/mantenimiento" replace />;
  return children;
}


export default function App() {
  const location = useLocation();

  useEffect(() => {
    // 0. Version Check & Hard Update
    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json?v=' + Date.now());
        if (!response.ok) return;
        
        const data = await response.json();
        const serverVersion = data.version;
        const localVersion = localStorage.getItem('weep-app-version');

        if (localVersion && localVersion !== serverVersion) {
          console.warn('🔄 Nueva versión detectada:', serverVersion, '. Forzando actualización...');
          
          // Limpiar caché y Service Workers
          localStorage.clear();
          sessionStorage.clear();
          
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
              await registration.unregister();
            }
          }
          
          // Guardar nueva versión ANTES de recargar
          localStorage.setItem('weep-app-version', serverVersion);
          
          // Forzar recarga completa
          window.location.reload();
        } else if (!localVersion) {
          localStorage.setItem('weep-app-version', serverVersion);
        }
      } catch (e) {
        console.error('Error verificando versión:', e);
      }
    };
    checkVersion();

    // 1. Google Analytics Tracking
    if (window.gtag) {
      window.gtag('config', 'G-5QRZYRMZH2', {
        page_path: location.pathname + location.search
      });
    }

    // 2. Restore Consent State if exists
    const savedConsent = localStorage.getItem('weep-consent-v2');
    if (savedConsent && window.gtag) {
      window.gtag('consent', 'update', {
        'ad_storage': savedConsent,
        'analytics_storage': savedConsent,
        'ad_user_data': savedConsent,
        'ad_personalization': savedConsent
      });
    }
  }, [location]);

  return (
    <AuthProvider>
      <CartProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/mantenimiento" element={<Maintenance />} />
          <Route path="/pedir" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <CustomerApp />
            </MaintenanceGuard>
          } />
          <Route path="/mis-pedidos" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <MisPedidos />
            </MaintenanceGuard>
          } />
          <Route path="/locales" element={
            <MaintenanceGuard configKey="mantenimiento_locales">
              <RestaurantDashboard />
            </MaintenanceGuard>
          } />
          <Route path="/repartidores" element={
            <MaintenanceGuard configKey="mantenimiento_repartidores">
              <DriverDashboard />
            </MaintenanceGuard>
          } />

          <Route path="/confirmar-email" element={<ConfirmarEmail />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ConsentBanner />
      </CartProvider>
    </AuthProvider>
  );
}
