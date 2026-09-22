const fs = require('fs');

function applyFix() {
    const lines = fs.readFileSync('src/services/api.js', 'utf8').split('\n');
    
    // Find the line that defines userEmail
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('const userEmail = baseEmail.includes(')) {
            lines[i] = "    const userEmail = baseEmail;";
            break;
        }
    }
    
    fs.writeFileSync('src/services/api.js', lines.join('\n'));
    console.log("Fixed userEmail line.");
}
applyFix();
