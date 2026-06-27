import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

// Define the database path
const dbPath = path.resolve(process.cwd(), 'emails.db');

// Initialize the database
const db = new Database(dbPath);

// Create the table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    telegram TEXT,
    telegram_chat_id TEXT,
    bot_link_token TEXT UNIQUE,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    subscription_ends_at DATETIME,
    adobe_account_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    sender TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS adobe_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS adobe_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    adobe_password TEXT,
    refresh_token TEXT,
    device_id TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checked_at DATETIME DEFAULT NULL,
    assigned_client_id INTEGER,
    upload_id INTEGER
  );
`);

// Try to add upload_id column if table already existed before this update
try {
  db.exec('ALTER TABLE adobe_accounts ADD COLUMN upload_id INTEGER');
} catch (e) {
  // Ignore error if column already exists
}

// [SECURITY] C-01+C-02: Add access_token column for secure client-facing URLs
try {
  db.exec('ALTER TABLE adobe_accounts ADD COLUMN access_token TEXT');
} catch (e) {
  // Ignore error if column already exists
}
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_adobe_access_token ON adobe_accounts(access_token)');
} catch (e) {
  // Ignore if index already exists
}

try {
  db.exec('ALTER TABLE clients ADD COLUMN telegram_chat_id TEXT');
} catch (e) {}
try {
  db.exec('ALTER TABLE clients ADD COLUMN bot_link_token TEXT');
} catch (e) {}
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_link_token ON clients(bot_link_token)');
} catch (e) {}
['telegram_username','telegram_first_name','telegram_last_name'].forEach(c => {
  try { db.exec('ALTER TABLE clients ADD COLUMN ' + c + ' TEXT'); } catch(e) {}
});

db.exec(`
  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    sender TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0
  );
`);

// [SECURITY] Migrate existing rows: generate access_token for rows that don't have one
try {
  const rowsWithoutToken = db.prepare("SELECT id FROM adobe_accounts WHERE access_token IS NULL").all();
  if (rowsWithoutToken.length > 0) {
    const updateStmt = db.prepare("UPDATE adobe_accounts SET access_token = ? WHERE id = ?");
    const migrateTransaction = db.transaction(() => {
      for (const row of rowsWithoutToken) {
        updateStmt.run(crypto.randomUUID(), row.id);
      }
    });
    migrateTransaction();
    console.log(`[DB] Migrated ${rowsWithoutToken.length} adobe_accounts with access_tokens`);
  }
} catch (e) {
  console.error('[DB] access_token migration skipped:', e.message);
}

export function insertEmail(email, password) {
  const stmt = db.prepare('INSERT INTO emails (email, password) VALUES (?, ?)');
  return stmt.run(email, password);
}

export function getAllEmails() {
  const stmt = db.prepare('SELECT * FROM emails ORDER BY created_at DESC');
  return stmt.all();
}

export function getEmailById(id) {
  const stmt = db.prepare('SELECT * FROM emails WHERE id = ?');
  return stmt.get(id);
}

export function deleteEmail(id) {
  const stmt = db.prepare('DELETE FROM emails WHERE id = ?');
  return stmt.run(id);
}

export function clearAllEmails() {
  const stmt = db.prepare('DELETE FROM emails');
  return stmt.run();
}

// Clients Helpers
export function getAllClients() {
  const stmt = db.prepare(`
    SELECT c.*, 
           aa.email as adobe_account_email, aa.status as adobe_account_status
    FROM clients c
    LEFT JOIN adobe_accounts aa ON c.adobe_account_id = aa.id
    ORDER BY c.id DESC
  `);
  return stmt.all();
}

export function insertClient(email, telegram, subscription_ends_at) {
  const token = crypto.randomUUID();
  const stmt = db.prepare('INSERT INTO clients (email, telegram, subscription_ends_at, bot_link_token) VALUES (?, ?, ?, ?)');
  return stmt.run(email, telegram, subscription_ends_at, token);
}

export function updateClientAdobeAccount(clientId, accountId) {
  const stmt = db.prepare('UPDATE clients SET adobe_account_id = ? WHERE id = ?');
  return stmt.run(accountId, clientId);
}

// Adobe Accounts Helpers
export function getAllAdobeAccounts() {
  const stmt = db.prepare(`
    SELECT a.*, c.email as client_email 
    FROM adobe_accounts a
    LEFT JOIN clients c ON a.assigned_client_id = c.id
    ORDER BY a.id DESC
  `);
  return stmt.all();
}

// [SECURITY] C-01+C-02: Generate UUID access_token on insert
export function insertAdobeAccount(email, password, adobe_password, refresh_token, device_id, upload_id = null) {
  const access_token = crypto.randomUUID();
  const stmt = db.prepare('INSERT INTO adobe_accounts (email, password, adobe_password, refresh_token, device_id, upload_id, access_token) VALUES (?, ?, ?, ?, ?, ?, ?)');
  return stmt.run(email, password, adobe_password, refresh_token, device_id, upload_id, access_token);
}

export function deleteAdobeAccount(id) {
  const stmt = db.prepare('DELETE FROM adobe_accounts WHERE id = ?');
  db.prepare('UPDATE clients SET adobe_account_id = NULL WHERE adobe_account_id = ?').run(id);
  return stmt.run(id);
}

export function getAdobeAccountById(id) {
  const stmt = db.prepare('SELECT * FROM adobe_accounts WHERE id = ?');
  return stmt.get(id);
}

// [SECURITY] C-01+C-02: Lookup by access_token instead of sequential ID
export function getAdobeAccountByAccessToken(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return undefined;
  const stmt = db.prepare('SELECT * FROM adobe_accounts WHERE access_token = ?');
  return stmt.get(accessToken);
}

export function updateAdobeAccountClient(accountId, clientId) {
  const stmt = db.prepare('UPDATE adobe_accounts SET assigned_client_id = ? WHERE id = ?');
  return stmt.run(clientId, accountId);
}

export function getActiveUnassignedAdobeAccount() {
  const stmt = db.prepare("SELECT * FROM adobe_accounts WHERE assigned_client_id IS NULL AND status = 'active' LIMIT 1");
  return stmt.get();
}

// Adobe Uploads Helpers
export function insertAdobeUpload() {
  const stmt = db.prepare('INSERT INTO adobe_uploads DEFAULT VALUES');
  return stmt.run().lastInsertRowid;
}

export function getAdobeUploads() {
  const stmt = db.prepare(`
    SELECT u.id, u.created_at, COUNT(a.id) as accounts_count
    FROM adobe_uploads u
    LEFT JOIN adobe_accounts a ON u.id = a.upload_id
    GROUP BY u.id
    ORDER BY u.id DESC
  `);
  return stmt.all();
}

export function getAdobeAccountsByUploadId(uploadId) {
  const stmt = db.prepare('SELECT * FROM adobe_accounts WHERE upload_id = ?');
  return stmt.all(uploadId);
}

export function updateAdobeAccountStatus(id, status) {
  const stmt = db.prepare("UPDATE adobe_accounts SET status = ?, checked_at = CURRENT_TIMESTAMP WHERE id = ?");
  return stmt.run(status, id);
}

export default db;
