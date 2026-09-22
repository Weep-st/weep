const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ ── DETECTOR CRM: VISITA_SIN_COMPRA ──[\s\S]*?\}, \[user\?\.id, user\?\.ya_realizo_pedidos, location\.pathname, cart\.items\]\);/;

const newLogic = `// ── DETECTOR CRM: VISITA_SIN_COMPRA ──
  React.useEffect(() => {
    if (!user?.id) return;

    // Cooldown de 4 horas para no inundar el CRM
    const lastVisitLogged = Number(localStorage.getItem(\`wepi_last_crm_visit_logged_\${user.id}\`) || 0);
    const now = Date.now();
    if (now - lastVisitLogged < 4 * 60 * 60 * 1000) return;

    // Se dispara tras 5 minutos de inactividad
    const timer = setTimeout(async () => {
      const hasCompletedOrder = sessionStorage.getItem('wepi_order_completed_time');
      const lastCompletedOrderTime = Number(hasCompletedOrder || 0);
      
      // Si hizo un pedido en los últimos 10 minutos, no lo contamos como visita sin compra
      if (now - lastCompletedOrderTime < 10 * 60 * 1000) return;

      try {
        localStorage.setItem(\`wepi_last_crm_visit_logged_\${user.id}\`, String(Date.now()));
        api.adminLogCRMEvent(user.id, 'VISITA_SIN_COMPRA', { path: location.pathname }).catch(e => console.error("Error CRM visita sin compra:", e));
      } catch (e) {
        console.warn("Visita sin compra check skipped:", e.message);
      }
    }, 300000); // 5 minutos (300,000 ms)

    return () => clearTimeout(timer);
  }, [user?.id, location.pathname]);`;

if (regex.test(content)) {
    content = content.replace(regex, newLogic);
    console.log("Updated VISITA_SIN_COMPRA in PruebasWalletApp");
} else {
    console.log("Could not find regex match!");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
