const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const multer = require('multer');

const app = express();
const PORT = 3000;
const csvFilePath = path.join(__dirname, 'Internship.csv');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true })); // To parse application/x-www-form-urlencoded
const mailerRoutes = require('./mailer');
app.use('/', mailerRoutes);

let students = [];
const users = require('./users.json');

const apikeys = require('./apikey.json');  // Make sure this has the correct path
const SCOPE = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']; // Add both Sheets and Drive scopes


const bcrypt = require('bcrypt');
const USERS_FILE = './users.json';

app.post('/api/register', async (req, res) => {
  const { regNumber, password, confirmPassword, userType, securityQuestion, securityAnswer } = req.body;

  // Basic validations
  if (!userType || !password || !confirmPassword || !securityQuestion || !securityAnswer)
    return res.status(400).json({ success: false, message: 'All fields are required.' });

  if (password !== confirmPassword)
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });

  const users = JSON.parse(fs.readFileSync(USERS_FILE));

  if (userType === 'student') {
    if (!regNumber) return res.status(400).json({ success: false, message: 'Register number is required.' });

    const existingStudent = users.find(u => u.regNumber?.toLowerCase() === regNumber.toLowerCase());
    if (existingStudent)
      return res.status(409).json({ success: false, message: 'Student already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 10); // Normalize and hash

    users.push({
      regNumber,
      password: hashedPassword,
      userType: 'student',
      securityQuestion,
      securityAnswer: hashedAnswer
    });

    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return res.json({ success: true, message: 'Student account created successfully!' });
  }

  // Prevent staff self-registration
  return res.status(400).json({ success: false, message: 'Staff account creation is not allowed.' });
});

// Login route
app.post('/api/login', async (req, res) => {
  const { regNumber, username, password, userType } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  let user;

  if (userType === 'student') {
    // Find student by regNumber
    user = users.find(u =>
      u.regNumber?.toLowerCase() === regNumber?.toLowerCase() &&
      u.userType?.toLowerCase() === userType.toLowerCase()
    );
    // Compare hashed password
    if (user && await bcrypt.compare(password, user.password)) {
      return res.json({ success: true, redirect: 'student.html' });
    }
  } else if (userType === 'staff') {
    // Find staff by username
    user = users.find(u =>
      u.username?.toLowerCase() === username?.toLowerCase() &&
      u.userType?.toLowerCase() === userType.toLowerCase()
    );
    // Compare hashed password
    if (user && await bcrypt.compare(password, user.password)) {
      return res.json({ success: true, redirect: 'staff.html' });
    }
  }

  // If no match found, send error
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

// Step 1: Verify user and security answer
app.post('/api/forgot-password', async (req, res) => {
  const { regNumber, securityQuestion, securityAnswer } = req.body;

  if (!regNumber || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const user = users.find(u => u.regNumber?.toLowerCase() === regNumber.toLowerCase());

  if (!user) {
    return res.status(404).json({ success: false, message: 'Student not found.' });
  }

  // Verify the security question and answer match
  if (user.securityQuestion !== securityQuestion) {
    return res.status(401).json({ success: false, message: 'Security question mismatch.' });
  }

  const match = await bcrypt.compare(securityAnswer.toLowerCase(), user.securityAnswer);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Incorrect security answer.' });
  }

  return res.json({ success: true, message: 'Verification successful.' });
});

// Step 2: Reset password
app.post('/api/reset-password', async (req, res) => {
  const { regNumber, newPassword, confirmPassword } = req.body;

  if (!regNumber || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const userIndex = users.findIndex(u => u.regNumber?.toLowerCase() === regNumber.toLowerCase());

  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: 'Student not found.' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  users[userIndex].password = hashedPassword;

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  return res.json({ success: true, message: 'Password reset successfully!' });
});

const documentFields = [
  'Signed Permission Letter, Offer Letter Submitted',
  'Completion Certificate Submitted',
  'Internship Report Submitted',
  'Student Feedback Submitted',
  'Employer Feedback Submitted'
];

const fixedHeaders = [
  'regNumber',
  'name',
  'mobile',
  'email',
  'section',
  'internship',
  'title',
  'period',
  'startDate',
  'endDate',
  'companyName',
  'placementSource',
  'stipend',
  'internshipType',
  'abroadIndia',
  ...documentFields,
  'year',
  'department'
];

// GoogleAuth initialization for both Sheets and Drive
const auth = new GoogleAuth({
  keyFile: 'apikey.json',  // Path to your service account key file
  scopes: SCOPE  // Both Google Sheets and Google Drive scopes
});

// Initialize the Google Sheets API client
const sheets = google.sheets({ version: 'v4', auth });

// Initialize the Google Drive API client
let drive;

// Step 2: Initialize Google Drive Client
async function initializeDrive() {
  const authClient = await auth.getClient();  // Use getClient() to authenticate
  drive = google.drive({ version: 'v3', auth: authClient });
  console.log('Google Drive API client initialized');
}

// Initialize Google Drive on server start
initializeDrive().catch(err => console.error('Failed to initialize Google Drive client:', err));

app.use((req, res, next) => {
  if (!drive) {
    return res.status(500).json({ message: 'Google Drive API client is not initialized yet.' });
  }
  next();
});

// Google Sheets configurations
const sheetId = '1KWimNLAkpyBt3Ilr4DGpM7apk-x2DUCZHUJhsT7PjDc';
const sheetName = 'Sheet1';  // Adjust if needed

// Fetch all student data from the Google Sheet
async function getSheetData() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: sheetName,
  });

  const [headers, ...rows] = res.data.values;
  return rows.map(row => {
    const student = {};
    headers.forEach((h, i) => {
      student[h] = row[i] || '';
    });
    return student;
  });
}

