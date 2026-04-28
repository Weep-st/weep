const fs = require('fs');

function checkBalance(filename) {
    const content = fs.readFileSync(filename, 'utf8');
    let pStack = [];
    let bStack = [];
    let line = 1;
    let col = 1;

    for (let i = 0; i < content.length; i++) {
        let char = content[i];
        if (char === '\n') {
            line++;
            col = 1;
            continue;
        }

        if (char === '(') pStack.push({ line, col, text: content.substring(i, i + 20).replace(/\n/g, ' ') });
        else if (char === ')') {
            if (pStack.length === 0) console.log(`Extra ) at ${line}:${col}`);
            else pStack.pop();
        }

        if (char === '{') bStack.push({ line, col });
        else if (char === '}') {
            if (bStack.length === 0) console.log(`Extra } at ${line}:${col}`);
            else bStack.pop();
        }
        col++;
    }

    console.log("--- UNCLOSED ITEMS ---");
    pStack.forEach(p => console.log(`Unclosed ( at ${p.line}:${p.col} near "${p.text}"`));
    bStack.forEach(b => console.log(`Unclosed { at ${b.line}:${b.col}`));
}

checkBalance(process.argv[2]);
