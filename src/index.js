const express = require('express');
const getDb = require('./db');
require('dotenv').config();

(async () => {
  let db;
  try {
    db = await getDb;
  } catch (err) {
    console.error("Failed to initialize database in index.js:", err.message);
    process.exit(1);
  }
  const app = express();
  app.use(express.json());

  app.get('/', (req, res) => {
    res.status(200).json({
      message: "Welcome to Bitespeed Identity Reconciliation API",
      endpoints: {
        "POST /identity": "Reconcile identities with email and/or phone number",
        "DELETE /contact/:id": "Soft-delete a contact by ID"
      },
      example: {
        "POST /identity": {
          url: "https://bitespeed-identity-reconciliation-l7hk.onrender.com/identity",
          body: { email: "hello@email", phoneNumber: "123456789" }
        },
        "DELETE /contact/:id": {
          url: "https://bitespeed-identity-reconciliation-l7hk.onrender.com/contact/1",
          method: "DELETE"
        }
      }
    });
  });

  app.post('/identity', async (req, res) => {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ 
        error: "Enter either an email or phone number" 
      });
    }

    const execute = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) {
            console.error("Execute failed:", sql, err);
            reject(new Error(err.message));
          } else {
            resolve(this.lastID);
          }
        });
      });
    };

    try {
      await execute("BEGIN");

      const existingContacts = await db.query(
        `SELECT * FROM contact 
        WHERE (email = ? OR phoneNumber = ?) 
        AND deletedAt IS NULL`,
        [email || null, phoneNumber || null]
      );

      let primaryContact = null;
      let newContactId = null;

      if (existingContacts.length === 0) {
        newContactId = await execute(
          `INSERT INTO contact (phoneNumber, email, linkPrecedence) 
          VALUES (?, ?, 'primary')`,
          [phoneNumber || null, email || null]
        );
        
        primaryContact = {
          id: newContactId,
          phoneNumber,
          email,
          linkPrecedence: 'primary'
        };
      } else {
        primaryContact = existingContacts.reduce((primary, contact) => {
          if (contact.linkPrecedence === 'primary') {
            if (!primary || new Date(contact.createdAt) < new Date(primary.createdAt)) {
              return contact;
            }
          }
          return primary;
        }, null);

        const hasNewEmail = email && !existingContacts.some(c => c.email === email);
        const hasNewPhone = phoneNumber && !existingContacts.some(c => c.phoneNumber === phoneNumber);

        if (hasNewEmail || hasNewPhone) {
          newContactId = await execute(
            `INSERT INTO contact 
            (phoneNumber, email, linkedId, linkPrecedence) 
            VALUES (?, ?, ?, 'secondary')`,
            [phoneNumber || null, email || null, primaryContact.id]
          );
        }

        const primaryContacts = existingContacts.filter(c => c.linkPrecedence === 'primary');
        if (primaryContacts.length > 1) {
          primaryContacts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          for (let i = 1; i < primaryContacts.length; i++) {
            await execute(
              `UPDATE contact 
              SET linkPrecedence = 'secondary', 
                  linkedId = ?, 
                  updatedAt = CURRENT_TIMESTAMP
              WHERE id = ?`,
              [primaryContacts[0].id, primaryContacts[i].id]
            );
          }
          primaryContact = primaryContacts[0];
        }
      }

      const linkedContacts = await db.query(
        `SELECT * FROM contact 
        WHERE (id = ? OR linkedId = ?) 
        AND deletedAt IS NULL`,
        [primaryContact.id, primaryContact.id]
      );

      const emails = [];
      const phoneNumbers = [];
      const secondaryContactIds = [];

      linkedContacts.forEach(contact => {
        if (contact.linkPrecedence === 'primary') {
          if (contact.email) emails.unshift(contact.email);
          if (contact.phoneNumber) phoneNumbers.unshift(contact.phoneNumber);
        } else {
          secondaryContactIds.push(contact.id);
          if (contact.email) emails.push(contact.email);
          if (contact.phoneNumber) phoneNumbers.push(contact.phoneNumber);
        }
      });

      await execute("COMMIT");

      res.json({
        contact: {
          primaryContactId: primaryContact.id,
          emails: [...new Set(emails)],
          phoneNumbers: [...new Set(phoneNumbers)],
          secondaryContactIds
        }
      });

    } catch (error) {
      await execute("ROLLBACK").catch(rollbackErr => {
        console.error("Rollback failed", rollbackErr);
      });
      
      console.error("Error handling request:", error.message);
      res.status(500).json({ error: "Something went wrong on our end." });
    }
  });
  app.delete('/contact/:id', async (req, res) => {
    const { id } = req.params;

    const execute = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) {
            console.error("Execute failed:", sql, err);
            reject(new Error(err.message));
          } else {
            resolve(this.changes);
          }
        });
      });
    };

    try {
      const contact = await db.query(
        `SELECT * FROM contact WHERE id = ? AND deletedAt IS NULL`,
        [id]
      );

      if (contact.length === 0) {
        return res.status(404).json({ error: "Contact not found" });
      }

      await execute(
        `UPDATE contact 
        SET deletedAt = datetime('now'), 
            updatedAt = datetime('now') 
        WHERE id = ?`,
        [id]
      );

      res.status(200).json({ message: `Contact with id ${id} has been soft-deleted` });
    } catch (error) {
      console.error("Error soft-deleting:", error.message);
      res.status(500).json({ error: "Failed soft-delete" });
    }
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
    console.log(`Try sending a POST to http://localhost:${port}/identity`);
  }).on('error', (err) => {
    console.error("Server crashed on startup:", err.message);
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    console.error("Something unexpected happened:", err.message);
  });

  process.on('unhandledRejection', (err) => {
    console.error("promise rejected but not caught:", err).message;
  });

  module.exports = app;
})();