const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const badCardContentRegex = /<div className="item-promo-img">[\s\S]*?<img src=\{item\.imagen_url \|\| 'https:\/\/via\.placeholder\.com\/150'\} alt=\{item\.nombre\} \/>[\s\S]*?<\/div>[\s\S]*?<div className="item-promo-info">[\s\S]*?<h3 className="item-promo-name">\{item\.nombre\}<\/h3>[\s\S]*?<p className="item-promo-local">\{loc \? loc\.nombre : 'Local'\}<\/p>[\s\S]*?<div className="item-promo-price-row">[\s\S]*?<span className="price-tag">[\s\S]*?\$\{calculateDiscountedPrice\(item\)\.toLocaleString\('es-AR'\)\}[\s\S]*?<\/span>[\s\S]*?\{open \? \([\s\S]*?<button className="promo-mini-add-btn" onClick=\{\(e\) => \{ e\.stopPropagation\(\); handleAddToCart\(item\); \}\}>\+<\/button>[\s\S]*?\) : \([\s\S]*?<span style=\{\{ fontSize: '0\.65rem', color: 'var\(--red-600\)', fontWeight: '700' \}\}>[\s\S]*?Cerrado[\s\S]*?<\/span>[\s\S]*?\)[\}][\s\S]*?<\/div>[\s\S]*?<\/div>/g;

const goodCardContent = `<div className="promo-vertical-img">
                              <img src={item.imagen_url} alt={item.nombre} />
                              {(() => {
                                const discountedPrice = calculateDiscountedPrice(item);
                                if (discountedPrice < Number(item.precio)) {
                                  const percent = Math.round((1 - discountedPrice / Number(item.precio)) * 100);
                                  return <div className="menu-discount-badge">{percent}% OFF</div>;
                                }
                                return null;
                              })()}
                            </div>
                            <div className="promo-vertical-info">
                              <span className="promo-item-name">{item.nombre}</span>
                              {renderCreditBadge(item)}
                              <div className="promo-price-row">
                                <span className="price-now">\${calculateDiscountedPrice(item).toLocaleString()}</span>
                                {calculateDiscountedPrice(item) < Number(item.precio) && <span className="price-was">\${Number(item.precio).toLocaleString()}</span>}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="promo-local-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {item.local_nombre || (loc ? loc.nombre : 'Local')}
                                  {isPremium && <img src="https://i.postimg.cc/50W06p4z/descarga-(31).png" alt="Featured" style={{ height: '12px', width: 'auto' }} />}
                                </span>
                                {open ? (
                                  <button className="promo-mini-add-btn" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>+</button>
                                ) : (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--red-600)', fontWeight: '700' }}>
                                    Cerrado
                                  </span>
                                )}
                              </div>
                            </div>`;

if (badCardContentRegex.test(content)) {
    content = content.replace(badCardContentRegex, goodCardContent);
    console.log("Replaced bad card content with correct promo card classes.");
} else {
    console.log("Bad card content NOT FOUND via regex.");
    // Try manual index slicing
    // We have two identical bad blocks, one in mostOrdered and one in otherOptions
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
