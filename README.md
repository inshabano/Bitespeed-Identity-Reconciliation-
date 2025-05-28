# Bitespeed Backend Task: API for Identity Reconciliation

This project is a backend API for identity reconciliation, developed for the Bitespeed Backend Task. It matches and links contacts based on email and phone numbers, supports soft deletion, and is hosted on Render.com.

## 🧠 Overview

The API intelligently reconciles user identities by:

* Creating a primary contact when a unique email or phone is provided.
* Linking secondary contacts if matches exist.
* Soft-deleting contacts using a `deletedAt` timestamp rather than permanent deletion.

The backend uses **SQLite** for storage and includes automated tests to verify the core identity logic.

## 🚀 Features

* **Identity Reconciliation**
  Link contacts with matching email or phone number.
  **Endpoint:** `POST /identity`

* **Soft Deletion**
  Marks a contact as deleted without removing it from the database.
  **Endpoint:** `DELETE /contact/:id`

* **API Info Endpoint**
  A basic status check with helpful information.
  **Endpoint:** `GET /`

* **Deployment**
  Hosted live on Render.com

## ⚙️ Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/inshabano/Bitespeed-Identity-Reconciliation-.git
cd /identity_recognition_task
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_PATH=./database.sqlite3
PORT=3000
```

### 4. Run the Application Locally

```bash
npm start
```

Visit `http://localhost:3000` to check if the server is running.

### 5. Run Tests

```bash
npm test
```

Tests are located in `test/identity.test.js` and cover:

* `POST /identity`
* `DELETE /contact/:id`

## 📘 API Endpoints

### `GET /`

Returns API information with available endpoints and example usage.

**Example:**

```bash
curl https://bitespeed-identity-reconciliation-l7hk.onrender.com
```

**Response:**

```json
{
  "message": "Welcome to the Bitespeed Identity Reconciliation API!",
  "endpoints": {
    "POST /identity": "Reconcile identities with email and/or phoneNumber",
    "DELETE /contact/:id": "Soft-delete a contact by ID"
  },
  "example": {
    "POST /identity": {
      "url": "https://bitespeed-identity-reconciliation-l7hk.onrender.com/identity",
      "body": { "email": "hello@welcome", "phoneNumber": "1234567890" }
    },
    "DELETE /contact/:id": {
      "url": "https://bitespeed-identity-reconciliation-l7hk.onrender.com/contact/1",
      "method": "DELETE"
    }
  }
}
```

### `POST /identity`

Reconciles identities by email and/or phone number.

**Request Body:**

```json
{
  "email": "hello@email",
  "phoneNumber": "9876543210"
}
```

**Example:**

```bash
curl -X POST https://bitespeed-identity-reconciliation-l7hk.onrender.com/identity \
  -H "Content-Type: application/json" \
  -d '{"email": "hello@welcome.ac", "phoneNumber": "123456"}'
```


### `DELETE /contact/:id`

Soft-deletes a contact by updating the `deletedAt` timestamp.

**Example:**

```bash
curl -X DELETE https://bitespeed-identity-reconciliation-l7hk.onrender.com/contact/2
```


**Verification:**
Deleted contacts are ignored in future identity resolution.

## ☁️ Deployment

* **Base URL:** `https://bitespeed-identity-reconciliation-l7hk.onrender.com`
* **Identity Endpoint:** `https://bitespeed-identity-reconciliation-l7hk.onrender.com/identity`

---

