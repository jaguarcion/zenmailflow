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

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS yopmail_tasks (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total INTEGER DEFAULT 0,
    success INTEGER DEFAULT 0,
    error INTEGER DEFAULT 0,
    status TEXT DEFAULT 'processing',
    items_json TEXT
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS eset_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used BOOLEAN NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS eset_tasks (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total INTEGER DEFAULT 0,
    success INTEGER DEFAULT 0,
    error INTEGER DEFAULT 0,
    status TEXT DEFAULT 'processing',
    items_json TEXT,
    source TEXT DEFAULT 'web',
    user_info TEXT
  );

  CREATE TABLE IF NOT EXISTS eset_tg_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id TEXT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    keys_received INTEGER DEFAULT 0,
    last_generation_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS burp_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    domain TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS burp_inbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address_id INTEGER,
    from_address TEXT,
    subject TEXT,
    text_content TEXT,
    html_content TEXT,
    attachments_json TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(address_id) REFERENCES burp_addresses(id) ON DELETE CASCADE
  );
`);

// Try to add comment column if table already existed before this update
try {
  db.exec('ALTER TABLE adobe_accounts ADD COLUMN comment TEXT');
} catch (e) {
  // Ignore error if column already exists
}

try {
  db.exec("ALTER TABLE eset_tasks ADD COLUMN source TEXT DEFAULT 'web'");
} catch (e) {
}

try {
  db.exec("ALTER TABLE eset_tasks ADD COLUMN user_info TEXT");
} catch (e) {
}

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
try {
  db.exec('ALTER TABLE clients ADD COLUMN subscription_starts_at DATETIME');
} catch (e) {}

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

export function getClientById(id) {
  const stmt = db.prepare('SELECT * FROM clients WHERE id = ?');
  return stmt.get(id);
}

export function insertClient(email, telegram, subscription_starts_at, subscription_ends_at) {
  const token = crypto.randomUUID();
  const stmt = db.prepare('INSERT INTO clients (email, telegram, subscription_starts_at, subscription_ends_at, bot_link_token) VALUES (?, ?, ?, ?, ?)');
  return stmt.run(email, telegram, subscription_starts_at, subscription_ends_at, token);
}

export function updateClientAdobeAccount(clientId, accountId) {
  const stmt = db.prepare('UPDATE clients SET adobe_account_id = ? WHERE id = ?');
  return stmt.run(accountId, clientId);
}

// Adobe Accounts Helpers
export function getAllAdobeAccounts() {
  const stmt = db.prepare(`
    SELECT a.*, 
           c.email as client_email,
           c.telegram as client_telegram,
           c.telegram_first_name as client_first_name,
           c.telegram_last_name as client_last_name
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

export function updateAdobeAccountComment(accountId, comment) {
  const stmt = db.prepare('UPDATE adobe_accounts SET comment = ? WHERE id = ?');
  return stmt.run(comment, accountId);
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

// Analytics Helpers
export function getDashboardStats() {
  const accountsStats = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_accounts,
      SUM(CASE WHEN status = 'banned' THEN 1 ELSE 0 END) as banned_accounts,
      SUM(CASE WHEN assigned_client_id IS NOT NULL THEN 1 ELSE 0 END) as busy_accounts,
      SUM(CASE WHEN assigned_client_id IS NULL THEN 1 ELSE 0 END) as free_accounts,
      COUNT(*) as total_accounts
    FROM adobe_accounts
  `).get();

  const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;

  // Last 30 days client growth
  const clientsGrowth = db.prepare(`
    SELECT DATE(connected_at) as date, COUNT(*) as count
    FROM clients
    WHERE connected_at IS NOT NULL
    GROUP BY date
    ORDER BY date ASC
    LIMIT 30
  `).all();

  return {
    accounts: accountsStats,
    totalClients,
    clientsGrowth
  };
}

// Search
export function globalSearch(query) {
  const cleanQuery = query.startsWith('@') ? query.slice(1) : query;
  const likeQuery = `%${query}%`;
  const likeCleanQuery = `%${cleanQuery}%`;
  
  const clients = db.prepare(`
    SELECT id, email, telegram, telegram_first_name, telegram_last_name 
    FROM clients 
    WHERE email LIKE ? OR telegram LIKE ? OR telegram_first_name LIKE ? OR telegram_last_name LIKE ?
    LIMIT 10
  `).all(likeQuery, likeCleanQuery, likeCleanQuery, likeCleanQuery);

  const accounts = db.prepare(`
    SELECT id, email, status 
    FROM adobe_accounts 
    WHERE email LIKE ?
    LIMIT 10
  `).all(likeQuery);

  return { clients, accounts };
}

// Audit Logs
export function insertLog(action_type, description) {
  const stmt = db.prepare('INSERT INTO audit_logs (action_type, description) VALUES (?, ?)');
  return stmt.run(action_type, description);
}

export function getLogs(limit = 100) {
  const stmt = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?');
  return stmt.all(limit);
}

// App Settings
export function getSetting(key) {
  const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
  const result = stmt.get(key);
  return result ? result.value : null;
}

export function setSetting(key, value) {
  const stmt = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP) 
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  return stmt.run(key, value);
}

// Burp (Randmail) Helpers
export function insertBurpAddress(address, label, domain) {
  const stmt = db.prepare('INSERT INTO burp_addresses (address, label, domain) VALUES (?, ?, ?)');
  return stmt.run(address, label, domain);
}

export function getAllBurpAddresses() {
  const stmt = db.prepare(`
    SELECT a.*, (SELECT COUNT(*) FROM burp_inbox WHERE address_id = a.id) as message_count 
    FROM burp_addresses a 
    ORDER BY a.id DESC
  `);
  return stmt.all();
}

export function getBurpAddressByDomain(domain) {
  const stmt = db.prepare('SELECT * FROM burp_addresses WHERE domain = ?');
  return stmt.get(domain);
}

export function deleteBurpAddress(id) {
  const stmt = db.prepare('DELETE FROM burp_addresses WHERE id = ?');
  return stmt.run(id);
}

export function deleteBurpAddressByDomain(domain) {
  const stmt = db.prepare('DELETE FROM burp_addresses WHERE domain = ?');
  return stmt.run(domain);
}

export function insertBurpMessage(addressId, fromAddress, subject, textContent, htmlContent, attachmentsJson) {
  const stmt = db.prepare('INSERT INTO burp_inbox (address_id, from_address, subject, text_content, html_content, attachments_json) VALUES (?, ?, ?, ?, ?, ?)');
  return stmt.run(addressId, fromAddress, subject, textContent, htmlContent, attachmentsJson);
}

export function getBurpMessages(addressId) {
  const stmt = db.prepare('SELECT * FROM burp_inbox WHERE address_id = ? ORDER BY id DESC');
  return stmt.all(addressId);
}

export default db;
