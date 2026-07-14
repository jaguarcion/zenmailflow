const fs = require('fs');
let content = fs.readFileSync('telegram-bot/eset-bot.js', 'utf8');

if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 65279 || content.startsWith('?')) {
    content = content.replace(/^\?/, '').replace(/^\uFEFF/, '');
}

fs.writeFileSync('telegram-bot/eset-bot.js', content, 'utf8');
