const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// DB setup
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite3');
let db;

try {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Oops! Could not connect to the database:', err.message);
      process.exit(1); // Exit if can't connect to DB
    } else {
      console.log(`Connected to database at ${dbPath}`);
    }
  });
} catch (err) {
  console.error('Failed to connect to DB:', err);
  throw err;
}

// Creating table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS contact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phoneNumber TEXT,
      email TEXT,
      linkedId INTEGER,
      linkPrecedence TEXT NOT NULL CHECK(linkPrecedence IN ('primary', 'secondary')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      deletedAt TEXT,
      FOREIGN KEY (linkedId) REFERENCES contact(id)
    );
  `, (err) => {
    if (err) {
      console.error("Failed to create contact table:", err.message);
    } else {
      console.log("Contact table created or already exists");
    }
  });

  db.run(`
    CREATE INDEX IF NOT EXISTS email_index 
    ON contact(email) 
    WHERE email IS NOT NULL
  `, (err) => {
    if (err) console.error("Email index error:", err.message);
  });

  db.run(`
    CREATE INDEX IF NOT EXISTS phone_index 
    ON contact(phoneNumber) 
    WHERE phoneNumber IS NOT NULL
  `, (err) => {
    if (err) console.error("Phone index error:", err.message);
  });

  db.run(`
    CREATE INDEX IF NOT EXISTS linked_index 
    ON contact(linkedId) 
    WHERE linkedId IS NOT NULL
  `, (err) => {
    if (err) console.error("LinkedId index error:", err.message);
  });
});

db.query = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Query failed:', sql, params);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

module.exports = db;