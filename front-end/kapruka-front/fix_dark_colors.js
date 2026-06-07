const fs = require('fs');
let content = fs.readFileSync('src/ChatApp.tsx', 'utf8');
content = content.replace(/darkMode \? '([^']*)text-brand-purple([^']*)'/g, "darkMode ? '$1text-brand-purple-accent$2'");
content = content.replace(/darkMode \? '([^']*)border-brand-purple([^']*)'/g, "darkMode ? '$1border-brand-purple-accent$2'");
content = content.replace(/darkMode \? '([^']*)bg-brand-purple([^']*)'/g, "darkMode ? '$1bg-brand-purple-accent$2'");
fs.writeFileSync('src/ChatApp.tsx', content);
