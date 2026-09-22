const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /                  <\/div>\r?\n                <\/div>\r?\n              }\)\}\r?\n\r?\n              \{upsellItems\.length > 0 && \(/;

const replaceStr = `                  </div>
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
                          + $\{(diff).toLocaleString('es-AR')}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ))}

              {upsellItems.length > 0 && (`

if (regex.test(content)) {
    content = content.replace(regex, replaceStr);
    console.log("Replaced part 2");
} else {
    console.log("NOT FOUND part 2 via regex");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
