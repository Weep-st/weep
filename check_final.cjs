const fs = require('fs');
const content = fs.readFileSync(process.argv[2], 'utf8');
let stack = [];
let line = 1, col = 1;
let inString = null;
let inComment = null;

for (let i = 0; i < content.length; i++) {
    let char = content[i];
    if (char === '\n') { line++; col = 1; if (inComment === '//') inComment = null; continue; }
    if (inComment) {
        if (inComment === '/*' && char === '*' && content[i+1] === '/') { inComment = null; i++; }
        continue;
    }
    if (inString) {
        if (char === inString && content[i-1] !== '\\') inString = null;
        continue;
    }
    if (char === '/' && content[i+1] === '/') { inComment = '//'; i++; continue; }
    if (char === '/' && content[i+1] === '*') { inComment = '/*'; i++; continue; }
    if (char === "'" || char === '"' || char === '`') { inString = char; continue; }

    if (char === '{' || char === '(' || char === '[') stack.push({ char, line, col });
    else if (char === '}' || char === ')' || char === ']') {
        if (stack.length === 0) { console.log(`Extra ${char} at ${line}:${col}`); process.exit(1); }
        let last = stack.pop();
        if ((char === '}' && last.char !== '{') || (char === ')' && last.char !== '(') || (char === ']' && last.char !== '[')) {
            console.log(`Mismatch: ${last.char} from ${last.line}:${last.col} matched with ${char} at ${line}:${col}`);
            process.exit(1);
        }
    }
    col++;
}
if (stack.length > 0) {
    stack.forEach(s => console.log(`Unclosed ${s.char} from ${s.line}:${s.col}`));
} else {
    console.log("OK");
}
