const fs = require('fs');

function fixHandleRegister() {
    const lines = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8').split('\n');
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("const isInactiveCity = !ciudad.includes('Santo Tomé') && !ciudad.includes('Oberá');")) {
            start = i - 1; // Start at setModal(null);
            break;
        }
    }

    if (start > -1) {
        // Delete 7 lines starting from setModal(null);
        lines.splice(start, 7, 
            "            const isInactiveCity = !ciudad.includes('Santo Tomé') && !ciudad.includes('Oberá');",
            "            if (isInactiveCity) {",
            "              setInactiveCityModal(ciudad);",
            "              setModal('success_inactive');",
            "            } else {",
            "              setModal(null);",
            "              toast.success('¡Registro exitoso!');",
            "            }"
        );
        fs.writeFileSync('src/pages/PruebasWalletApp.jsx', lines.join('\n'));
        console.log("handleRegister fixed!");
    } else {
        console.log("Could not find the target to splice.");
    }
}
fixHandleRegister();
