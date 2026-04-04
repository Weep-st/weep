import { useEffect } from 'react';
import './Maintenance.css';

export default function Maintenance() {
  useEffect(() => {
    // 1. Google Analytics Logging (if window.gtag exists)
    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: 'Mantenimiento - Weep',
        page_location: window.location.href,
        page_path: window.location.pathname
      });
    }

    // 2. Clear anything in localStorage if needed (like the cart) 
    // This is optional, but recommended if maintenance affects order processing
    // localStorage.removeItem('weep-cart');
  }, []);

  return (
    <div className="maintenance-page">
      <header>
        <img
          src="https://res.cloudinary.com/dw10wkbac/image/upload/v1775234747/gvapffe3wwp4ljgr33le.png"
          alt="Weep"
          className="maintenance-logo"
        />
      </header>
      
      <main className="maintenance-card card animate-fade-in">
        <span className="maintenance-icon">🛠️</span>
        <h1 className="maintenance-title">Estamos mejorando para vos</h1>
        <p className="maintenance-text">
          Estamos realizando tareas de mantenimiento para que tu experiencia sea cada vez mejor. 
          En unos minutos estaremos de vuelta con vos.
        </p>
        
        <div className="maintenance-status">
          Estado: Mantenimiento Crítico
        </div>
        
        <div className="maintenance-footer">
          <p>© 2026 Weep • Santo Tomé</p>
          <a href="https://www.instagram.com/weep.st" target="_blank" rel="noopener noreferrer">
            Seguinos en Instagram para novedades
          </a>
        </div>
      </main>
    </div>
  );
}
