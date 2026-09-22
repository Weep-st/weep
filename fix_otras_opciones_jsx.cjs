const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const badStrStart = '{/* 5.6 OTRAS OPCIONES */}';
const badStrEnd = '             )}';
const startIdx = content.indexOf(badStrStart);
if (startIdx !== -1) {
    const endIdx = content.indexOf(badStrEnd, startIdx) + badStrEnd.length;
    content = content.substring(0, startIdx) + content.substring(endIdx);
    console.log("Removed bad JSX");
}

// Now insert correctly after the `)}` that follows `Lo más pedido`
const sectionStart = content.indexOf('<h2>Lo más pedido 🔥</h2>');
if (sectionStart !== -1) {
    const endOfBlock = content.indexOf('             )}', sectionStart);
    if (endOfBlock !== -1) {
        const insertionPoint = endOfBlock + '             )}'.length;
        
        const newSection = `
             {/* 5.6 OTRAS OPCIONES */}
             {homeLayout.otherOptions && homeLayout.otherOptions.length > 0 && (
               <section className="home-section other-options">
                  <div className="section-header-simple">
                    <h2>Otras opciones 🎲</h2>
                  </div>
                  <div className="horizontal-scroll-items" style={{ gap: '12px', padding: '10px 4px' }}>
                    {homeLayout.otherOptions.map((item) => {
                      const loc = locals.find(l => l.id === item.local_id);
                      const open = isLocalOpen(loc);
                      const isPremium = loc?.plan_id === '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';

                      return (
                        <div 
                          key={\`other-\${item.id}\`} 
                          className={\`item-promo-card-vertical animate-fade-in \${open ? '' : 'is-closed'} \${isPremium ? 'is-premium' : ''}\`} 
                          onClick={() => open && handleAddToCart(item)}
                        >
                           <div className="item-promo-img">
                              <img src={item.imagen_url || 'https://via.placeholder.com/150'} alt={item.nombre} />
                           </div>
                           <div className="item-promo-info">
                              <h3 className="item-promo-name">{item.nombre}</h3>
                              <p className="item-promo-local">{loc ? loc.nombre : 'Local'}</p>
                              <div className="item-promo-price-row">
                                 <span className="price-tag">
                                   \${calculateDiscountedPrice(item).toLocaleString('es-AR')}
                                 </span>
                                 {open ? (
                                   <button className="promo-mini-add-btn" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>+</button>
                                 ) : (
                                   <span style={{ fontSize: '0.65rem', color: 'var(--red-600)', fontWeight: '700' }}>
                                     Cerrado
                                   </span>
                                 )}
                              </div>
                           </div>
                        </div>
                      );
                    })}
                  </div>
               </section>
             )}`;
             
        content = content.substring(0, insertionPoint) + newSection + content.substring(insertionPoint);
        console.log("Injected JSX correctly");
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
