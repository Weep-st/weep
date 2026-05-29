const fs = require('fs');

function checkBalance(filename) {
    const content = fs.readFileSync(filename, 'utf8');
    let pStack = [];
    let bStack = [];
    let line = 1;
    let col = 1;
    let inString = null; // ' " or `
    let inComment = null; // // or /*

    for (let i = 0; i < content.length; i++) {
        let char = content[i];
        
        if (char === '\n') {
            line++;
            col = 1;
            if (inComment === '//') inComment = null;
            continue;
        }

        if (inComment) {
            if (inComment === '/*' && char === '*' && content[i+1] === '/') {
                inComment = null;
                i++;
            }
            continue;
        }

        if (inString) {
            if (char === inString && content[i-1] !== '\\') inString = null;
            continue;
        }

        if (char === '/' && content[i+1] === '/') {
            inComment = '//';
            i++;
            continue;
        }
        if (char === '/' && content[i+1] === '*') {
            inComment = '/*';
            i++;
            continue;
        }

        if (char === "'" || char === '"' || char === '`') {
            inString = char;
            continue;
        }

        if (char === '(') pStack.push({ line, col, text: content.substring(i, i + 10).replace(/\n/g, ' ') });
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

    pStack.forEach(p => console.log(`Unclosed ( from ${p.line}:${p.col} near "${p.text}"`));
    bStack.forEach(b => console.log(`Unclosed { from ${b.line}:${b.col}`));
}

checkBalance(process.argv[2]);
