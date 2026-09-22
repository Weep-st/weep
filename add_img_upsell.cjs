const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

const searchStr = `                        <div>
                          <p style={{ fontSize: \`0.75rem\`, fontWeight: \`600\`, color: \`#0f172a\`, margin: \`0 0 4px 0\`, display: \`-webkit-box\`, WebkitLineClamp: 2, WebkitBoxOrient: \`vertical\`, overflow: \`hidden\` }}>{item.nombre}</p>
                          <p style={{ fontSize: \`0.75rem\`, color: \`var(--red-600)\`, margin: 0, fontWeight: \`700\` }}>\${(Number(item.precio)).toLocaleString(\`es-AR\`)}</p>
                        </div>`;

const replaceStr = `                        <div>
                          {item.imagen_url && (
                            <img src={item.imagen_url} alt={item.nombre} style={{ width: \`100%\`, height: \`70px\`, objectFit: \`cover\`, borderRadius: \`6px\`, marginBottom: \`6px\` }} />
                          )}
                          <p style={{ fontSize: \`0.75rem\`, fontWeight: \`600\`, color: \`#0f172a\`, margin: \`0 0 4px 0\`, display: \`-webkit-box\`, WebkitLineClamp: 2, WebkitBoxOrient: \`vertical\`, overflow: \`hidden\` }}>{item.nombre}</p>
                          <p style={{ fontSize: \`0.75rem\`, color: \`var(--red-600)\`, margin: 0, fontWeight: \`700\` }}>\${(Number(item.precio)).toLocaleString(\`es-AR\`)}</p>
                        </div>`;

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
