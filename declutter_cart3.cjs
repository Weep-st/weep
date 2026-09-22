const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /<div className="coupon-section"[\s\S]*?\{validatingCoupon \? '\.\.\.' : 'Aplicar'\}\s*<\/button>\s*<\/div>\s*<\/div>/;

const couponReplace = `<div className="coupon-section" style={{ marginTop: '15px', marginBottom: '15px' }}>
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

if (regex.test(content)) {
    content = content.replace(regex, couponReplace);
    console.log("Replaced Coupon UI via regex");
} else {
    console.log("NOT FOUND Coupon UI");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
