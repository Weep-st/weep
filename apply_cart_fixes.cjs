const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. WhatsApp Removal
const waStart = content.indexOf('{!optInRegistered && (');
if (waStart !== -1) {
    const waEndStr = '</div>\r\n                )}\r\n                <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={checkoutLoading || isOutofCoverage}>';
    let waEnd = content.indexOf(waEndStr, waStart);
    if (waEnd === -1) {
        waEnd = content.indexOf(waEndStr.replace(/\r\n/g, '\n'), waStart);
    }
    
    if (waEnd !== -1) {
        content = content.substring(0, waStart) + content.substring(waEnd + waEndStr.indexOf('<button type="submit"'));
        console.log("WhatsApp section removed.");
    } else {
        console.log("Could not find end of WhatsApp section.");
    }
}

// 2. Coupon UI update and State
if (!content.includes('showCouponInput')) {
    content = content.replace("const [couponInput, setCouponInput] = React.useState('');", "const [couponInput, setCouponInput] = React.useState('');\n  const [showCouponInput, setShowCouponInput] = React.useState(false);");
    
    const couponStartStr = '<div className="coupon-section"';
    const couponStart = content.indexOf(couponStartStr);
    if (couponStart !== -1) {
        const couponEndStr = '              <div className="payment-method-selector"';
        const couponEnd = content.indexOf(couponEndStr, couponStart);
        if (couponEnd !== -1) {
            const newCoupon = `<div className="coupon-section" style={{ marginTop: '15px', marginBottom: '15px' }}>
                {!showCouponInput ? (
                  <button 
                    type="button" 
                    onClick={() => setShowCouponInput(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--red-600)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    🎟️ ¿Tenés un cupón de descuento?
                  </button>
                ) : (
                  <div className="animate-fade-in">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Ingresá tu código</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Código" 
                        value={couponInput}
                        onChange={e => setCouponInput(e.target.value.toUpperCase())}
                        style={{ textTransform: 'uppercase', padding: '8px 12px', minHeight: '38px' }}
                      />
                      <button 
                        type="button"
                        className="btn btn-secondary btn-sm" 
                        onClick={() => {
                          setAppliedCoupon(couponInput);
                          if(couponInput) toast.success("Cupón validado");
                        }}
                        disabled={!couponInput}
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                )}
                {appliedCoupon && checkoutTotals?.appliedCuponId && (
                  <small style={{ color: 'var(--green-600)', fontWeight: 'bold', display: 'block', marginTop: '6px' }}>¡Cupón "{appliedCoupon}" aceptado!</small>
                )}
              </div>\n\n`;
              
            content = content.substring(0, couponStart) + newCoupon + content.substring(couponEnd);
            console.log("Coupon UI replaced.");
        }
    }
}

// 3. Compact Upgrade Badge
if (!content.includes("display: 'inline-flex'")) {
    const badgeRegex = /<div className="upgrade-offer-badge animate-fade-in"[\s\S]*?<\/div>/g;
    const compactBadge = `<div className="upgrade-offer-badge animate-fade-in" style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', background: '#fffbeb', padding: '4px 8px', borderRadius: '6px', border: '1px dashed #fde68a' }} onClick={() => handleUpgradeItem(item, upgradeOffer)}>
                        <span style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: '600' }}>⚡ Mejorá a {upgradeOffer.nombre} por +$\{(diff).toLocaleString('es-AR')}</span>
                      </div>`;
    content = content.replace(badgeRegex, compactBadge);
    console.log("Compact Upgrade badge applied.");
}

// 4. Filter Upsell Items (Carousel)
const fetchUpsellStr = `      if (suggestions.length === 0) {
         suggestions = localMenu
           .filter(item => item.disponibilidad !== false)
           .filter(item => !cart.items.some(cartItem => cartItem.id === item.id))
           .slice(0, 3);
      }

      setUpsellItems(suggestions);`;

if (content.includes(fetchUpsellStr)) {
    const filterUpsellReplace = `      if (suggestions.length === 0) {
         suggestions = localMenu
           .filter(item => item.disponibilidad !== false)
           .filter(item => !cart.items.some(cartItem => cartItem.id === item.id))
           .slice(0, 3);
      }

      // Filtrar para no sugerir algo que ya se sugirió como Upgrade
      const currentUpgrades = cart.items.map(i => getUpgradeOffer(i, localMenu)).filter(Boolean).map(u => u.id);
      suggestions = suggestions.filter(item => !currentUpgrades.includes(item.id));

      setUpsellItems(suggestions);`;
      
    content = content.replace(fetchUpsellStr, filterUpsellReplace);
    console.log("Filtered upsell items.");
} else {
    const fetchUpsellStrCRLF = fetchUpsellStr.replace(/\n/g, '\r\n');
    if (content.includes(fetchUpsellStrCRLF)) {
        const filterUpsellReplaceCRLF = `      if (suggestions.length === 0) {
         suggestions = localMenu
           .filter(item => item.disponibilidad !== false)
           .filter(item => !cart.items.some(cartItem => cartItem.id === item.id))
           .slice(0, 3);
      }

      // Filtrar para no sugerir algo que ya se sugirió como Upgrade
      const currentUpgrades = cart.items.map(i => getUpgradeOffer(i, localMenu)).filter(Boolean).map(u => u.id);
      suggestions = suggestions.filter(item => !currentUpgrades.includes(item.id));

      setUpsellItems(suggestions);`.replace(/\n/g, '\r\n');
        content = content.replace(fetchUpsellStrCRLF, filterUpsellReplaceCRLF);
        console.log("Filtered upsell items (CRLF).");
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log("Everything saved!");
