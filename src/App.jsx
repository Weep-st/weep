import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Maintenance from './pages/Maintenance';
import CustomerApp from './pages/CustomerApp';
import RestaurantDashboard from './pages/RestaurantDashboard';
import DriverDashboard from './pages/DriverDashboard';
import MisPedidos from './pages/MisPedidos';
import ConfirmarEmail from './pages/ConfirmarEmail';
import AdminDashboard from './pages/AdminDashboard';
import ConsentBanner from './components/ConsentBanner';
import { useAuth } from './context/AuthContext';

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
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
          <Route path="/" element={<Maintenance />} />
          <Route path="/pedir" element={<CustomerApp />} />
          <Route path="/mis-pedidos" element={<MisPedidos />} />
          <Route path="/locales" element={<RestaurantDashboard />} />
          <Route path="/repartidores" element={<DriverDashboard />} />
          <Route path="/confirmar-email" element={<ConfirmarEmail />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ConsentBanner />
      </CartProvider>
    </AuthProvider>
  );
}
