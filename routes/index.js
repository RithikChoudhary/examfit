// routes/index.js
const express = require('express');
const router = express.Router();
const { getQuestions } = require('../utils/dataHelpers');

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

module.exports = router;
