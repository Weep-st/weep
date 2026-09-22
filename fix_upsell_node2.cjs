const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const searchStr = `  // Upsell Logic State
  const [upsellItems, setUpsellItems] = React.useState([]);
  React.useEffect(() => {
    if (cart.items.length === 0) {
      setUpsellItems([]);
      return;
    }
    
    const hour = new Date().getHours();
    const cartCategories = cart.items.map(i => i?.categoria?.toLowerCase());
    let suggestedCategories = [];

    if (hour >= 20 || (hour >= 11 && hour <= 15)) {
      const hasMainDish = cartCategories.some(c => c?.includes(\`hamburguesa\`) || c?.includes(\`pizza\`) || c?.includes(\`lomo\`) || c?.includes(\`sándwich\`));
      const hasDrink = cartCategories.some(c => c?.includes(\`bebida\`));
      
      if (hasMainDish && !hasDrink) suggestedCategories.push(\`bebidas\`);
      if (hasMainDish && hasDrink) suggestedCategories.push(\`postres\`, \`helados\`);
      if (hasMainDish) suggestedCategories.push(\`guarniciones\`, \`papas\`, \`adicionales\`);
    } else {
       suggestedCategories.push(\`panadería\`, \`medialunas\`, \`alfajores\`, \`postres\`);
    }

    if (suggestedCategories.length === 0) suggestedCategories.push(\`bebidas\`, \`postres\`, \`adicionales\`);

    const suggestions = menus
      .filter(item => item.disponibilidad !== false)
      .filter(item => suggestedCategories.some(sc => item.categoria?.toLowerCase().includes(sc)))
      .filter(item => !cart.items.some(cartItem => cartItem.id === item.id))
      .slice(0, 3);

    setUpsellItems(suggestions);
  }, [cart.items, menus]);`;

const replaceStr = `  // Upsell Logic State
  const [upsellItems, setUpsellItems] = React.useState([]);
  React.useEffect(() => {
    if (cart.items.length === 0) {
      setUpsellItems([]);
      return;
    }
    
    const fetchUpsells = async () => {
      const currentLocalId = cart.items[0].local_id;
      if (!currentLocalId) return;

      let localMenu = menus;
      if (!localMenu || localMenu.length === 0 || localMenu[0].local_id !== currentLocalId) {
         try {
           localMenu = await api.getMenuByLocalId(currentLocalId);
         } catch (e) {
           return;
         }
      }

      if (!localMenu) return;

      const hour = new Date().getHours();
      const cartCategories = cart.items.map(i => i?.categoria?.toLowerCase() || '');
      let suggestedCategories = [];

      const hasDrink = cartCategories.some(c => c.includes('bebida') || c.includes('gaseosa'));
      if (!hasDrink) suggestedCategories.push('bebidas', 'bebida', 'gaseosas', 'cervezas');

      if (hour >= 20 || (hour >= 11 && hour <= 15)) {
        const hasMainDish = cartCategories.some(c => c.includes('hamburguesa') || c.includes('pizza') || c.includes('lomo') || c.includes('sándwich') || c.includes('empanada'));
        if (hasMainDish && hasDrink) suggestedCategories.push('postres', 'helados');
        if (hasMainDish) suggestedCategories.push('guarniciones', 'papas', 'adicionales');
      } else {
         suggestedCategories.push('panadería', 'medialunas', 'alfajores', 'postres');
      }

      suggestedCategories.push('postres', 'adicionales');

      let suggestions = localMenu
        .filter(item => item.disponibilidad !== false)
        .filter(item => suggestedCategories.some(sc => (item.categoria || '').toLowerCase().includes(sc)))
        .filter(item => !cart.items.some(cartItem => cartItem.id === item.id))
        .slice(0, 3);

      if (suggestions.length === 0) {
         suggestions = localMenu
           .filter(item => item.disponibilidad !== false)
           .filter(item => !cart.items.some(cartItem => cartItem.id === item.id))
           .slice(0, 3);
      }

      setUpsellItems(suggestions);
    };
    
    fetchUpsells();
  }, [cart.items, menus]);`;

if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    console.log("Replaced");
} else {
    const crlfSearch = searchStr.replace(/\n/g, '\r\n');
    if (content.includes(crlfSearch)) {
        content = content.replace(crlfSearch, replaceStr);
        console.log("Replaced (CRLF)");
    } else {
        console.log("NOT FOUND");
    }
}
fs.writeFileSync(file, content, 'utf8');
console.log("Done");
