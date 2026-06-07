const fs = require('fs');
let content = fs.readFileSync('src/ChatApp.tsx', 'utf8');
content = content.replace(/text-brand-purple-accent-accent/g, "text-brand-purple-accent");
content = content.replace(/text-brand-purple-accent-light/g, "text-brand-purple-accent");
fs.writeFileSync('src/ChatApp.tsx', content);
