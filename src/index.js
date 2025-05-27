const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());
app.get('/contacts', async (req, res) => {
  try {
    const runQuery = (query, params) => new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const contacts = await runQuery('SELECT * FROM contact WHERE deletedAt IS NULL', []);
    res.json(contacts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/identity', async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'At least one of email or phoneNumber is required' });
  }

  const runQuery = (query, params) => {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  const runExec = (query, params) => {
    return new Promise((resolve, reject) => {
      db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  };

  try {
    await runExec('BEGIN TRANSACTION');

    const query = `
      SELECT * FROM contact
      WHERE (email = ? OR phoneNumber = ?) AND deletedAt IS NULL
    `;
    const existingContacts = await runQuery(query, [email || null, phoneNumber || null]);

    let primaryContact = null;
    let newContactId = null;

    if (existingContacts.length === 0) {
      const insert = `
        INSERT INTO contact (phoneNumber, email, linkPrecedence, createdAt, updatedAt)
        VALUES (?, ?, 'primary', datetime('now', 'localtime'), datetime('now', 'localtime'))
      `;
      newContactId = await runExec(insert, [phoneNumber || null, email || null]);
      primaryContact = { id: newContactId, email, phoneNumber, linkPrecedence: 'primary' };
    } else {
      primaryContact = existingContacts.reduce((oldest, contact) => {
        if (contact.linkPrecedence === 'primary' && (!oldest || contact.createdAt < oldest.createdAt)) {
          return contact;
        }
        return oldest;
      }, null);

      const hasNewInfo = !existingContacts.some(
        c => (c.email === email || (!email && !c.email)) && (c.phoneNumber === phoneNumber || (!phoneNumber && !c.phoneNumber))
      );

      if (hasNewInfo) {
        const insert = `
          INSERT INTO contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt)
          VALUES (?, ?, ?, 'secondary', datetime('now', 'localtime'), datetime('now', 'localtime'))
        `;
        newContactId = await runExec(insert, [phoneNumber || null, email || null, primaryContact.id]);
      }

      const primaryContacts = existingContacts.filter(c => c.linkPrecedence === 'primary');
      if (primaryContacts.length > 1) {
        primaryContacts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        primaryContact = primaryContacts[0];

        for (let i = 1; i < primaryContacts.length; i++) {
          const update = `
            UPDATE contact
            SET linkPrecedence = 'secondary', linkedId = ?, updatedAt = datetime('now', 'localtime')
            WHERE id = ?
          `;
          await runExec(update, [primaryContact.id, primaryContacts[i].id]);
        }
      }
    }

    const linkedContacts = await runQuery(
      `SELECT * FROM contact WHERE (id = ? OR linkedId = ?) AND deletedAt IS NULL`,
      [primaryContact.id, primaryContact.id]
    );

    const emails = [...new Set(linkedContacts.map(c => c.email).filter(e => e))];
    const phoneNumbers = [...new Set(linkedContacts.map(c => c.phoneNumber).filter(p => p))];
    const secondaryContactIds = linkedContacts
      .filter(c => c.linkPrecedence === 'secondary')
      .map(c => c.id);

    // Ensure primary email/phone is first
    if (primaryContact.email && emails[0] !== primaryContact.email) {
      emails.splice(emails.indexOf(primaryContact.email), 1);
      emails.unshift(primaryContact.email);
    }
    if (primaryContact.phoneNumber && phoneNumbers[0] !== primaryContact.phoneNumber) {
      phoneNumbers.splice(phoneNumbers.indexOf(primaryContact.phoneNumber), 1);
      phoneNumbers.unshift(primaryContact.phoneNumber);
    }

    await runExec('COMMIT');

    res.json({
      contact: {
        primaryContactId: primaryContact.id,
        emails,
        phoneNumbers,
        secondaryContactIds
      }
    });
  } catch (error) {
    console.error(error);
    await runExec('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});