// ✅ Append student to Google Sheet
async function appendStudent(studentObj) {
  try {
    validateRow(studentObj);
    const mappedRow = mapRowToArray(studentObj);

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [mappedRow] },
    });

    console.log('✅ Row successfully appended');
  } catch (error) {
    console.error('❌ Failed to append student data:', error);
    throw error; // rethrow for route error handling
  }
}

async function updateSheetData(students) {
  try {
    const updatedRows = students.map(mapRowToArray);
    console.log("🔄 Updating sheet with rows:", updatedRows);

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [fixedHeaders, ...updatedRows],
      },
    });

    console.log("✅ Sheet updated successfully");
  } catch (err) {
    console.error("❌ Failed to update sheet data:", err);
    throw err;
  }
}


async function deleteStudentFolderFromSheet(students) {
  try {
    const updatedRows = students.map(mapRowToArray);

    // First clear the sheet
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: sheetName,
    });

    // Then write new data
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [fixedHeaders, ...updatedRows],
      },
    });

    console.log("✅ Sheet updated successfully");
  } catch (err) {
    console.error("❌ Failed to update sheet data:", err);
    throw err;
  }
}


// ✅ Map object to array in the same order as fixedHeaders
function mapRowToArray(obj) {
  return fixedHeaders.map(header => {
    if (header === 'mobile') {
      return `'${obj[header] || ''}`; // Format mobile as text in Sheets
    }
    return obj[header] || '';
  });
}



// ✅ Validate the presence of required fields in an object
function validateRow(obj) {
  const missingFields = fixedHeaders.filter(header => obj[header] === undefined || obj[header].toString().trim() === '');

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
}
// ✅ Express route
app.post('/add-student', async (req, res) => {
  try {
    const newStudent = req.body;

    if (!newStudent.regNumber || newStudent.regNumber.trim() === '') {
      return res.status(400).json({ message: 'Register number is required' });
    }

    const allStudents = await getSheetData();
    const exists = allStudents.some(s => s.regNumber === newStudent.regNumber);
    if (exists) {
      return res.status(409).json({ message: 'Student already exists' });
    }

    // Normalize document fields to "Yes" or "No"
    documentFields.forEach(field => {
      newStudent[field] = newStudent[field] === "Yes" ? "Yes" : "No";
    });

    await appendStudent(newStudent);
    res.status(200).json({ message: 'Student added successfully' });
  } catch (error) {
    res.status(500).send(`Error adding student data: ${error.message}`);
  }
});


// Example route to test updating data
app.post('/updateStudents', async (req, res) => {
  try {
    const allStudentData = req.body;  // Get all student data from request
    await updateSheetData(allStudentData);
    res.status(200).send('Sheet data updated successfully');
  } catch (error) {
    res.status(500).send('Error updating sheet data');
  }
});

module.exports = { getSheetData, appendStudent, updateSheetData };


