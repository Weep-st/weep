
const fs = require('fs');
const content = fs.readFileSync('src/pages/PruebasWalletApp.jsx', 'utf8');

let stack = [];
for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') {
        stack.push({ char: '{', pos: i });
    } else if (content[i] === '}') {
        if (stack.length === 0) {
            console.log("Extra closing brace at " + i);
            process.exit(1);
        }
        stack.pop();
    }
}

if (stack.length > 0) {
    console.log("Unclosed braces: ", stack);
    process.exit(1);
}

console.log("Braces are balanced");
