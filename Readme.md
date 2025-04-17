
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



## 🔐 Google Service Account Setup

This app uses a Google Service Account to access Google Sheets and Google Drive.

### Create a Service Account
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Select or create a project
- Go to **IAM & Admin > Service Accounts**
- Click **Create Service Account**, name it (e.g., `interntrack-service`)
- Assign it the role **Editor**
- After creating, go to **Keys > Add Key > Create New Key (JSON)**

This will download your `credentials.json`.

> ⚠️ Never upload `credentials.json` to GitHub. Store it locally and securely.

---

### Share Your Google Sheet & Drive Folder

Copy the **email address** of the service account, it looks like:

your-service-account@your-project.iam.gserviceaccount.com


- Open your Google Sheet or Drive folder
- Click **Share**
- Paste the service account email
- Set as **Editor**

This allows the backend to read/write Google Sheets and upload files to Drive.

---

### Add environment variables

Create a `.env` file:

```
PORT=3000
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password
ROOT_FOLDER_ID=your root folder id
ROOT_FOLDER_NAME=your root folder name
SheetId=your google sheet id
SheetName=your google sheet name
```
keyFile = Path to your service account key file 

> Note: Never commit real credentials to GitHub.

## 📁 Google Drive & Sheets Configuration

### 🔹 Root Folder (Google Drive)
- This is the folder where all student documents will be organized.
- Create a folder in Google Drive (e.g., `InternTrackDocs`)
- Copy the **folder ID** from the URL:

Example:

https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9 → Root Folder ID = 1A2B3C4D5E6F7G8H9


### 🔹 Google Sheet (Internship Data)
- Create or open a Google Sheet
- Copy the **Sheet ID** from the URL:

Example:

https://docs.google.com/spreadsheets/d/1XyzAbCDEfGHijKLMNopQRsTuvW/edit → Sheet ID = 1XyzAbCDEfGHijKLMNopQRsTuvW


- The **Sheet Name** is the tab name at the bottom (e.g., `Sheet1`)

---

### ✅ Don’t forget:
- **Share the folder and the sheet** with the **Service Account Email**
- Give it **Editor access**


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