// Middleware for parsing JSON data from the body (for non-file data)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Step 1: Store files temporarily first
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempPath = path.join(__dirname, 'uploads', 'temp');
    if (!fs.existsSync(tempPath)) {
      fs.mkdirSync(tempPath, { recursive: true });
    }
    cb(null, tempPath);
  },
  filename: (req, file, cb) => {
    const extname = path.extname(file.originalname);
    const filename = `${file.fieldname}_${Date.now()}${extname}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: tempStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
}).fields([
  { name: 'offerLetter', maxCount: 1 },
  { name: 'permissionLetter', maxCount: 1 },
  { name: 'completionCertificate', maxCount: 1 },
  { name: 'internshipReport', maxCount: 1 },
  { name: 'studentFeedback', maxCount: 1 }
]);

const ROOT_FOLDER_NAME = 'Drive Api'; // This is just for readability
const ROOT_FOLDER_ID = "1hgPPRDgNEL5B2-fEY8I2CCN52R7ETQvm"; // Outer root ID

async function deleteStudentFolderFromDrive(regNumber, name, year) {
  try {
    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Step 1: Get the inner 'Drive Api' folder inside ROOT_FOLDER_ID
    const innerDriveApiList = await drive.files.list({
      q: `name = 'Drive Api' and mimeType = 'application/vnd.google-apps.folder' and '${ROOT_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name)',
    });

    if (innerDriveApiList.data.files.length === 0) {
      console.log("❌ Inner 'Drive Api' folder not found inside root folder.");
      return;
    }

    const innerDriveApiFolderId = innerDriveApiList.data.files[0].id;
    console.log(`📁 Found 'Drive Api' folder with ID: ${innerDriveApiFolderId}`);

    // Step 2: Find the year folder inside the inner 'Drive Api'
    const yearFolderList = await drive.files.list({
      q: `name = '${year}' and mimeType = 'application/vnd.google-apps.folder' and '${innerDriveApiFolderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
    });

    if (yearFolderList.data.files.length === 0) {
      console.log(`❌ Year folder '${year}' not found under 'Drive Api'.`);
      return;
    }

    const yearFolderId = yearFolderList.data.files[0].id;
    console.log(`📁 Found year folder '${year}' with ID: ${yearFolderId}`);

    // Step 3: Find student folder where name starts with regNumber
    const studentFolderList = await drive.files.list({
      q: `name contains '${regNumber}_' and mimeType = 'application/vnd.google-apps.folder' and '${yearFolderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
    });

    if (studentFolderList.data.files.length === 0) {
      console.log(`❌ Student folder not found for regNumber ${regNumber} under year ${year}.`);
      return;
    }

    const studentFolder = studentFolderList.data.files[0];
    console.log(`🗑️ Deleting Drive folder: ${studentFolder.name} (${studentFolder.id})`);

    await drive.files.delete({ fileId: studentFolder.id });

    console.log("✅ Student folder deleted successfully from Google Drive.");
  } catch (err) {
    console.error("❌ Failed to delete student folder from Google Drive:", err);
  }
}


// Step 3: Find or Create Folder Function
async function findOrCreateFolder(authClient, folderName, parentId = ROOT_FOLDER_ID) {
  const drive = google.drive({ version: 'v3', auth: authClient });

  const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  console.log(`Folder search result for "${folderName}":`, response.data.files); // Debug log

  if (response.data.files.length > 0) {
    console.log(`Folder found: ${response.data.files[0].id}`); // Debug log
    return response.data.files[0].id;
  } else {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId], // Parent folder ID
    };

    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });

    console.log(`Folder created with ID: ${folder.data.id}`); // Debug log
    return folder.data.id;
  }
}

