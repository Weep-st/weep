import React, { useState, useEffect } from 'react';
import './ConsentBanner.css';

const ConsentBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consentChoice = localStorage.getItem('weep-consent-v2');
    if (!consentChoice) {
      // Small delay to ensure smooth layout transition
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleConsent = (granted) => {
    const consentValue = granted ? 'granted' : 'denied';
    
    // Update Google Analytics Consent Mode
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'ad_storage': consentValue,
        'analytics_storage': consentValue,
        'ad_user_data': consentValue,
        'ad_personalization': consentValue
      });
    }

    // Update Facebook Pixel (Limited Data Use / Consent)
    if (window.fbq) {
      if (granted) {
        window.fbq('consent', 'grant');
      } else {
        window.fbq('consent', 'revoke');
      }
    }

    // Save choice and hide banner
    localStorage.setItem('weep-consent-v2', consentValue);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="consent-banner">
      <div className="consent-content">
        <div className="consent-icon">🍪</div>
        <div className="consent-text">
          <h3>Tu privacidad importa</h3>
          <p>
            En Weep utilizamos cookies para mejorar tu experiencia, analizar el tráfico y personalizar la publicidad. 
            Puedes aceptar todo o seguir navegando con las cookies opcionales desactivadas. 
            Consulta nuestra <a href="/terminos" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>.
          </p>
        </div>
      </div>
      <div className="consent-actions">
        <button className="btn-consent btn-reject" onClick={() => handleConsent(false)}>
          Rechazar opcionales
        </button>
        <button className="btn-consent btn-accept" onClick={() => handleConsent(true)}>
          Aceptar todo
        </button>
      </div>
    </div>
  );
};

export default ConsentBanner;
