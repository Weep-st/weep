const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const searchStr1 = '  const [acceptedOrder, setAcceptedOrder] = React.useState(null);\n  \n  const refreshWallet = async () => {';
const replaceStr1 = '  const [acceptedOrder, setAcceptedOrder] = React.useState(null);\n\n  // Upsell Logic State\n  const [upsellItems, setUpsellItems] = React.useState([]);\n  React.useEffect(() => {\n    if (cart.items.length === 0) {\n      setUpsellItems([]);\n      return;\n    }\n    \n    const hour = new Date().getHours();\n    const cartCategories = cart.items.map(i => i?.categoria?.toLowerCase());\n    let suggestedCategories = [];\n\n    if (hour >= 20 || (hour >= 11 && hour <= 15)) {\n      const hasMainDish = cartCategories.some(c => c?.includes(`hamburguesa`) || c?.includes(`pizza`) || c?.includes(`lomo`) || c?.includes(`sándwich`));\n      const hasDrink = cartCategories.some(c => c?.includes(`bebida`));\n      \n      if (hasMainDish && !hasDrink) suggestedCategories.push(`bebidas`);\n      if (hasMainDish && hasDrink) suggestedCategories.push(`postres`, `helados`);\n      if (hasMainDish) suggestedCategories.push(`guarniciones`, `papas`, `adicionales`);\n    } else {\n       suggestedCategories.push(`panadería`, `medialunas`, `alfajores`, `postres`);\n    }\n\n    if (suggestedCategories.length === 0) suggestedCategories.push(`bebidas`, `postres`, `adicionales`);\n\n    const suggestions = menus\n      .filter(item => item.disponibilidad !== false)\n      .filter(item => suggestedCategories.some(sc => item.categoria?.toLowerCase().includes(sc)))\n      .filter(item => !cart.items.some(cartItem => cartItem.id === item.id))\n      .slice(0, 3);\n\n    setUpsellItems(suggestions);\n  }, [cart.items, menus]);\n  \n  const refreshWallet = async () => {';

const searchStr2 = '                </div>\n              ))}\n\n              <div className=\"payment-method-selector\"';
const replaceStr2 = '                </div>\n              ))}\n\n              {upsellItems.length > 0 && (\n                <div className=\"upsell-carousel animate-fade-in\" style={{ marginTop: `15px`, marginBottom: `15px`, padding: `12px`, background: `#f8fafc`, borderRadius: `12px`, border: `1px dashed #cbd5e1` }}>\n                  <h4 style={{ fontSize: `0.85rem`, margin: `0 0 10px 0`, color: `#334155`, fontWeight: `700` }}>¿Completamos tu pedido?</h4>\n                  <div style={{ display: `flex`, gap: `10px`, overflowX: `auto`, paddingBottom: `5px` }}>\n                    {upsellItems.map(item => (\n                      <div key={item.id} style={{ minWidth: `140px`, background: `white`, padding: `8px`, borderRadius: `8px`, border: `1px solid #e2e8f0`, boxShadow: `0 1px 3px rgba(0,0,0,0.05)`, display: `flex`, flexDirection: `column`, justifyContent: `space-between` }}>\n                        <div>\n                          <p style={{ fontSize: `0.75rem`, fontWeight: `600`, color: `#0f172a`, margin: `0 0 4px 0`, display: `-webkit-box`, WebkitLineClamp: 2, WebkitBoxOrient: `vertical`, overflow: `hidden` }}>{item.nombre}</p>\n                          <p style={{ fontSize: `0.75rem`, color: `var(--red-600)`, margin: 0, fontWeight: `700` }}>${(Number(item.precio)).toLocaleString(`es-AR`)}</p>\n                        </div>\n                        <button \n                          className=\"btn btn-secondary btn-sm\" \n                          type=\"button\"\n                          style={{ marginTop: `8px`, padding: `4px 8px`, fontSize: `0.7rem`, width: `100%` }}\n                          onClick={() => handleAddToCart(item)}\n                        >\n                          + Agregar\n                        </button>\n                      </div>\n                    ))}\n                  </div>\n                </div>\n              )}\n\n              <div className=\"payment-method-selector\"';

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
