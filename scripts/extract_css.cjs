const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split(/\r?\n/);
const styleLines = lines.slice(17, 2086); // 0-indexed: line 18 is index 17, line 2086 is index 2085
const cleanedLines = styleLines.map(line => line.replace(/^        /, ''));
fs.writeFileSync('src/styles/layout.css', cleanedLines.join('\n'));
