const fs = require('fs');
const content = fs.readFileSync(process.argv[2], 'utf8');
const lines = content.split('\n');
for (let i = lines.length - 10; i < lines.length; i++) {
    if (i < 0) continue;
    console.log(`${i+1}: ${lines[i]} | ${Buffer.from(lines[i]).toString('hex')}`);
}
