const fs = require('fs');

function fixZIndex() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    const searchString = '<div className="modal-overlay" onClick={() => { setModal(null); setShowPassword(false); }}>';
    const replaceString = '<div className="modal-overlay" onClick={() => { setModal(null); setShowPassword(false); }} style={{ zIndex: 12000 }}>';

    if (content.includes(searchString)) {
        content = content.replace(searchString, replaceString);
        fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
        console.log("Fixed z-index!");
    } else {
        console.log("Search string not found.");
    }
}
fixZIndex();
