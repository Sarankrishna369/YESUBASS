const fs = require('fs');
const content = fs.readFileSync('node_modules/shoukaku/dist/index.d.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('connect')) {
        console.log(`${i+1}: ${line}`);
    }
});
