const fs = require('fs');

function fix() {
    let content = fs.readFileSync('src/services/api.js', 'utf8');

    // Revert userEmail
    content = content.replace(/const baseEmail = [^;]+;\s*const userEmail = [^;]+;/, 'const userEmail = (email && email.trim()) ? email.trim() : (cleanPhone ? `${cleanPhone}@lead.wepi.app` : `lead_${Date.now()}@wepi.app`);');
    
    // Remove the update block
    const updateBlockStart = content.indexOf('// Si el usuario ya existía por teléfono o email, se le actualiza la ciudad correspondiente y el nombre');
    if (updateBlockStart !== -1) {
        const elseBlockStart = content.indexOf('} else {', updateBlockStart);
        if (elseBlockStart !== -1) {
            content = content.slice(0, updateBlockStart) + '// Si el usuario ya existe, simplemente lo ignoramos (no se actualiza)\n    ' + content.slice(elseBlockStart);
        }
    }

    fs.writeFileSync('src/services/api.js', content);
    console.log("Fixed.");
}
fix();
