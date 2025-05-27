const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite3');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    throw new Error(`Database connection failed at ${dbPath}`);
  }
  console.log(`Connected to database at ${dbPath}`);
});

// Create contact table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS contact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phoneNumber TEXT,
      email TEXT,
      linkedId INTEGER,
      linkPrecedence TEXT NOT NULL CHECK(linkPrecedence IN ('primary', 'secondary')),
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deletedAt TEXT,
      FOREIGN KEY (linkedId) REFERENCES contact(id)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_contact_email ON contact(email)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_contact_phone ON contact(phoneNumber)`);
});

module.exports = db;