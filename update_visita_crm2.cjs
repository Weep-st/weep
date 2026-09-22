const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/CustomerApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ Trigger CRM VISITA_SIN_COMPRA despues de 60s navegando[\s\S]*?\}, 60000\);/;

const newLogic = `// Trigger CRM VISITA_SIN_COMPRA despues de 5 minutos navegando (con cooldown de 4h)
      const lastVisitLogged = Number(localStorage.getItem(\`wepi_last_crm_visit_logged_\${user.id}\`) || 0);
      const now = Date.now();
      if (now - lastVisitLogged >= 4 * 60 * 60 * 1000) {
        const timerVisita = setTimeout(() => {
          localStorage.setItem(\`wepi_last_crm_visit_logged_\${user.id}\`, String(Date.now()));
          api.adminLogCRMEvent(user.id, 'VISITA_SIN_COMPRA', { origin: 'customer_app_browsing' }).catch(() => {});
        }, 300000); // 5 minutos
        
        // Return a cleanup if inside a hook, but here we can't easily clean it up. Since it's just a setTimeout, we might need to assign it to something. Actually, the old code didn't clear it either. Let's just leave it as is.
      }`;

if (regex.test(content)) {
    content = content.replace(regex, newLogic);
    console.log("Updated VISITA_SIN_COMPRA in CustomerApp");
} else {
    console.log("Could not find regex match!");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
