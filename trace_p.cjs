const fs = require('fs');

function trace(filename) {
    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    let stack = [];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        for (let j = 0; j < line.length; j++) {
            if (line[j] === '(') stack.push({ line: i + 1, col: j + 1 });
            else if (line[j] === ')') {
                if (stack.length === 0) console.log(`Extra ) at line ${i + 1}:${j + 1}`);
                else stack.pop();
            }
        }
    }
    
    console.log("--- REMAINING STACK ---");
    stack.forEach(p => console.log(`Unclosed ( from ${p.line}:${p.col}`));
}

trace(process.argv[2]);