// Step 4: Create Student Folder in Drive
async function createGoogleDriveFolder(authClient, year, regNumber, name) {
  const drive = google.drive({ version: 'v3', auth: authClient });

  // Step 1: Create or Find "Drive API" folder in Google Drive (using ROOT_FOLDER_ID)
  const rootFolderId = await findOrCreateFolder(authClient, ROOT_FOLDER_NAME, ROOT_FOLDER_ID);

  // Step 2: Create or Find Year folder (e.g., "2025") under "Drive API" folder
  const yearFolderId = await findOrCreateFolder(authClient, year.toString(), rootFolderId);

  // Step 3: Create or Find Student folder under Year folder (e.g., "2210019_Pravin M")
  const studentFolderName = `${regNumber}_${name}`;
  const studentFolderId = await findOrCreateFolder(authClient, studentFolderName, yearFolderId);

  // (Optional) Step 4: Share student folder with your main Google account (if needed)
  try {
    await drive.permissions.create({
      fileId: studentFolderId,
      sendNotificationEmail: false,
      requestBody: {
        role: 'writer',
        type: 'user',
        emailAddress: 'pravin2210019@ssn.edu.in',
      },
    });
    console.log(`✅ Google Drive Folder Created: https://drive.google.com/drive/folders/${studentFolderId}`);
  } catch (err) {
    console.warn(`⚠️ Sharing failed: ${err.message}`);
    // DON'T throw – allow the rest of the process to continue
  }

  return studentFolderId;
}



// Step 4: Upload file to Google Drive
async function uploadFileToDrive(authClient, localPath, folderId, fileName) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const fileMetadata = {
    name: fileName,
    parents: [folderId], // Ensure the file goes into the correct folder
  };

  const media = {
    mimeType: 'application/octet-stream',
    body: fs.createReadStream(localPath),
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, webViewLink',
  });

  try {
    await drive.permissions.create({
      fileId: file.data.id,
      sendNotificationEmail: false,
      requestBody: {
        type: 'user',
        role: 'reader',
        emailAddress: 'pravin2210019@ssn.edu.in',
      },
    });
    console.log(`✅ File shared with pravin2210019@ssn.edu.in`);
  } catch (error) {
    console.warn(`⚠️ File sharing skipped: ${error.errors?.[0]?.message || error.message}`);
  }
  
  return file.data.id;
}


// Step 5: POST route for uploading files
app.post('/upload', upload, async (req, res) => {
  try {
    const { regNumber, name, year } = req.body;
    if (!regNumber || !name || !year) {
      return res.status(400).send('Missing regNumber, name, or year');
    }

    const studentPath = path.join(__dirname, 'uploads', year, regNumber);
    if (!fs.existsSync(studentPath)) {
      fs.mkdirSync(studentPath, { recursive: true });
    }
    const authClient = await auth.getClient(); 
    const studentFolderId = await createGoogleDriveFolder(authClient, year, regNumber, name);

    const files = req.files;
    for (let field in files) {
      for (let i = 0; i < files[field].length; i++) {
        const tempFile = files[field][i];
        const originalName = tempFile.originalname;
        const newPath = path.join(studentPath, tempFile.filename);

        // Move file from temp to final destination
        fs.renameSync(tempFile.path, newPath);

        // Upload to Google Drive
        await uploadFileToDrive(authClient, newPath, studentFolderId, originalName);

        // Optionally delete from local after upload
        // fs.unlinkSync(newPath);
      }
    }

    res.status(200).send("Student data and files uploaded successfully to Google Drive!");
  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).send('Internal server error.');
  }
});


