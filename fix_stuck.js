const Database = require('better-sqlite3');
const db = new Database('e:/OSPanel/home/zenmailflow/zenmail.db');

try {
    const info = db.prepare("UPDATE autodesk_tasks SET status = 'completed' WHERE status = 'processing'").run();
    console.log(`Fixed ${info.changes} stuck tasks.`);
} catch(e) {
    console.error(e);
}
