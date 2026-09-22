const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /<div style=\{\{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '10px' \}\}>[\s\S]*?<\/div>/g;

const newButton = `<div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '10px' }}>
                        <button type="button" className="btn btn-success btn-sm animate-fade-in" style={{ borderRadius: '8px', fontWeight: 'bold', fontSize: '0.75rem', padding: '6px 14px', boxShadow: '0 2px 6px rgba(34, 197, 94, 0.3)', whiteSpace: 'normal', textAlign: 'center', lineHeight: '1.3', maxWidth: '95%' }} onClick={() => handleUpgradeItem(item, upgradeOffer)}>
                          ⚡ Mejorá a {upgradeOffer.nombre.length > 26 ? upgradeOffer.nombre.substring(0, 26) + '...' : upgradeOffer.nombre} por SOLO $\{(diff).toLocaleString('es-AR')}
                        </button>
                      </div>`;

if (regex.test(content)) {
    content = content.replace(regex, newButton);
    console.log("Replaced Upgrade Button to fix long names");
} else {
    console.log("Upgrade Button NOT FOUND");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
