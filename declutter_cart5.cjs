const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const startIndex = content.indexOf('<div className="coupon-section"');
if (startIndex !== -1) {
    const endStr = "Aplicar\r\n                  </button>\r\n                </div>\r\n                {appliedCoupon && checkoutTotals?.appliedCuponId && (\r\n                  <small style={{ color: 'var(--green-600)', fontWeight: 'bold' }}>¡Cupón \"{appliedCoupon}\" aceptado!</small>\r\n                )}\r\n              </div>";
    let endIndex = content.indexOf(endStr, startIndex);
    if (endIndex === -1) {
        const endStr2 = endStr.replace(/\r\n/g, '\n');
        endIndex = content.indexOf(endStr2, startIndex);
        if (endIndex !== -1) endIndex += endStr2.length;
    } else {
        endIndex += endStr.length;
    }
    
    if (endIndex !== -1) {
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
              </div>`;
        content = content.substring(0, startIndex) + couponReplace + content.substring(endIndex);
        console.log("Replaced Coupon UI via substring");
    } else {
        console.log("Could not find endIndex");
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
