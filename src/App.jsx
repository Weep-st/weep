import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Landing from './pages/Landing';
import Maintenance from './pages/Maintenance';
import CustomerApp from './pages/CustomerApp';
import PruebasApp from './pages/PruebasApp';
import RestaurantDashboard from './pages/RestaurantDashboard';
import PruebaDashboard from './pages/PruebaDashboard';
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

    // 3. Section Tracking for PWA Magic Redirect
    const path = location.pathname;
    if (['/pedir', '/repartidores', '/locales', '/admin', '/prueba', '/mis-pedidos'].some(s => path.startsWith(s))) {
      localStorage.setItem('weep-last-section', path);
    }
  }, [location]);

  // 3. Dynamic PWA Manifest Update
  useEffect(() => {
    const existingLink = document.getElementById('manifest-link');
    const path = location.pathname;
    
    let config = { name: "Weep", start: "/", title: "Weep" };
    if (path.startsWith('/pedir') || path.startsWith('/mis-pedidos')) { config = { name: "Weep - Pedidos", start: "/pedir", title: "Weep - Pedidos" }; }
    else if (path.startsWith('/locales') || path.startsWith('/prueba')) { config = { name: "Weep - Locales", start: "/locales", title: "Weep - Locales" }; }
    else if (path.startsWith('/admin')) { config = { name: "Weep - Admin", start: "/admin", title: "Weep - Admin" }; }
    else if (path.startsWith('/repartidores')) { config = { name: "Weep - Repartidores", start: "/repartidores", title: "Weep - Repartidores" }; }

    // URL Robusta para start_url (usa el truco de ?p= para evitar recortes de Safari)
    const pwaStartUrl = window.location.origin + (config.start === '/' ? '/?mode=pwa' : '/?p=' + config.start + '&mode=pwa');

    const manifestData = {
      "name": config.name,
      "short_name": "Weep",
      "description": "Plataforma de Pedidos y Delivery en Santo Tomé",
      "start_url": pwaStartUrl, 
      "scope": "/",
      "display": "standalone",
      "background_color": "#ffffff",
      "theme_color": "#c62828",
      "icons": [
        { "src": "https://i.postimg.cc/FKJD6LHQ/buscamos-repartidores-(10).png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
        { "src": "https://i.postimg.cc/FKJD6LHQ/buscamos-repartidores-(10).png", "sizes": "512x512", "type": "image/png" }
      ]
    };

    const blob = new Blob([JSON.stringify(manifestData)], {type: 'application/json'});
    const manifestUrl = URL.createObjectURL(blob);

    if (existingLink) {
      existingLink.href = manifestUrl;
    } else {
      const newLink = document.createElement('link');
      newLink.id = 'manifest-link';
      newLink.rel = 'manifest';
      newLink.href = manifestUrl;
      document.head.appendChild(newLink);
    }

    let canonical = document.getElementById('canonical-link');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.id = 'canonical-link';
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', absoluteStartUrl);

    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) {
      appleTitle.setAttribute('content', config.title);
    }
  }, [location.pathname]);

  return (
    <AuthProvider>
      <CartProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/mantenimiento" element={<Maintenance />} />
          <Route path="/pedir" element={
            <MaintenanceGuard configKey="mantenimiento_pedir">
              <PruebasApp />
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
          <Route path="/prueba" element={
            <MaintenanceGuard configKey="mantenimiento_locales">
              <PruebaDashboard />
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
