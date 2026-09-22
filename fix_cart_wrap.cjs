const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const targetStr = 'className="cart-item-row"';
const replaceStr = 'className="cart-item-row" style={{ flexWrap: \'wrap\' }}';

if (content.includes(targetStr) && !content.includes(replaceStr)) {
    content = content.replace(targetStr, replaceStr);
    console.log("Fixed flexWrap on cart-item-row");
} else {
    console.log("Could not find or already fixed.");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
