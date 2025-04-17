const express = require('express');
const nodemailer = require('nodemailer');
require('dotenv').config();

const router = express.Router();

// Mailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// Predefined templates
const templates = {
  internshipReminder: {
    subject: 'Reminder: Submit Your Internship Documents',
    text: 'Hi {{name}},\n\nThis is a reminder to submit your internship documents and details.\n\nRegards,\nInternTrack Team'
  },
  documentMissing: {
    subject: 'Missing Documents',
    text: 'Hi {{name}},\n\nSome of your documents are missing. Please upload them.\n\nBest,\nInternTrack Team'
  },
  performanceFeedback: {
    subject: 'Performance Feedback for Your Internship',
    text: 'Hi {{name}},\n\nwe have reviewed your internship details.keep in track for futher information\n\nBest,\nInternTrack Team'
  }
};

// Send email logic
async function sendReportMail(templateKey, students) {
  if (!templates[templateKey]) {
    throw new Error('Invalid template key');
  }

  const template = templates[templateKey];
  const results = [];

  // Batch email sending to avoid throttling issues (optional)
  const batchSize = 10; // Adjust based on your Gmail limitations
  for (let i = 0; i < students.length; i += batchSize) {
    const batch = students.slice(i, i + batchSize);
    const promises = batch.map(async (student) => {
      const { name, email } = student;
      const personalizedText = template.text.replace('{{name}}', name);

      const mailOptions = {
        from: process.env.MAIL_USER,
        to: email,
        subject: template.subject,
        text: personalizedText
      };

      try {
        await transporter.sendMail(mailOptions);
        results.push({ email, status: 'Sent' });
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        results.push({ email, status: 'Failed', error: error.message });
      }
    });

    // Wait for the current batch to finish before sending the next one
    await Promise.all(promises);
  }

  return results;
}

// POST route to send reports
router.post('/send-report', async (req, res) => {
  const { templateKey, students } = req.body;

  if (!templateKey || !students || students.length === 0) {
    return res.status(400).json({ message: 'Invalid request: templateKey and students are required' });
  }

  try {
    const result = await sendReportMail(templateKey, students);
    res.json({ message: 'Emails sent successfully', result });
  } catch (error) {
    console.error('Error sending mail:', error);
    res.status(500).json({ message: 'Error sending mails', error: error.message });
  }
});

module.exports = router;
