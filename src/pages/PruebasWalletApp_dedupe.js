
const fs = require('fs');
const path = 'c:/Users/axelm/OneDrive/Desktop/Weep/src/pages/PruebasWalletApp.jsx';
let content = fs.readFileSync(path, 'utf8');
// Deduplicate the promos block. 
// We want to remove the block that uses "menu-card card card-hover" inside "promos-imperdibles"
const startTag = '<div className="horizontal-scroll-items">';
const endTag = '</div>';
const startIndex = content.indexOf(startTag, content.indexOf('promos-imperdibles'));
const endIndex = content.indexOf(endTag, startIndex + startTag.length) + endTag.length;
if (startIndex !== -1 && endIndex !== -1) {
    const sectionToKeep = content.indexOf('style={{ gap: \'12px\' }}', endIndex);
    if (sectionToKeep !== -1) {
        content = content.substring(0, startIndex) + content.substring(content.lastIndexOf('<div', sectionToKeep));
         // Wait, easier:
    }
}
// Actually, let's just do a string replace of the known bad block
const badBlock = content.substring(content.indexOf('<div className="horizontal-scroll-items">', content.indexOf('promos-imperdibles')), content.lastIndexOf('</div>', content.indexOf('style={{ gap: \'12px\' }}')) + 6);
content = content.replace(badBlock, '');
fs.writeFileSync(path, content, 'utf8');
