const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('./config');

class DB {
    constructor() {
        const dbDir = path.dirname(config.db.path);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        this.db = new sqlite3.Database(config.db.path, (err) => {
            if (err) {
                console.error('Error connecting to database:', err);
            } else {
                console.log('Connected to SQLite database.');
                this.init();
            }
        });
    }

    init() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                email_login TEXT,
                password TEXT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                birth_date TEXT,
                phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, () => {
            // Also try to alter the table in case it was already created before we added the column
            this.db.run(`ALTER TABLE accounts ADD COLUMN email_login TEXT`, () => {});
        });
    }

    saveAccount(accountData) {
        return new Promise((resolve, reject) => {
            const { email, emailLogin, password, firstName, lastName, birthDate, phone } = accountData;
            this.db.run(
                `INSERT INTO accounts (email, email_login, password, first_name, last_name, birth_date, phone) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [email, emailLogin, password, firstName, lastName, birthDate, phone],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    getAllAccounts() {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM accounts ORDER BY created_at DESC`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }
}

module.exports = new DB();
