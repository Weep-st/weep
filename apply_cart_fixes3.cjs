const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const couponStartStr = '<div className="coupon-section"';
const couponStart = content.indexOf(couponStartStr);
if (couponStart !== -1) {
    const couponEndStr = '              <div className="cart-summary">';
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

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
