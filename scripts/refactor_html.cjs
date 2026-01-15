const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// 1. Add layout.css link
let updated = content.replace(
    '<link rel="stylesheet" href="/src/styles/components.css" />',
    '<link rel="stylesheet" href="/src/styles/components.css" />\n    <link rel="stylesheet" href="/src/styles/layout.css" />'
);

// 2. Remove the large style block
// It starts at <style> and ends at </style> before </head>
const startTag = '    <style>';
const endTag = '    </style>';

const startIndex = updated.indexOf(startTag);
const endIndex = updated.indexOf(endTag, startIndex) + endTag.length;

if (startIndex !== -1 && endIndex !== -1) {
    updated = updated.slice(0, startIndex) + updated.slice(endIndex);
}

fs.writeFileSync('index.html', updated);
console.log('Successfully refactored index.html');
