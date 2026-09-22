const fs = require('fs');

function addTermsToLeadForm() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    const emailBlock = `                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>Email *</label>
                    <input 
                      type="email" 
                      required
                      placeholder="tu@email.com" 
                      value={leadForm.email}
                      onChange={e => setLeadForm({ ...leadForm, email: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.82rem', outline: 'none' }}
                    />
                  </div>`;
    
    // I noticed I previously added required but the output showed it without `required` on line 4495? Wait, my previous replacement was:
    /*
    content = content.replace(
        'type="email"\n                      placeholder="tu@email.com"',
        'type="email"\n                      required\n                      placeholder="tu@email.com"'
    );
    */

    const termsHTML = `
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '6px', marginBottom: '2px', textAlign: 'left' }}>
                    <input type="checkbox" id="lead_terms_accepted" required style={{ width: 'auto', marginTop: '3px' }} />
                    <label htmlFor="lead_terms_accepted" style={{ fontSize: '0.72rem', color: '#475569', lineHeight: '1.4' }}>
                      Acepto los <button type="button" style={{ background: 'none', border: 'none', color: '#e63946', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setModal('terms')}>Términos y Condiciones y Política de Privacidad</button> para Usuarios.
                    </label>
                  </div>`;

    if (content.includes('<button \n                    type="submit" \n                    disabled={leadSubmitting}')) {
        content = content.replace(
            '<button \n                    type="submit" \n                    disabled={leadSubmitting}',
            termsHTML + '\n\n                  <button \n                    type="submit" \n                    disabled={leadSubmitting}'
        );
        fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
        console.log("Terms added successfully!");
    } else {
        console.log("Could not find the button in the lead form to replace.");
    }
}
addTermsToLeadForm();
