const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'emails.db'));
const rows = db.prepare("SELECT key FROM app_settings").all();
console.log(rows);