app.get('/get-documents/:regNumber', async (req, res) => {
  const regNumber = req.params.regNumber;

  try {
    // 1. Search for folders starting with regNumber
    const folderList = await drive.files.list({
      q: `name contains '${regNumber}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
    });

    // No folder found for the given regNumber
    if (folderList.data.files.length === 0) {
      return res.json([]); // Return empty array if no folder found
    }

    // Use the first folder found (or handle multiple if needed)
    const folderId = folderList.data.files[0].id;

    // 2. List all files in that folder
    const fileList = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, webViewLink)', // Include webViewLink in the response
    });
    
    
    console.log('Files in folder:', fileList.data.files);
    // Check if there are files in the folder
    if (fileList.data.files.length === 0) {
      return res.json([]); // No files found in the folder
    }

    // Return the list of files with their name and webViewLink
    res.json(fileList.data.files.map(file => ({
      name: file.name,
      webViewLink: file.webViewLink, // Provides a direct link to view the file
    })));
  } catch (err) {
    console.error('Error fetching documents:', err.message);
    res.status(500).json({ error: 'Something went wrong while fetching documents.' });
  }
});


// ✅ Delete Route
app.delete('/delete-student/:regNumber', async (req, res) => {
  const regNumber = req.params.regNumber?.trim();
  try {
    const allStudents = await getSheetData();
    const studentIndex = allStudents.findIndex(s => s.regNumber === regNumber);
    if (studentIndex === -1) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const studentToDelete = allStudents[studentIndex];
    const updatedStudents = allStudents.filter(s => s.regNumber !== regNumber);
    console.log("🔍 Rows going into sheet:", updatedStudents);

    await deleteStudentFolderFromSheet(updatedStudents);
    await deleteStudentFolderFromDrive(regNumber, studentToDelete.name, studentToDelete.year);

    res.json({ success: true, message: 'Student deleted from Google Sheet and Drive (if folder existed).' });
  } catch (error) {
    console.error('❌ Error deleting student:', error.message);
    res.status(500).json({ success: false, message: 'Error deleting student.' });
  }
});





app.put('/update', upload, async (req, res) => {
  try {
    const { regNumber, name, year } = req.body;

    if (!regNumber || !name || !year) {
      return res.status(400).send('Missing regNumber, name, or year');
    }

    const studentPath = path.join(__dirname, 'uploads', year, regNumber);
    if (!fs.existsSync(studentPath)) {
      fs.mkdirSync(studentPath, { recursive: true });
    }

    const authClient = await authorize();

    // STEP 1: Locate existing student folder
    const studentFolderName = `${regNumber}_${name}`;
    const yearFolderId = await findOrCreateFolder(authClient, year.toString(), ROOT_FOLDER_ID);
    const studentFolderId = await findOrCreateFolder(authClient, studentFolderName, yearFolderId);
    const drive = google.drive({ version: 'v3', auth: authClient });

    // STEP 2: List all existing files in student folder and delete them
    const existingFiles = await drive.files.list({
      q: `'${studentFolderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
    });

    for (const file of existingFiles.data.files) {
      await drive.files.delete({ fileId: file.id });
      console.log(`🗑️ Deleted old file from Drive: ${file.name}`);
    }

    // STEP 3: Upload new files
    const files = req.files;
    for (let field in files) {
      for (let i = 0; i < files[field].length; i++) {
        const tempFile = files[field][i];
        const originalName = tempFile.originalname;
        const newPath = path.join(studentPath, tempFile.filename);

        fs.renameSync(tempFile.path, newPath);

        await uploadFileToDrive(authClient, newPath, studentFolderId, originalName);

        // Optional: delete from local
        // fs.unlinkSync(newPath);
      }
    }

    // STEP 4: Update CSV record
    const studentIndex = students.findIndex(s => s.regNumber === regNumber);
    if (studentIndex === -1) {
      return res.status(404).json({ success: false, message: 'Student not found in CSV' });
    }

    students[studentIndex] = { regNumber, name, year };

    const writer = createObjectCsvWriter({
      path: csvFilePath,
      header: fixedHeaders.map(h => ({ id: h, title: h })),
    });

    await writer.writeRecords(students);

    res.status(200).send('✅ Student files updated successfully on Google Drive and CSV.');
  } catch (error) {
    console.error('❌ Error during update:', error);
    res.status(500).send('Internal server error during update.');
  }
});

