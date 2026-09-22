const fs = require('fs');

function applyFix() {
    let content = fs.readFileSync('src/services/api.js', 'utf8');

    // 1. Remove leads_expansion
    const leadsCode = `    // 1. Guardar en tabla leads_expansion
    await supabase
      .from('leads_expansion')
      .insert([{ nombre, whatsapp, email, ciudad }])
      .catch(err => console.warn("Notice: leads_expansion insert warning:", err));`;
    
    if (content.includes(leadsCode)) {
        content = content.replace(leadsCode, '');
    }

    // 2. Make userEmail strictly unique so it NEVER hits 23505
    const oldEmailLogic = 'const userEmail = (email && email.trim()) ? email.trim() : (cleanPhone ? `${cleanPhone}@lead.wepi.app` : `lead_${Date.now()}@wepi.app`);';
    const newEmailLogic = 'const baseEmail = (email && email.trim()) ? email.trim() : (cleanPhone ? `${cleanPhone}@lead.wepi.app` : `lead_${Date.now()}@wepi.app`);\n    const userEmail = baseEmail.includes("@") ? baseEmail.replace("@", `+lead_${Date.now()}@`) : `${baseEmail}_lead_${Date.now()}`;';
    
    if (content.includes(oldEmailLogic)) {
        content = content.replace(oldEmailLogic, newEmailLogic);
    }

    // 3. Make the API throw an error if insert into usuarios fails! So the user actually sees the error instead of fake "Success".
    const errorBlock = `    if (userError) {
      console.warn("User insert notice in registrarInteresExpansion:", userError);
      // Si el usuario ya existe, simplemente lo ignoramos (no se actualiza)
    } else {`;
    
    const newErrorBlock = `    if (userError) {
      console.error("Error al insertar lead en usuarios:", userError);
      return { success: false, error: userError };
    } else {`;
    
    if (content.includes(errorBlock)) {
        content = content.replace(errorBlock, newErrorBlock);
    }

    fs.writeFileSync('src/services/api.js', content);
    console.log("api.js fixed");
}
applyFix();
