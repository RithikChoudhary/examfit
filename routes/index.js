// routes/index.js
const express = require('express');
const router = express.Router();
const { getQuestions } = require('../utils/dataHelpers');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
router.get('/', async (req, res) => {
  try {
    const data = await getQuestions();
    
    // Handle case where data is empty or invalid
    if (!data || !data.exams || !Array.isArray(data.exams)) {
      console.error('Invalid data structure:', data);
      return res.status(500).send('Invalid data structure');
    }

    res.render('index', { 
      exams: data.exams,
      totalExams: data.exams.length,
      dataInfo: {
        lastUpdated: data.lastUpdated,
        sources: data.sources,
        autoUpdate: data.autoUpdate
      }
    });
  } catch (error) {
    console.error('Error in index route:', error);
    res.status(500).send('An error occurred. Please try again later.');
  }
});
router.get('/contact', (req, res) => {
  res.render('contact');
});

// Handle form submission
router.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  const newQuery = {
    name,
    email,
    message,
    submittedAt: new Date().toISOString()
  };

  const queryFile = path.join(__dirname, '../data/query.json');
  let existing = [];

  if (fs.existsSync(queryFile)) {
    const raw = fs.readFileSync(queryFile, 'utf-8');
    try {
      existing = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse existing queries:", e);
    }
  }

  existing.push(newQuery);
  fs.writeFileSync(queryFile, JSON.stringify(existing, null, 2));

  // ✅ Email sending setup
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'burnt776@gmail.com',       // ✅ your real Gmail address
      pass: 'krgm jznc upvu unup'         // ❗ this must be a Gmail App Password
    }
  });
  
  const mailOptions = {
    from: `"ExamFit Contact Form" <${email}>`,
    to: 'burnt776@gmail.com',           // ✅ you receive the email here
    subject: 'New Contact Query Received',
    text: `
      📩 New Contact Submission
  
      Name: ${name}
      Email: ${email}
      Message:
      ${message}
  
      Sent on: ${newQuery.submittedAt}
    `
  };
  

  try {
    await transporter.sendMail(mailOptions);
    console.log('Contact form email sent!');
  } catch (err) {
    console.error('Error sending contact email:', err);
  }

  res.redirect('/contact');
});
module.exports = router;
