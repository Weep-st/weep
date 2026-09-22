const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /<div className="cart-item-controls" style=\{\{ transform: 'scale\(0\.85\)', transformOrigin: 'right center' \}\}>[\s\S]*?<button className="qty-btn" onClick=\{\(\) => cart\.updateQty\(item\.id, -1\)\}>−<\/button>[\s\S]*?<span className="qty-display">\{item\.qty\}<\/span>[\s\S]*?<button className="qty-btn" onClick=\{\(\) => cart\.updateQty\(item\.id, 1\)\}>\+<\/button>[\s\S]*?<button className="remove-btn-small" onClick=\{\(\) => cart\.removeItem\(item\.id\)\}>🗑️<\/button>[\s\S]*?<\/div>/;

const newBlock = `<div className="cart-item-controls" style={{ transform: 'scale(0.9)', transformOrigin: 'left center', marginTop: '6px' }}>
                    <button className="qty-btn" onClick={() => cart.updateQty(item.id, -1)}>−</button>
                    <span className="qty-display" style={{ minWidth: '45px', textAlign: 'center', fontSize: '0.9rem' }}>{item.qty} unid</span>
                    <button className="qty-btn" onClick={() => cart.updateQty(item.id, 1)}>+</button>
                    <button className="remove-btn-small" style={{ marginLeft: '12px' }} onClick={() => cart.removeItem(item.id)}>🗑️</button>
                  </div>`;

if (regex.test(content)) {
    content = content.replace(regex, newBlock);
    console.log("Replaced cart-item-controls");
} else {
    console.log("Not found via regex. Trying index...");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
