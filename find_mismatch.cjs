const fs = require('fs');

function findMismatch(filename) {
    const content = fs.readFileSync(filename, 'utf8');
    let stack = [];
    let line = 1, col = 1;
    let skipUntil = null;

    for (let i = 0; i < content.length; i++) {
        let char = content[i];
        if (char === '\n') { line++; col = 1; continue; }

        if (skipUntil) {
            if (content.substring(i, i + skipUntil.length) === skipUntil) {
                i += skipUntil.length - 1;
                skipUntil = null;
            }
            continue;
        }

        if (content.substring(i, i + 2) === '//') { skipUntil = '\n'; continue; }
        if (content.substring(i, i + 2) === '/*') { skipUntil = '*/'; i++; continue; }
        if (char === "'" || char === '"' || char === '`') { skipUntil = char; continue; }

        if (char === '(') stack.push({ line, col });
        else if (char === ')') {
            if (stack.length === 0) { console.log(`EXTRA ) AT ${line}:${col}`); return; }
            stack.pop();
        }
        col++;
    }

    if (stack.length > 0) {
        stack.forEach(s => console.log(`UNCLOSED ( AT ${s.line}:${s.col}`));
    } else {
        console.log("BALANCED PARENTHESES");
    }
}

findMismatch(process.argv[2]);
