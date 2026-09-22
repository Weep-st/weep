const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/PruebasWalletApp.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Initial State
if (!content.includes('otherOptions: [],')) {
    content = content.replace('mostOrdered: [],', 'mostOrdered: [],\n    otherOptions: [],');
}

// 2. Population in loadHomeData
if (!content.includes('otherOptions: (() => {')) {
    const mostOrderedLine = 'mostOrdered: formatCarouselItems(rawMostOrdered),';
    const otherOptionsLogic = `mostOrdered: formatCarouselItems(rawMostOrdered),
            otherOptions: (() => { 
                const all = [...(expl||[]), ...(most||[]), ...(prms||[])]; 
                const hour = new Date().getHours(); 
                const isDay = hour >= 6 && hour < 19; 
                const cats = isDay ? ['panadería', 'cafetería', 'desayuno', 'merienda', 'medialunas', 'alfajores', 'tostado', 'chipa', 'infusiones', 'torta', 'helado', 'postre'] : ['hamburguesa', 'pizza', 'sándwich', 'empanada', 'lomo', 'restaurante', 'cena', 'almuerzo', 'bebidas', 'cerveza', 'helado', 'postre']; 
                let openItems = all.filter(item => { 
                    const loc = allLocs.find(l => l.id === item.local_id); 
                    return loc && isLocalOpen(loc); 
                }); 
                let scheduleFiltered = openItems.filter(item => { 
                    const cat = (item.categoria || '').toLowerCase(); 
                    const loc = allLocs.find(l => l.id === item.local_id); 
                    const locCat = (loc?.rubros || []).join(' ').toLowerCase() + ' ' + (loc?.rubro || '').toLowerCase(); 
                    return cats.some(c => cat.includes(c) || locCat.includes(c)); 
                }); 
                const baseItems = scheduleFiltered.length > 5 ? scheduleFiltered : openItems; 
                const uniqueBase = Array.from(new Map(baseItems.map(item => [item.id, item])).values()); 
                for (let i = uniqueBase.length - 1; i > 0; i--) { 
                    const j = Math.floor(Math.random() * (i + 1)); 
                    [uniqueBase[i], uniqueBase[j]] = [uniqueBase[j], uniqueBase[i]]; 
                } 
                return formatCarouselItems(uniqueBase).slice(0, 10); 
            })(),`;
    
    if (content.includes(mostOrderedLine)) {
        content = content.replace(mostOrderedLine, otherOptionsLogic);
        console.log("Injected logic for otherOptions");
    } else {
        const crlfMost = mostOrderedLine.replace(/\n/g, '\r\n');
        content = content.replace(crlfMost, otherOptionsLogic.replace(/\n/g, '\r\n'));
        console.log("Injected logic for otherOptions (CRLF)");
    }
}

// 3. JSX Rendering
if (!content.includes('Otras opciones 🎲')) {
    const sectionStart = content.indexOf('<h2>Lo más pedido 🔥</h2>');
    if (sectionStart !== -1) {
        const sectionEndStr = '</section>';
        const sectionEnd = content.indexOf(sectionEndStr, sectionStart);
        
        if (sectionEnd !== -1) {
            const insertionPoint = sectionEnd + sectionEndStr.length;
            
            const newSection = `
             {/* 5.6 OTRAS OPCIONES */}
             {homeLayout.otherOptions && homeLayout.otherOptions.length > 0 && (
               <section className="home-section other-options">
                  <div className="section-header-simple">
                    <h2>Otras opciones 🎲</h2>
                  </div>
                  <div className="horizontal-scroll-items" style={{ gap: '12px', padding: '10px 4px' }}>
                    {homeLayout.otherOptions.map((item) => {
                      const loc = locals.find(l => l.id === item.local_id);
                      const open = isLocalOpen(loc);
                      const isPremium = loc?.plan_id === '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';

                      return (
                        <div 
                          key={\`other-\${item.id}\`} 
                          className={\`item-promo-card-vertical animate-fade-in \${open ? '' : 'is-closed'} \${isPremium ? 'is-premium' : ''}\`} 
                          onClick={() => open && handleAddToCart(item)}
                        >
                           <div className="item-promo-img">
                              <img src={item.imagen_url || 'https://via.placeholder.com/150'} alt={item.nombre} />
                           </div>
                           <div className="item-promo-info">
                              <h3 className="item-promo-name">{item.nombre}</h3>
                              <p className="item-promo-local">{loc ? loc.nombre : 'Local'}</p>
                              <div className="item-promo-price-row">
                                 <span className="price-tag">
                                   \${calculateDiscountedPrice(item).toLocaleString('es-AR')}
                                 </span>
                                 {open ? (
                                   <button className="promo-mini-add-btn" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>+</button>
                                 ) : (
                                   <span style={{ fontSize: '0.65rem', color: 'var(--red-600)', fontWeight: '700' }}>
                                     Cerrado
                                   </span>
                                 )}
                              </div>
                           </div>
                        </div>
                      );
                    })}
                  </div>
               </section>
             )}`;
             
            content = content.substring(0, insertionPoint) + newSection + content.substring(insertionPoint);
            console.log("Injected JSX for otras opciones");
        }
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
