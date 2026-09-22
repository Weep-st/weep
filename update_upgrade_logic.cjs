const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /const getUpgradeOffer = \(cartItem, localMenu\) => \{[\s\S]*?    return candidates\[0\];\n  \};/;

const newLogic = `const getUpgradeOffer = (cartItem, localMenu) => {
    if (!localMenu || localMenu.length === 0) return null;
    if (!cartItem.categoria) return null;
    
    const categoriaNormalizada = cartItem.categoria.trim().toLowerCase();
    const currentPrice = Number(cartItem.precio);
    const itemName = cartItem.nombre.toLowerCase();
    
    const isIceCream = categoriaNormalizada.includes('helado') || categoriaNormalizada.includes('heladeria');
    
    // Helados pueden duplicar su precio al subir de tamaño (1/4 -> 1/2 -> 1Kg), permitimos hasta 2.5x
    const maxMultiplier = isIceCream ? 2.5 : 1.6;
    
    // Ignorar palabras genéricas o de peso para centrarse en el sustantivo real
    const ignoreWords = ['de', 'con', 'y', 'la', 'el', 'en', 'x', 'sin', 'kg', 'lts', 'ml', '1/4', '1/2', '1', 'un', 'medio', 'cuarto', 'kilo', 'litro', 'lata', 'pinta'];
    const words = itemName.split(/[\\s,]+/).filter(w => w.length > 2 && !ignoreWords.includes(w));
    
    let candidates = localMenu.filter(m => {
      if (m.local_id !== cartItem.local_id || m.disponibilidad === false) return false;
      if (cart.items.some(ci => ci.id === m.id)) return false;
      
      const mPrice = Number(m.precio);
      if (mPrice <= currentPrice || mPrice > currentPrice * maxMultiplier) return false;
      
      if (!m.categoria || m.categoria.trim().toLowerCase() !== categoriaNormalizada) return false;
      
      const mName = m.nombre.toLowerCase();
      
      // Regla Especial para Helados: Cualquier helado más caro en la misma categoría es un upgrade válido (tamaño)
      if (isIceCream) return true;
      
      // Regla General: Debe compartir alguna palabra significativa (ej. "Hamburguesa", "Lomo", "Pizza")
      const sharesSignificantWord = words.some(w => mName.includes(w));
      if (sharesSignificantWord) return true;
      
      // Fallback a primera palabra por si acaso
      const firstWord = itemName.split(' ')[0];
      if (firstWord.length > 2 && mName.includes(firstWord)) return true;

      return false;
    });
    
    if (candidates.length === 0) return null;
    
    // Sugerir siempre el escalón siguiente (el más barato dentro de los más caros)
    candidates.sort((a, b) => Number(a.precio) - Number(b.precio));
    return candidates[0];
  };`;

if (regex.test(content)) {
    content = content.replace(regex, newLogic);
    console.log("Updated getUpgradeOffer logic.");
} else {
    console.log("Could not find getUpgradeOffer with regex.");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
