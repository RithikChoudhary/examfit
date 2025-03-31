// routes/index.js
const express = require('express');
const router = express.Router();
const { getQuestions } = require('../utils/dataHelpers');
const fs = require('fs');
const path = require('path');

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
      totalExams: data.exams.length
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
router.post('/contact', (req, res) => {
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

  res.redirect('/contact');
});

module.exports = router;
