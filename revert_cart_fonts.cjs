const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Revert Cart Item Name Font Size
const cartItemRegex = /<span className="cart-item-name" style=\{\{ fontSize: '0.7rem', lineHeight: '1.1' \}\}>\{item\.nombre\}<\/span>/g;
const cartItemReplacement = `<span className="cart-item-name" style={{ fontSize: '0.8rem', lineHeight: '1.1' }}>{item.nombre}</span>`;

if (cartItemRegex.test(content)) {
    content = content.replace(cartItemRegex, cartItemReplacement);
    console.log("Reverted cart item name size");
} else {
    console.log("Could not find cart item name!");
}

// 2. Revert Upgrade Button Size
const btnRegex = /<button type="button" className="btn btn-success btn-sm animate-fade-in" style=\{\{ borderRadius: '6px', fontWeight: '600', fontSize: '0.58rem', padding: '3px 8px', boxShadow: '0 1px 3px rgba\(34, 197, 94, 0.3\)', whiteSpace: 'normal', textAlign: 'center', lineHeight: '1.1', maxWidth: '95%' \}\} onClick=\{\(\) => handleUpgradeItem\(item, upgradeOffer\)\}>/g;
const btnReplacement = `<button type="button" className="btn btn-success btn-sm animate-fade-in" style={{ borderRadius: '6px', fontWeight: 'bold', fontSize: '0.65rem', padding: '4px 10px', boxShadow: '0 2px 6px rgba(34, 197, 94, 0.3)', whiteSpace: 'normal', textAlign: 'center', lineHeight: '1.2', maxWidth: '95%' }} onClick={() => handleUpgradeItem(item, upgradeOffer)}>`;

if (btnRegex.test(content)) {
    content = content.replace(btnRegex, btnReplacement);
    console.log("Reverted upgrade button size");
} else {
    // try finding it without exact matches
    const generalBtnRegex = /<button type="button" className="btn btn-success btn-sm animate-fade-in" style=\{\{[\s\S]*?\}\} onClick=\{\(\) => handleUpgradeItem\(item, upgradeOffer\)\}>/g;
    if (generalBtnRegex.test(content)) {
        content = content.replace(generalBtnRegex, btnReplacement);
        console.log("Reverted upgrade button size (fuzzy)");
    } else {
        console.log("Could not find upgrade button!");
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
