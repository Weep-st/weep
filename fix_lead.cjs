const fs = require('fs');

function updatePruebasWalletApp() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    // Make email required in form
    content = content.replace(
        '<label style={{ display: \'block\', fontSize: \'0.74rem\', fontWeight: \'600\', color: \'#475569\', marginBottom: \'3px\' }}>Email (opcional)</label>',
        '<label style={{ display: \'block\', fontSize: \'0.74rem\', fontWeight: \'600\', color: \'#475569\', marginBottom: \'3px\' }}>Email *</label>'
    );
    content = content.replace(
        'type="email"\n                      placeholder="tu@email.com"',
        'type="email"\n                      required\n                      placeholder="tu@email.com"'
    );
    
    // Add validation in handleLeadSubmit
    if(content.includes('if (!leadForm.nombre.trim() || !leadForm.whatsapp.trim()) {') && !content.includes('!leadForm.email.trim()')) {
        content = content.replace(
            'if (!leadForm.nombre.trim() || !leadForm.whatsapp.trim()) {',
            'if (!leadForm.nombre.trim() || !leadForm.whatsapp.trim() || !leadForm.email.trim()) {'
        );
        content = content.replace(
            "toast.error('Por favor ingresa tu nombre y WhatsApp');",
            "toast.error('Por favor ingresa tu nombre, WhatsApp y Email');"
        );
    }

    fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
    console.log('Updated PruebasWalletApp.jsx');
}

function updateApi() {
    let content = fs.readFileSync('src/services/api.js', 'utf8');

    // Change userEmail generation to ALWAYS be unique so it inserts a new row in usuarios and NEVER hits 23505
    const oldEmailLogic = "const userEmail = (email && email.trim()) ? email.trim() : (cleanPhone ? `${cleanPhone}@lead.wepi.app` : `lead_${Date.now()}@wepi.app`);";
    // We will append a timestamp to the email to guarantee uniqueness in `usuarios` table, so it always inserts as a new lead.
    const newEmailLogic = "const baseEmail = (email && email.trim()) ? email.trim() : (cleanPhone ? `${cleanPhone}@lead.wepi.app` : `lead_${Date.now()}@wepi.app`);\n    const userEmail = baseEmail.includes('@') ? baseEmail.replace('@', `+lead_${Date.now()}@`) : `${baseEmail}_lead_${Date.now()}`;";
    
    if (content.includes(oldEmailLogic)) {
        content = content.replace(oldEmailLogic, newEmailLogic);
    }

    // Remove the update block entirely
    const updateBlock = `      if (userError.code === '23505') {
        if (whatsapp && whatsapp.trim()) {
          await supabase.from('usuarios')
            .update({ ciudad, nombre: nombre ? nombre.trim() : undefined })
            .eq('telefono', whatsapp.trim());
        } else if (email && email.trim()) {
          await supabase.from('usuarios')
            .update({ ciudad, nombre: nombre ? nombre.trim() : undefined })
            .eq('email', email.trim());
        }
      }`;
    
    if (content.includes(updateBlock)) {
        content = content.replace(updateBlock, `      // No actualizamos usuarios existentes para no sobrescribir su ciudad principal.
      // Ya modificamos el email para que sea siempre único, por lo que 23505 no debería ocurrir.`);
    }

    fs.writeFileSync('src/services/api.js', content);
    console.log('Updated api.js');
}

updatePruebasWalletApp();
updateApi();
