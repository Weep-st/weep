const fs = require('fs');

function addSuccessPanel() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    // 1. Update handleRegister
    const handleRegisterRegex = /setModal\(null\);\s*const isInactiveCity = !ciudad\.includes\('Santo Tomé'\) && !ciudad\.includes\('Oberá'\);\s*if \(isInactiveCity\) \{\s*toast\.success\([^}]+\} else \{\s*toast\.success\('¡Registro exitoso!'\);\s*\}/g;
    
    const newHandleRegister = `            const isInactiveCity = !ciudad.includes('Santo Tomé') && !ciudad.includes('Oberá');
            if (isInactiveCity) {
              setInactiveCityModal(ciudad);
              setModal('success_inactive');
            } else {
              setModal(null);
              toast.success('¡Registro exitoso!');
            }`;

    if (content.match(handleRegisterRegex)) {
        content = content.replace(handleRegisterRegex, newHandleRegister);
    } else {
        console.log("Could not find handleRegister logic to replace.");
    }

    // 2. Add success_inactive modal UI
    const successPanelHTML = `
            {modal === 'success_inactive' && (
              <div style={{ padding: '16px 8px', textAlign: 'center' }}>
                <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.75rem', fontWeight: '800', padding: '5px 14px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-block', marginBottom: '16px' }}>
                  Próximamente 🚀
                </span>
                
                <h2 style={{ fontSize: '1.45rem', color: '#0f172a', marginBottom: '10px', fontWeight: '800' }}>¡Registro Exitoso!</h2>
                
                <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '24px' }}>
                  Recibirás novedades exclusivas por email o WhatsApp apenas iniciemos el lanzamiento en tu ciudad.
                </p>
                
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', marginBottom: '24px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Localidad seleccionada</span>
                  <strong style={{ fontSize: '1.25rem', color: '#e63946', fontWeight: '800' }}>{inactiveCityModal || user?.ciudad}</strong>
                </div>
                
                <button 
                  onClick={() => setModal(null)} 
                  className="btn-full"
                  style={{ width: '100%', background: 'linear-gradient(135deg, #e63946 0%, #b5179e 100%)', color: 'white', padding: '14px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 12px rgba(230,57,70,0.25)' }}
                >
                  Entendido, ¡gracias!
                </button>
              </div>
            )}
`;

    // Insert it before {modal === 'profile'
    const profileModalRegex = /\{modal === 'profile'/;
    if (content.match(profileModalRegex)) {
        content = content.replace(profileModalRegex, successPanelHTML + "            {modal === 'profile'");
        fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
        console.log("Success panel added!");
    } else {
        console.log("Could not find {modal === 'profile' to insert before.");
    }
}
addSuccessPanel();