app.put('/update-files/:regNumber', upload, async (req, res) => {
  try {
    const { regNumber } = req.params;
    const { name, year } = req.body;

    if (!regNumber || !name || !year) {
      return res.status(400).json({ message: 'Missing regNumber, name, or year' });
    }

    const studentPath = path.join(__dirname, 'uploads', year, regNumber);
    if (!fs.existsSync(studentPath)) {
      fs.mkdirSync(studentPath, { recursive: true });
    }

    const authClient = await auth.getClient();  // Get the authClient

    // 🔍 Step 1: Find the correct "Drive API" inner folder under ROOT_FOLDER_ID
    const innerDriveApiFolder = await findOrCreateFolder(authClient, 'Drive Api', ROOT_FOLDER_ID);

    // 📁 Step 2: Find or create the year folder inside the correct "Drive API" folder
    const yearFolderId = await findOrCreateFolder(authClient, year.toString(), innerDriveApiFolder);

    // 📁 Step 3: Find or create student folder inside year folder
    const studentFolderName = `${regNumber}_${name}`;
    const studentFolderId = await findOrCreateFolder(authClient, studentFolderName, yearFolderId);

    // 🗑️ Step 4: Delete existing files from student folder
    const existingFiles = await drive.files.list({
      q: `'${studentFolderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
    });

    for (const file of existingFiles.data.files) {
      await drive.files.delete({ fileId: file.id });
      console.log(`🗑️ Deleted old file from Drive: ${file.name}`);
    }

    // 📤 Step 5: Upload new files
    const files = req.files;
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    for (const field in files) {
      for (const file of files[field]) {
        const originalName = file.originalname;
        const newPath = path.join(studentPath, originalName);

        fs.renameSync(file.path, newPath); // Move file to permanent location
        await uploadFileToDrive(authClient, newPath, studentFolderId, originalName); // Pass authClient here
      }
    }

    res.status(200).json({ message: '✅ Student files updated successfully on Google Drive!' });

  } catch (error) {
    console.error('❌ Error during file update:', error);
    res.status(500).json({ message: 'Internal server error during file update.' });
  }
});


/*
// 🔃 Read and parse CSV
fs.createReadStream(csvFilePath)
  .pipe(csv({
    mapHeaders: ({ header }) => header.trim()
  }))
  .on('data', (row) => {
    // Ensure all document fields exist, default to "No" if missing
    documentFields.forEach(field => {
      if (!(field in row)) {
        row[field] = "No";
      }
    });
    students.push(row);
  })
  .on('end', () => {
    console.log('✅ CSV file successfully processed');
    console.log('📋 Sample student:', students[0]);
  })
  .on('error', (err) => {
    console.error('❌ Error reading CSV:', err.message);
  });*/

/* Login route
app.post('/api/login', (req, res) => {
  const { regNumber, username, password, userType } = req.body;
  let user;

  if (userType === 'student') {
    user = users.find(u =>
      u.regNumber?.toLowerCase() === regNumber?.toLowerCase() &&
      u.password === password &&
      u.userType?.toLowerCase() === userType.toLowerCase()
    );
  } else {
    user = users.find(u =>
      u.username?.toLowerCase() === username?.toLowerCase() &&
      u.password === password &&
      u.userType?.toLowerCase() === userType.toLowerCase()
    );
  }

  if (user) {
    res.json({ success: true, redirect: `${userType}.html` });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});
*/
// Get all student data
app.get('/students', async (req, res) => {
  try {
    const studentsFromSheet = await getSheetData(); // Fetch data from Google Sheets
    res.json(studentsFromSheet);  // Send the student data as response
  } catch (err) {
    console.error("Error fetching data from Google Sheets: ", err);
    res.status(500).json({ message: 'Error fetching student data from Google Sheets' });
  }
});


// Add student
app.post('/add-student', async (req, res) => {
  const newStudent = req.body;

  if (!newStudent.regNumber || newStudent.regNumber.trim() === "") {
    return res.status(400).json({ message: 'Register number is required' });
  }

  const allStudents = await getSheetData();
  const exists = allStudents.some(s => s.regNumber === newStudent.regNumber);
  if (exists) {
    return res.status(409).json({ message: 'Student already exists' });
  }

  documentFields.forEach(field => {
    newStudent[field] = newStudent[field] === "Yes" ? "Yes" : "No";
  });

  const cleanStudent = fixedHeaders.map(h => newStudent[h] || '');
  await appendStudent(cleanStudent);
  res.json({ message: 'Student added successfully' });
});


app.post('/update-student', async (req, res) => {
  const updatedStudent = req.body;
  const userRegNumber = updatedStudent.regNumber;

  if (!userRegNumber || userRegNumber.trim() === "") {
    return res.status(400).json({ message: 'Register number is required' });
  }

  const allStudents = await getSheetData();
  const existing = allStudents.find(s => s.regNumber === userRegNumber);
  if (!existing) {
    return res.status(404).json({ message: 'Student record not found' });
  }

  // Normalize document fields
  documentFields.forEach(field => {
    updatedStudent[field] = updatedStudent[field] === "Yes" ? "Yes" : "No";
  });

  // Ensure all the fixed headers are in the updated student object
  const cleanStudent = fixedHeaders.map(h => updatedStudent[h] || '');

  // Update the student in the list
  const updatedList = allStudents.map(s =>
    s.regNumber === userRegNumber ? cleanStudent : s
  );

  // Update the Google Sheet with the new data
  await updateSheetData(updatedList);

  res.json({ message: 'Student data updated successfully' });
});

// Get single student
app.get('/student/:regNumber', async (req, res) => {
  const regNumber = req.params.regNumber?.trim();
  const students = await getSheetData();

  const student = students.find(s => s.regNumber === regNumber);

  if (student) {
    res.json(student);
  } else {
    res.status(404).json({ message: 'Student not found' });
  }
});


app.put('/students/:regNumber', async (req, res) => {
  const regNumber = req.params.regNumber;
  const updatedStudent = req.body;

  console.log("Received student data for update: ", updatedStudent);  // Log received data

  try {
    // Fetch all students from Google Sheets
    let allStudents = await getSheetData();

    // Find the student by regNumber
    const index = allStudents.findIndex(s => s.regNumber === regNumber);
    if (index === -1) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Normalize document fields if they are not present
    documentFields.forEach(field => {
      if (!(field in updatedStudent)) {
        updatedStudent[field] = "Yes";  // Assign default value if not provided
      }
    });

    // Normalize abroadIndia field if it exists
    if (updatedStudent.abroadIndia) {
      updatedStudent.abroadIndia = updatedStudent.abroadIndia.toLowerCase() === "abroad" ? "abroad" : "india";
    }

    // Ensure all fixed headers are in the updated student object
    const cleanStudent = {};
    fixedHeaders.forEach(h => {
      cleanStudent[h] = updatedStudent[h] || '';  // Default to empty string if no value
    });

    // Update the student in the array
    allStudents[index] = cleanStudent;

    // Update the Google Sheet with the new data
    await updateSheetData(allStudents);

    console.log("Student updated successfully");
    res.json({ message: 'Student updated successfully' });
  } catch (err) {
    console.log("Error updating student: ", err);
    res.status(500).json({ message: 'Error updating student data' });
  }
});


app.put('/update-student', async (req, res) => {
  const updatedStudent = req.body;
  const userRegNumber = updatedStudent.regNumber;

  if (!userRegNumber || userRegNumber.trim() === "") {
    return res.status(400).json({ message: 'Register number is required' });
  }

  try {
    // Fetch all students from Google Sheets
    let allStudents = await getSheetData();

    const existing = allStudents.find(s => s.regNumber === userRegNumber);
    if (!existing) {
      return res.status(404).json({ message: 'Student record not found' });
    }

    // Normalize abroadIndia field if it exists
    if (updatedStudent.abroadIndia) {
      updatedStudent.abroadIndia = updatedStudent.abroadIndia.toLowerCase() === "abroad" ? "abroad" : "india";
    }

    // Preserve document fields by checking if they're in the request
    documentFields.forEach(field => {
      if (field in updatedStudent) {
        updatedStudent[field] = updatedStudent[field] === "Yes" ? "Yes" : "No"; // Ensuring the value is "Yes" or "No"
      } else {
        updatedStudent[field] = existing[field] || "No"; // Retain old value if not updated
      }
    });

    // Prepare updated student data
    const cleanStudent = {};
    fixedHeaders.forEach(h => {
      cleanStudent[h] = (h in updatedStudent) ? updatedStudent[h] : (documentFields.includes(h) ? "No" : '');
    });

    // Update the student in the list
    const updatedList = allStudents.map(s =>
      s.regNumber === userRegNumber ? cleanStudent : s
    );

    // Update the Google Sheet with the new data
    await updateSheetData(updatedList);

    console.log("✅ Google Sheets updated successfully for:", userRegNumber);
    res.json({ message: 'Student data updated successfully' });
  } catch (err) {
    console.error("❌ Google Sheets Write Error:", err.message);
    res.status(500).json({ message: "Internal server error while updating student data" });
  }
});

async function loadStudentsFromSheet() {
  try {
    const authClient = await auth.getClient();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: sheetName,
    });

    const rows = result.data.values;

    if (rows.length) {
      const headers = rows[0];
      students = rows.slice(1).map(row => {
        const student = {};
        headers.forEach((header, i) => {
          student[header] = row[i] || '';
        });
        return student;
      });

      console.log('✅ Google Sheets data loaded successfully');
      console.log('📋 Sample student:', students[0]);
    } else {
      console.log('⚠️ Google Sheet is empty');
    }
  } catch (err) {
    console.error('❌ Failed to fetch data from Google Sheets:', err);
  }
}

loadStudentsFromSheet(); // Call this when the server starts

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
