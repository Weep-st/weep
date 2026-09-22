const fs = require('fs');

function applyChange() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    // 1. Change openInactiveCityModal
    const oldOpen = `  const openInactiveCityModal = (cityName) => {
    setInactiveCityModal(cityName);
    setLeadForm({ nombre: '', whatsapp: '', email: '' });
    setLeadSubmitted(false);
  };`;
    const newOpen = `  const openInactiveCityModal = (cityName) => {
    setInactiveCityModal(cityName);
    setModal('register');
  };`;
    
    if (content.includes(oldOpen)) {
        content = content.replace(oldOpen, newOpen);
    } else {
        console.log("Could not find openInactiveCityModal to replace.");
    }

    // 2. Change select name="ciudad" in register modal
    const oldSelect = `<select name="ciudad" className="form-input" required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.15)', background: 'var(--slate-800, #1e293b)', color: '#f8fafc' }}>`;
    const newSelect = `<select name="ciudad" className="form-input" required defaultValue={inactiveCityModal || "Santo Tomé"} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.15)', background: 'var(--slate-800, #1e293b)', color: '#f8fafc' }}>`;
    
    if (content.includes(oldSelect)) {
        content = content.replace(oldSelect, newSelect);
    } else {
        console.log("Could not find select to replace.");
    }

    // 3. Remove the entire inactiveCityModal rendering block
    // We can use a regex to match from {inactiveCityModal && ( to the end of the block.
    // Since it's large and nested, let's find the string boundaries.
    const startStr = "{inactiveCityModal && (";
    const startIndex = content.lastIndexOf(startStr); // Since it's near the end
    
    if (startIndex !== -1) {
        // Find the closing )}
        // Since there is another one further up? No, this is the main one.
        // Let's just find the exact text for the button that closes it.
        const endStr = "          </div>\n        </div>\n      )}";
        const endIndex = content.indexOf(endStr, startIndex);
        
        if (endIndex !== -1) {
            content = content.slice(0, startIndex) + content.slice(endIndex + endStr.length);
        } else {
            console.log("Could not find end of inactiveCityModal block.");
            // Alternative: remove using line numbers?
        }
    } else {
        console.log("Could not find start of inactiveCityModal block.");
    }

    fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
    console.log("Applied changes!");
}
applyChange();
