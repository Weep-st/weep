const fs = require('fs');

function applyZIndex() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    const searchString = '<div className="modal-overlay" onClick={() => { setModal(null); setShowPassword(false); }}>';
    const replaceString = '<div className="modal-overlay" onClick={() => { setModal(null); setShowPassword(false); }} style={{ zIndex: 12000 }}>';

    if (content.includes(searchString)) {
        content = content.replace(searchString, replaceString);
        fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
        console.log("Applied zIndex: 12000 to main modals!");
    } else {
        console.log("Could not find the main modal overlay to apply zIndex.");
    }
}
applyZIndex();
