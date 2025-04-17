
# InternTrack - Internship Management System

InternTrack is a simple full-stack application designed to help students and staff manage internship data efficiently. It includes user authentication, document uploads to Google Drive, and data storage via Google Sheets.

---

## 🚀 Features

- 👨‍🎓 Student registration and login
- 👩‍🏫 Staff access with student data filtering
- 📄 Internship data submission form
- 📝 Internship update functionality (update data or files separately)
- 📁 File upload and storage using Google Drive API
- 📊 Data storage using Google Sheets API
- 🔐 Forgot password recovery with security questions

---

## 🛠 Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Storage**: Google Sheets (via API)
- **File Handling**: Google Drive (via API)
- **Auth**: JSON-based local authentication with hashed passwords
- **Other Tools**: `nodemailer`, `multer`, `dotenv`

---

## 📂 Project Structure

```
├── index.js                  # Main server file
├── package.json
├── .env                      # Environment variables (not tracked)
├── apikey.json               # Google Service Account (ignored)
├── users.json                # Stores student credentials (ignored)
├── Internship.csv            # Internship records (ignored)
├── uploads/                  # Uploaded documents (ignored)
├── *.html                    # Frontend pages (login, register, update, etc.)
├── mailer.js                 # Email handler for password recovery
```

---

## ⚙️ Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/your-username/interntrack.git
cd interntrack
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add environment variables

Create a `.env` file:

```
PORT=3000
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password
```
keyFile = Path to your service account key file 

> Note: Never commit real credentials to GitHub.

### 4. Start the server

```bash
node index.js
```

Open your browser and go to `http://localhost:3000`.

---

## 🔒 Security

- Passwords are hashed using `bcryptjs`
- API keys and credentials are kept in `.env` and `.gitignore`d
- Security question/answer setup for password recovery

---

## 📌 To-Do / Future Enhancements

- Add database support (e.g., MongoDB or Firebase)
- Use React or another frontend framework for dynamic UI
- Add role-based access control
- Deploy to Render, Railway, or similar hosting platforms

---
