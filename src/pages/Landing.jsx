import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

export default function Landing() {
  
  useEffect(() => {
    // 1. PWA Magic Redirect Fallback
    // Aunque ahora usamos el Hub como pantalla principal, mantenemos la detección
    // por si el PWA tiene guardado un destino directo.
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const searchParams = new URLSearchParams(window.location.search);
    const isPWAMode = searchParams.get('mode') === 'pwa';

    if (isPWA || isPWAMode) {
      const lastSection = localStorage.getItem('weep-last-section');
      if (lastSection && lastSection !== '/') {
        console.log('🚀 PWA Launch detectado. Redirigiendo a:', lastSection);
        window.location.replace(lastSection);
      }
    }
  }, []);

  return (
    <div className="landing">
      <header className="landing-header">
        <img
          src="https://i.postimg.cc/Y0Ln7qb3/Digitalizacion-y-logistica-para-Santo-Tome-(1).png"
          alt="Weep"
          className="landing-logo"
        />
      </header>

      <main className="landing-main">
        <div className="hub-container">
          
          <div className="hub-hero animate-fade-in">
            <h1 className="hub-title">Todo lo que buscás, <span>está en Weep.</span></h1>
            <p className="hub-subtitle">
              Pedí de tus locales favoritos o gestioná tu negocio desde un solo lugar.
            </p>
          </div>

          {/* ACCIÓN PRINCIPAL: PEDIDOS */}
          <div className="animate-fade-in animate-delay-1">
            <Link to="/pedir" className="btn-hub-primary">
              <span className="icon">🍔</span>
              Pedí ahora
            </Link>
          </div>

          {/* ACCIONES SECUNDARIAS: LOCALES Y REPARTIDORES */}
          <div className="hub-secondary-grid animate-fade-in animate-delay-2">
            <Link to="/locales" className="btn-hub-secondary">
              <span className="icon">🏪</span>
              Área Locales
            </Link>
            <Link to="/repartidores" className="btn-hub-secondary">
              <span className="icon">🏍️</span>
              Soy Repartidor
            </Link>
          </div>

        </div>
      </main>

      <footer className="footer">
        <p>© 2026 <strong>Weep</strong> — Plataforma de Pedidos y Delivery</p>
        <p>Santo Tomé, Corrientes</p>
      </footer>
    </div>
  );
}
