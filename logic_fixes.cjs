const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Coupon Text Change
content = content.replace('🎟️ ¿Tenés un cupón de descuento?', '🎟️ Usar cupón de descuento');

// 2. Refine Upgrade Logic
const oldUpgradeStr = `    let candidates = localMenu.filter(m => 
      m.local_id === cartItem.local_id &&
      m.categoria && 
      m.categoria.trim().toLowerCase() === categoriaNormalizada &&
      m.disponibilidad !== false &&
      Number(m.precio) > currentPrice &&
      Number(m.precio) <= currentPrice * 1.6 &&
      !cart.items.some(ci => ci.id === m.id)
    );`;

const newUpgradeStr = `    // Solo considerar un upgrade válido si comparten al menos la primera palabra clave (ej. Hamburguesa -> Hamburguesa Doble)
    const firstWord = cartItem.nombre.split(' ')[0].toLowerCase();
    
    let candidates = localMenu.filter(m => 
      m.local_id === cartItem.local_id &&
      m.categoria && 
      m.categoria.trim().toLowerCase() === categoriaNormalizada &&
      m.disponibilidad !== false &&
      Number(m.precio) > currentPrice &&
      Number(m.precio) <= currentPrice * 1.6 &&
      m.nombre.toLowerCase().includes(firstWord) &&
      !cart.items.some(ci => ci.id === m.id)
    );`;

if (content.includes(oldUpgradeStr)) {
    content = content.replace(oldUpgradeStr, newUpgradeStr);
} else {
    const crlfUpgrade = oldUpgradeStr.replace(/\n/g, '\r\n');
    if (content.includes(crlfUpgrade)) content = content.replace(crlfUpgrade, newUpgradeStr.replace(/\n/g, '\r\n'));
}

// 3. Fix Upgrade UI (make it look like a button)
const oldBadgeStr = `<div className="upgrade-offer-badge animate-fade-in" style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', background: '#fffbeb', padding: '4px 8px', borderRadius: '6px', border: '1px dashed #fde68a' }} onClick={() => handleUpgradeItem(item, upgradeOffer)}>
                        <span style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: '600' }}>⚡ Mejorá a {upgradeOffer.nombre} por +$\{(diff).toLocaleString('es-AR')}</span>
                      </div>`;

const newBadgeStr = `<button type="button" className="upgrade-offer-badge animate-fade-in" style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', background: '#fffbeb', padding: '6px 12px', borderRadius: '8px', border: '1px solid #f59e0b', boxShadow: '0 2px 4px rgba(245, 158, 11, 0.1)' }} onClick={() => handleUpgradeItem(item, upgradeOffer)}>
                        <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: '700' }}>⚡ Cambiar por {upgradeOffer.nombre} (+$\{(diff).toLocaleString('es-AR')})</span>
                      </button>`;

if (content.includes(oldBadgeStr)) {
    content = content.replace(oldBadgeStr, newBadgeStr);
} else {
    // maybe it has \r\n
    const crlfBadge = oldBadgeStr.replace(/\n/g, '\r\n');
    if (content.includes(crlfBadge)) {
        content = content.replace(crlfBadge, newBadgeStr);
    }
}

// 4. Refine Cross-sell Logic
const fetchUpsellsRegex = /const fetchUpsells = async \(\) => \{[\s\S]*?setUpsellItems\(suggestions\);\s*\};/g;

const newFetchUpsells = `const fetchUpsells = async () => {
      const currentLocalId = cart.items[0].local_id;
      if (!currentLocalId) return;

      let localMenu = menus;
      if (!localMenu || localMenu.length === 0 || localMenu[0].local_id !== currentLocalId) {
         try {
           localMenu = await api.getMenuByLocalId(currentLocalId);
         } catch (e) {
           return;
         }
      }

      if (!localMenu) return;

      const hour = new Date().getHours();
      const cartCategories = cart.items.map(i => i?.categoria?.toLowerCase() || '');
      const cartNames = cart.items.map(i => i?.nombre?.toLowerCase() || '');
      
      let suggestedCategories = [];
      
      const isMorning = hour >= 6 && hour < 11;
      const isAfternoon = hour >= 15 && hour < 19;
      
      const hasCoffeeOrTea = cartNames.some(n => n.includes('cafe') || n.includes('café') || n.includes('te') || n.includes('té') || n.includes('infusion'));
      const hasBakery = cartNames.some(n => n.includes('chipa') || n.includes('medialuna') || n.includes('alfajor') || n.includes('factura') || n.includes('tostado'));
      const hasMainDish = cartCategories.some(c => c.includes('hamburguesa') || c.includes('pizza') || c.includes('lomo') || c.includes('sándwich') || c.includes('empanada'));
      const hasDrink = cartCategories.some(c => c.includes('bebida') || c.includes('gaseosa') || c.includes('cerveza'));

      // Lógica Condicional Inteligente
      if (hasCoffeeOrTea && !hasBakery) {
        suggestedCategories.push('panadería', 'medialunas', 'alfajores', 'postres', 'tortas', 'chipa');
      } else if (hasBakery && !hasCoffeeOrTea) {
        suggestedCategories.push('café', 'cafe', 'cafetería', 'infusiones', 'bebida caliente', 'jugos');
      } else if (hasMainDish) {
        if (!hasDrink) suggestedCategories.push('bebidas', 'bebida', 'gaseosas', 'cervezas');
        if (hasDrink) suggestedCategories.push('postres', 'helados', 'guarniciones', 'papas', 'adicionales');
      } else {
        // Por defecto basado en hora si no detectamos combinaciones claras
        if (isMorning || isAfternoon) {
          suggestedCategories.push('panadería', 'medialunas', 'alfajores', 'postres', 'cafetería');
        } else {
          if (!hasDrink) suggestedCategories.push('bebidas', 'bebida', 'cervezas');
          suggestedCategories.push('postres', 'adicionales');
        }
      }

      let suggestions = localMenu
        .filter(item => item.disponibilidad !== false)
        .filter(item => suggestedCategories.some(sc => (item.categoria || '').toLowerCase().includes(sc)))
        .filter(item => !cart.items.some(cartItem => cartItem.id === item.id))
        .slice(0, 3);

      if (suggestions.length === 0) {
         suggestions = localMenu
           .filter(item => item.disponibilidad !== false)
           .filter(item => !cart.items.some(cartItem => cartItem.id === item.id))
           .slice(0, 3);
      }

      // Filtrar para no sugerir algo que ya se sugirió como Upgrade
      const currentUpgrades = cart.items.map(i => getUpgradeOffer(i, localMenu)).filter(Boolean).map(u => u.id);
      suggestions = suggestions.filter(item => !currentUpgrades.includes(item.id));

      setUpsellItems(suggestions);
    };`;

content = content.replace(fetchUpsellsRegex, newFetchUpsells);

fs.writeFileSync(file, content, 'utf8');
console.log("All fixes applied");
