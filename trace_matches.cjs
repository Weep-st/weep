const fs = require('fs');

function trace(filename) {
    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    let stack = [];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        for (let j = 0; j < line.length; j++) {
            if (line[j] === '(') stack.push({ line: i + 1, col: j + 1 });
            else if (line[j] === ')') {
                if (stack.length === 0) {
                    console.log(`EXTRA ) at ${i + 1}:${j + 1}`);
                } else {
                    let matched = stack.pop();
                    if ((i + 1 >= 1350 && i + 1 <= 1500) || i+1 >= 2290) {
                        console.log(`) at ${i + 1}:${j + 1} matches ( at ${matched.line}:${matched.col}`);
                    }
                }
            }
        }
    }
}

trace(process.argv[2]);
