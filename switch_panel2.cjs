const fs = require('fs');

function applyChange() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    const regex = /const openInactiveCityModal = \(cityName\) => \{[\s\S]*?setLeadSubmitted\(false\);\s*\n\s*\};/;
    
    if (regex.test(content)) {
        content = content.replace(regex, `const openInactiveCityModal = (cityName) => {\n    setInactiveCityModal(cityName);\n    setModal('register');\n  };`);
        fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
        console.log("Fixed openInactiveCityModal!");
    } else {
        console.log("Still could not find it.");
    }
}
applyChange();
