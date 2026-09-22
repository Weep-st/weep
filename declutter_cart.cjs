const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove WhatsApp checkbox
const waRegex = /\{\!optInRegistered && \(\s*<div style=\{\{ marginBottom: '16px', display: 'flex'[\s\S]*?<\/label>\s*<\/div>\s*\)\}/;
if (waRegex.test(content)) {
    content = content.replace(waRegex, '');
    console.log("Removed WhatsApp checkbox");
} else {
    console.log("WhatsApp checkbox NOT FOUND");
}

// 2. Add showCouponInput state
const stateSearch = `  const [couponInput, setCouponInput] = React.useState('');`;
const stateReplace = `  const [couponInput, setCouponInput] = React.useState('');
  const [showCouponInput, setShowCouponInput] = React.useState(false);`;
if (content.includes(stateSearch)) {
    content = content.replace(stateSearch, stateReplace);
    console.log("Added showCouponInput state");
} else {
    console.log("stateSearch NOT FOUND");
}

// 3. Update coupon section UI
const couponSearch = `              <div className="coupon-section" style={{ marginTop: '15px', marginBottom: '20px' }}>
                <label className="form-label">¿Tenés un cupón?</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ingresá tu código" 
                    value={couponInput}
                    onChange={e => setCouponInput(e.target.value.toUpperCase())}
                    style={{ textTransform: 'uppercase' }}
                  />
                  <button 
                    className="btn btn-secondary" 
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={!couponInput || validatingCoupon}
                  >
                    {validatingCoupon ? '...' : 'Aplicar'}
                  </button>
                </div>
              </div>`;

const couponReplace = `              <div className="coupon-section" style={{ marginTop: '15px', marginBottom: '15px' }}>
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
                        className="btn btn-secondary btn-sm" 
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={!couponInput || validatingCoupon}
                      >
                        {validatingCoupon ? '...' : 'Aplicar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>`;

if (content.includes(couponSearch)) {
    content = content.replace(couponSearch, couponReplace);
    console.log("Replaced Coupon UI");
} else {
    // try CRLF
    const crlfCouponSearch = couponSearch.replace(/\n/g, '\r\n');
    if (content.includes(crlfSearch)) {
        content = content.replace(crlfSearch, couponReplace);
        console.log("Replaced Coupon UI (CRLF)");
    } else {
        console.log("couponSearch NOT FOUND");
    }
}

// 4. Compact the upgrade badge
const upgradeRegex = /<div className="upgrade-offer-badge animate-fade-in" style=\{\{\s*marginTop: '10px',\s*padding: '8px 12px',\s*background: 'linear-gradient\(90deg, #fffbeb, #fef3c7\)',\s*border: '1px solid #fde68a',\s*borderRadius: '8px',\s*display: 'flex',\s*alignItems: 'center',\s*justifyContent: 'space-between',\s*cursor: 'pointer'\s*\}\} onClick=\{.*?\}\>\s*<span.*?>\s*⚡ Mejorá a \{upgradeOffer\.nombre\}\s*<\/span>\s*<span.*?>\s*\+ \$\{\(diff\)\.toLocaleString\('es-AR'\)\}\s*<\/span>\s*<\/div>/g;

const compactBadge = `<div className="upgrade-offer-badge animate-fade-in" style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', background: '#fffbeb', padding: '4px 8px', borderRadius: '6px', border: '1px dashed #fde68a' }} onClick={() => handleUpgradeItem(item, upgradeOffer)}>
                        <span style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: '600' }}>⚡ Mejorá a {upgradeOffer.nombre} por +$\{(diff).toLocaleString('es-AR')}</span>
                      </div>`;

if (upgradeRegex.test(content)) {
    content = content.replace(upgradeRegex, compactBadge);
    console.log("Compacted upgrade badge");
} else {
    console.log("Upgrade badge NOT FOUND");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
