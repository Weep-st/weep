const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

// The corrupted block has:
//               </section>
//             
//                              </div>
//                           </div>
//                        </div>
//                      );
//                    })}
//                  </div>
//               </section>
//             )}
//             )}

const badRegex = /<section className="home-section top-ordered">[\s\S]*?\{\/\* 6\. NUEVOS LOCALES \(FREEMIUM\) \*\/\}/;

const fixedBlock = `<section className="home-section top-ordered">
                  <div className="section-header-simple">
                    <h2>Lo más pedido 🔥</h2>
                  </div>
                  <div className="horizontal-scroll-items" style={{ gap: '12px', padding: '10px 4px' }}>
                    {homeLayout.mostOrdered.map((item) => {
                      const loc = locals.find(l => l.id === item.local_id);
                      const open = isLocalOpen(loc);
                      const isPremium = loc?.plan_id === '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';

                      return (
                        <div 
                          key={item.id} 
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
             )}

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
             )}

{/* 6. NUEVOS LOCALES (FREEMIUM) */}`;

if (badRegex.test(content)) {
    content = content.replace(badRegex, fixedBlock);
    console.log("Fixed JSX block");
} else {
    console.log("Could not find bad block");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
