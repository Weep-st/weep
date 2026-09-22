const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const searchStr1 = `  }, [cart.items, menus]);
  
  const refreshWallet = async () => {`;

const replaceStr1 = `  }, [cart.items, menus]);

  // Upgrade Upsell Logic
  const getUpgradeOffer = (cartItem, localMenu) => {
    if (!localMenu || localMenu.length === 0) return null;
    if (!cartItem.categoria) return null;
    
    const categoriaNormalizada = cartItem.categoria.trim().toLowerCase();
    const currentPrice = Number(cartItem.precio);
    
    let candidates = localMenu.filter(m => 
      m.local_id === cartItem.local_id &&
      m.categoria && 
      m.categoria.trim().toLowerCase() === categoriaNormalizada &&
      m.disponibilidad !== false &&
      Number(m.precio) > currentPrice &&
      Number(m.precio) <= currentPrice * 1.6 &&
      !cart.items.some(ci => ci.id === m.id)
    );
    
    if (candidates.length === 0) return null;
    
    candidates.sort((a, b) => Number(a.precio) - Number(b.precio));
    return candidates[0];
  };

  const handleUpgradeItem = (oldItem, upgradeOffer) => {
    cart.removeItem(oldItem.id);
    handleAddToCart(upgradeOffer);
  };
  
  const refreshWallet = async () => {`;

const searchStr2 = `                  </div>
                </div>
              ))}

              {upsellItems.length > 0 && (`

const replaceStr2 = `                  </div>
                  {(() => {
                    const upgradeOffer = getUpgradeOffer(item, menus);
                    if (!upgradeOffer) return null;
                    const diff = Number(upgradeOffer.precio) - Number(item.precio);
                    return (
                      <div className="upgrade-offer-badge animate-fade-in" style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        background: 'linear-gradient(90deg, #fffbeb, #fef3c7)',
                        border: '1px solid #fde68a',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }} onClick={() => handleUpgradeItem(item, upgradeOffer)}>
                        <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: '600' }}>
                          ⚡ Mejorá a {upgradeOffer.nombre}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: '800', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>
                          + \$\{(diff).toLocaleString('es-AR')}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ))}

              {upsellItems.length > 0 && (`

if (content.includes(searchStr1)) {
    content = content.replace(searchStr1, replaceStr1);
    console.log("Replaced part 1");
} else {
    const crlfSearch1 = searchStr1.replace(/\n/g, '\r\n');
    if (content.includes(crlfSearch1)) {
        content = content.replace(crlfSearch1, replaceStr1);
        console.log("Replaced part 1 (CRLF)");
    } else {
        console.log("NOT FOUND part 1");
    }
}

if (content.includes(searchStr2)) {
    content = content.replace(searchStr2, replaceStr2);
    console.log("Replaced part 2");
} else {
    const crlfSearch2 = searchStr2.replace(/\n/g, '\r\n');
    if (content.includes(crlfSearch2)) {
        content = content.replace(crlfSearch2, replaceStr2);
        console.log("Replaced part 2 (CRLF)");
    } else {
        console.log("NOT FOUND part 2");
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
