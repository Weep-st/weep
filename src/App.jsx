import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Landing from './pages/Landing';
import CustomerApp from './pages/CustomerApp';
import RestaurantDashboard from './pages/RestaurantDashboard';
import DriverDashboard from './pages/DriverDashboard';
import MisPedidos from './pages/MisPedidos';
import ConfirmarEmail from './pages/ConfirmarEmail';
import AdminDashboard from './pages/AdminDashboard';
import { useAuth } from './context/AuthContext';

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    if (window.gtag) {
      window.gtag('config', 'G-5QRZYRMZH2', {
        page_path: location.pathname + location.search
      });
    }
  }, [location]);

  return (
    <AuthProvider>
      <CartProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pedir" element={<CustomerApp />} />
          <Route path="/mis-pedidos" element={<MisPedidos />} />
          <Route path="/locales" element={<RestaurantDashboard />} />
          <Route path="/repartidores" element={<DriverDashboard />} />
          <Route path="/confirmar-email" element={<ConfirmarEmail />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CartProvider>
    </AuthProvider>
  );
}
