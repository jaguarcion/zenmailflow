import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { insertAppleAccount } from '../lib/db.js';

// Paths
const OLD_DB_PATH = path.join(process.cwd(), 'apple_accounts.db');

if (!fs.existsSync(OLD_DB_PATH)) {
    console.log(`[Migrate] No old database found at ${OLD_DB_PATH}. Nothing to migrate.`);
    // Next.js might have created it inside .next/server instead. Let's check there too.
    const altPath = path.join(process.cwd(), '.next', 'server', 'apple_accounts.db');
    if (fs.existsSync(altPath)) {
        console.log(`[Migrate] Found database at alternative path: ${altPath}`);
        migrateFrom(altPath);
    } else {
        process.exit(0);
    }
} else {
    migrateFrom(OLD_DB_PATH);
}

function migrateFrom(dbPath) {
    console.log(`[Migrate] Opening old database at ${dbPath}...`);
    const oldDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('[Migrate] Error opening old database:', err.message);
            process.exit(1);
        }
    });

    oldDb.all('SELECT * FROM accounts', [], (err, rows) => {
        if (err) {
            console.error('[Migrate] Error reading accounts table:', err.message);
            // Table might not exist if it's an empty DB, just exit
            process.exit(0);
        }

        console.log(`[Migrate] Found ${rows.length} accounts to migrate.`);
        let migrated = 0;

        for (const row of rows) {
            try {
                insertAppleAccount(
                    row.email,
                    row.email_login,
                    row.password,
                    row.first_name,
                    row.last_name,
                    row.birth_date,
                    row.phone
                );
                migrated++;
                console.log(`[Migrate] Migrated account: ${row.email}`);
            } catch (insertErr) {
                console.error(`[Migrate] Failed to migrate account ${row.email}:`, insertErr.message);
            }
        }

        console.log(`[Migrate] Successfully migrated ${migrated}/${rows.length} accounts to emails.db`);
        oldDb.close((closeErr) => {
            if (!closeErr) {
                // Optionally delete the old db file
                // fs.unlinkSync(dbPath);
                console.log(`[Migrate] You can now safely delete the old database file: ${dbPath}`);
            }
            process.exit(0);
        });
    });
}
