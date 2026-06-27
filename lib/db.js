import Database from 'better-sqlite3';
import path from 'path';

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
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    subscription_ends_at DATETIME,
    adobe_account_id INTEGER
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
  const stmt = db.prepare('INSERT INTO clients (email, telegram, subscription_ends_at) VALUES (?, ?, ?)');
  return stmt.run(email, telegram, subscription_ends_at);
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

export function insertAdobeAccount(email, password, adobe_password, refresh_token, device_id, upload_id = null) {
  const stmt = db.prepare('INSERT INTO adobe_accounts (email, password, adobe_password, refresh_token, device_id, upload_id) VALUES (?, ?, ?, ?, ?, ?)');
  return stmt.run(email, password, adobe_password, refresh_token, device_id, upload_id);
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
