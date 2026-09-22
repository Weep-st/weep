const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Rename title in JSX
content = content.replace('<h2>Otras opciones 🎲</h2>', '<h2>DESCUBRÍ</h2>');

// 2. Remove formatCarouselItems constraint for DESCUBRI so it can show multiple items from same store if few stores are open
const badLogic = `return formatCarouselItems(uniqueBase).slice(0, 10);`;
const fixedLogic = `return uniqueBase.slice(0, 10);`;

if (content.includes(badLogic)) {
    content = content.replace(badLogic, fixedLogic);
    console.log("Replaced logic successfully.");
} else {
    const badLogicCRLF = badLogic.replace(/\n/g, '\r\n');
    if (content.includes(badLogicCRLF)) {
        content = content.replace(badLogicCRLF, fixedLogic);
        console.log("Replaced logic successfully (CRLF).");
    } else {
        console.log("Logic NOT FOUND");
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
