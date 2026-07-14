const fs = require('fs');
const iconv = require('iconv-lite');

const content = fs.readFileSync('telegram-bot/eset-bot.js', 'utf8');

// Encode the corrupted string into Windows-1251 bytes
const originalUtf8Bytes = iconv.encode(content, 'win1251');

// Decode the original UTF-8 bytes back to a correct JavaScript string
const fixedContent = iconv.decode(originalUtf8Bytes, 'utf8');

fs.writeFileSync('telegram-bot/eset-bot.js', fixedContent, 'utf8');
console.log('Fixed encoding!');
