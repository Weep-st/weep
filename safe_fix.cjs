const fs = require('fs');

function applySafeFix() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    // 1. Change openInactiveCityModal
    content = content.replace(
        /const openInactiveCityModal = \(cityName\) => \{[\s\S]*?setLeadSubmitted\(false\);\s*\n\s*\};/,
        `const openInactiveCityModal = (cityName) => {\n    setInactiveCityModal(cityName);\n    setModal('register');\n  };`
    );

    // 2. Change select name="ciudad" in register modal
    content = content.replace(
        /<select name="ciudad" className="form-input" required( defaultValue=\{[^}]+\})? style=\{\{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba\(255, 255, 255, 0\.15\)', background: 'var\(--slate-800, #1e293b\)', color: '#f8fafc' \}\}>/g,
        `<select name="ciudad" className="form-input" required defaultValue={inactiveCityModal || "Santo Tomé"} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.15)', background: 'var(--slate-800, #1e293b)', color: '#f8fafc' }}>`
    );

    // 3. Disable the old inactiveCityModal rendering by making the condition false
    // There might be multiple {inactiveCityModal && (, but I'll replace the one that renders the modal.
    // Specifically looking for the one followed by <div className="modal-overlay" style={{ zIndex: 10050
    content = content.replace(
        /\{inactiveCityModal && \(\s*<div className="modal-overlay" style=\{\{\s*zIndex:\s*10050/g,
        `{false && inactiveCityModal && (\n        <div className="modal-overlay" style={{ zIndex: 10050`
    );

    fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
    console.log("Safe fix applied!");
}
applySafeFix();
