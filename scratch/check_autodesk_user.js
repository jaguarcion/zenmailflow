const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.resolve('e:\\OSPanel\\home\\zenmailflow\\emails.db'));

async function main() {
    const rows = db.prepare('SELECT key FROM app_settings').all();
    console.log("All app_settings keys:", rows.map(r => r.key).join(', '));
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('autodesk_config');
    const config = JSON.parse(row.value);
    
    const url = `https://api.user-access.aum.autodesk.com/user-access/v1/teams/urn:adsk.aum:prd:tenant.oxygenId:${config.tenantId}/users`;
    console.log("Fetching", url);
    const headers = {
        "accept": "application/json, text/plain, */*",
        "authorization": config.token,
        "content-type": "application/json",
        "cookie": config.cookie,
        "origin": "https://manage.autodesk.com",
        "referer": "https://manage.autodesk.com/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
    };

    try {
        const res = await fetch(url, { headers });
        const data = await res.json();
        const users = data.results || data.users || [];
        if (users.length > 0) {
            console.log("Keys of first user:");
            console.log(Object.keys(users[0]).join(", "));
            console.log("\nFull user object:");
            console.log(JSON.stringify(users[0], null, 2));
        } else {
            console.log("No users returned", data);
        }
    } catch (e) {
        console.error(e);
    }
}
main();
