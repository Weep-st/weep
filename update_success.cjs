const fs = require('fs');

function applySuccessMessage() {
    let content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

    const searchStr = `            setModal(null);
            toast.success('¡Registro exitoso!');
          } else toast.error('Error al registrar');`;
          
    const replacementStr = `            setModal(null);
            const isInactiveCity = !ciudad.includes('Santo Tomé') && !ciudad.includes('Oberá');
            if (isInactiveCity) {
              toast.success(\`¡Registro exitoso! Te avisaremos con novedades sobre el lanzamiento en \${ciudad}.\`, { duration: 5500, icon: '🚀' });
            } else {
              toast.success('¡Registro exitoso!');
            }
          } else toast.error('Error al registrar');`;

    // Wait, let's use a regex to be more flexible with indentation
    const regex = /setModal\(null\);\s*toast\.success\('¡Registro exitoso!'\);\s*\} else toast\.error\('Error al registrar'\);/g;
    
    if (regex.test(content)) {
        content = content.replace(regex, replacementStr);
        fs.writeFileSync('src/pages/PruebasWalletApp.jsx', content);
        console.log("Success message applied!");
    } else {
        console.log("Could not find the target string.");
    }
}
applySuccessMessage();
