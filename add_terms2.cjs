const fs = require('fs');

function addTermsToLeadForm() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    const termsHTML = `
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '6px', marginBottom: '2px', textAlign: 'left' }}>
                    <input type="checkbox" id="lead_terms_accepted" required style={{ width: 'auto', marginTop: '3px' }} />
                    <label htmlFor="lead_terms_accepted" style={{ fontSize: '0.72rem', color: '#475569', lineHeight: '1.4' }}>
                      Acepto los <button type="button" style={{ background: 'none', border: 'none', color: '#e63946', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setModal('terms')}>Términos y Condiciones y Política de Privacidad</button> para Usuarios.
                    </label>
                  </div>`;

    content = content.replace(/<button\s+type="submit"\s+disabled=\{leadSubmitting\}/, termsHTML + '\n\n                  <button \n                    type="submit" \n                    disabled={leadSubmitting}');
    
    fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
    console.log("Terms added successfully!");
}
addTermsToLeadForm();
