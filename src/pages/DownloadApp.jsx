import React, { useEffect } from 'react';

export default function DownloadApp() {
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // Detectar iOS
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      window.location.replace("https://apps.apple.com/ar/app/wepi-app/id6801576564");
      return;
    }

    // Detectar Android
    if (/android/i.test(userAgent)) {
      window.location.replace("https://play.google.com/store/apps/details?id=com.wepi.app");
      return;
    }

    // Si es PC o Mac, redirigir a la landing page principal
    window.location.replace("/");
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: 'Inter, sans-serif'
    }}>
      <img 
        src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" 
        alt="Wepi" 
        style={{ width: '150px', marginBottom: '20px' }} 
      />
      <div style={{
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #d32f2f',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{ marginTop: '20px', color: '#666', fontWeight: '500' }}>
        Redirigiendo a tu tienda de aplicaciones...
      </p>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}
