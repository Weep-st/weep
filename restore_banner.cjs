const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

// The chunk that was modified starts with // 13 hs a 16 hs
const targetStart = `    // 13 hs a 16 hs (helado y postre)
    if (hour >= 13 && hour < 16) return { 
        rubros: ['Restaurante', 'Market', 'Bebidas'],
        marketCats: ['Bebidas']
    };`;

const replacement = `    // 13 hs a 16 hs (helado y postre)
    if (hour >= 13 && hour < 16) return { 
        title: "Postres y Tentaciones", 
        banner: "https://i.postimg.cc/853qbJ4k/Gemini-Generated-Image-wcc6vbwcc6vbwcc6.png",
        rubros: ['Heladería', 'Market', 'Bebidas'],
        marketCats: ['Golosinas']
    };
    // 16 a 20 hs (merienda)
    if (hour >= 16 && hour < 20) return { 
        title: "Merienda: Un break para vos", 
        banner: "https://i.postimg.cc/LsDCxY9K/Gemini-Generated-Image-muhz58muhz58muhz.png",
        rubros: ['Cafetería', 'Heladería', 'Market', 'Bebidas'],
        marketCats: ['Snacks', 'Bebidas']
    };
    // 20 a 00 hs (cena)
    if (hour >= 20 || hour < 0) return { 
        title: "¿Qué pedimos para cenar?", 
        banner: "https://i.postimg.cc/d1Dbdm8W/Gemini-Generated-Image-py0z0lpy0z0lpy0z.png",
        rubros: ['Restaurante', 'Market', 'Bebidas'],
        marketCats: ['Bebidas']
    };`;

if (content.includes(targetStart)) {
    content = content.replace(targetStart, replacement);
    console.log("Restored perfectly.");
} else {
    // Try to find it with CRLF
    const crlfTargetStart = targetStart.replace(/\n/g, '\r\n');
    if (content.includes(crlfTargetStart)) {
        content = content.replace(crlfTargetStart, replacement.replace(/\n/g, '\r\n'));
        console.log("Restored perfectly (CRLF).");
    } else {
        console.log("Could not find the broken block!");
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
