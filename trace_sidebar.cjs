const fs = require('fs');
const content = fs.readFileSync(process.argv[2], 'utf8').split('\n');
let p = 0;
for (let i = 1466; i < 1728; i++) {
    for (let char of content[i]) {
        if (char === '(') p++;
        else if (char === ')') p--;
    }
    console.log(`${i+1}: ${p}`);
}
