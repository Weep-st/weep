const fs = require('fs');

function applyFix() {
    const lines = fs.readFileSync('src/services/api.js', 'utf8').split('\n');
    const start = 7524; // 0-indexed is 7524, line 7525
    const end = 7569;   // line 7570

    const newFunction = `export async function registrarInteresExpansion({ nombre, whatsapp, email, ciudad }) {
  try {
    const cleanPhone = whatsapp ? whatsapp.replace(/\\D/g, '') : '';
    const baseEmail = (email && email.trim()) ? email.trim() : (cleanPhone ? \`\${cleanPhone}@lead.wepi.app\` : \`lead_\${Date.now()}@wepi.app\`);
    const userEmail = baseEmail.includes('@') ? baseEmail.replace('@', \`+lead_\${Date.now()}@\`) : \`\${baseEmail}_lead_\${Date.now()}\`;
    const userId = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const { error: userError } = await supabase.from('usuarios').insert({
      id: userId,
      nombre: nombre ? nombre.trim() : 'Usuario Interesado',
      telefono: whatsapp ? whatsapp.trim() : null,
      email: userEmail,
      ciudad: ciudad,
      email_confirmado: true,
      terms_accepted: true,
      privacy_accepted: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: 'v1'
    });

    if (userError) {
      console.error("Error al insertar lead en usuarios:", userError);
      return { success: false, error: userError };
    }

    // Disparar Evento CRM para que se sincronice con la hoja "usuarios" o envíe mensajes de bienvenida
    adminLogCRMEvent(userId, 'USUARIO_REGISTRADO', { 
      nombre: nombre ? nombre.trim() : 'Usuario Interesado', 
      email: userEmail, 
      ciudad: ciudad 
    }).catch(err => console.error("Error registrando CRM USUARIO_REGISTRADO en registrarInteresExpansion:", err));

    return { success: true };
  } catch (err) {
    console.error("Error al registrar lead y usuario en Supabase:", err);
    return { success: false, error: err };
  }
}`;

    // Splice array
    lines.splice(start, end - start, newFunction);
    
    fs.writeFileSync('src/services/api.js', lines.join('\n'));
    console.log("Fixed!");
}
applyFix();
