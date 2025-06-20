// routes/index.js
const express = require('express');
const router = express.Router();
const examService = require('../services/examService');
const cacheService = require('../services/cacheService');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

router.get('/', async (req, res) => {
  try {
    // Get exams using optimized service
    const exams = await examService.getAllExams();
    
    // Handle case where data is empty or invalid
    if (!exams || !Array.isArray(exams)) {
      console.error('Invalid exams data:', exams);
      return res.status(500).send('Invalid data structure');
    }

    // Preload subjects for all exams in background for instant access
    setImmediate(async () => {
      try {
        await preloadExamSubjects(exams);
      } catch (error) {
        console.warn('Background preloading failed:', error.message);
      }
    });

    // Get data info from cache or default
    const dataInfo = getDataInfo();

    res.render('index', { 
      exams,
      totalExams: exams.length,
      dataInfo
    });
  } catch (error) {
    console.error('Error in index route:', error);
    res.status(500).send('An error occurred. Please try again later.');
  }
});

// Preload subjects for all exams to ensure instant loading
async function preloadExamSubjects(exams) {
  const preloadPromises = exams.map(async (exam) => {
    try {
      // Preload subjects for this exam
      await examService.getExamSubjects(exam.examId);
      console.log(`Preloaded subjects for ${exam.examId}`);
    } catch (error) {
      console.warn(`Failed to preload subjects for ${exam.examId}:`, error.message);
    }
  });

  // Execute all preloading in parallel
  await Promise.allSettled(preloadPromises);
  console.log('Subject preloading completed');
}

// Get data info with fallback
function getDataInfo() {
  try {
    const { getQuestions } = require('../utils/dataHelpers');
    // Try to get data info from cache or file
    const cached = cacheService.get('data_info');
    if (cached) {
      return cached;
    }

    // Fallback to default info
    const defaultInfo = {
      lastUpdated: new Date().toISOString(),
      sources: ['Manual Upload', 'API Integration'],
      autoUpdate: true
    };

    cacheService.set('data_info', defaultInfo, 60 * 60 * 1000); // Cache for 1 hour
    return defaultInfo;
  } catch (error) {
    console.warn('Could not get data info:', error.message);
    return {
      lastUpdated: new Date().toISOString(),
      sources: ['Manual Upload'],
      autoUpdate: false
    };
  }
}
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
