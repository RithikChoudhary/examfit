// routes/index.js
const express = require('express');
const router = express.Router();
const { getQuestions } = require('../utils/dataHelpers');

router.get('/', async (req, res) => {
  try {
    const data = await getQuestions();
    res.render('index', { exams: data.exams }); 
  } catch (error) {
    console.error('Error in index route:', error); 
    res.status(500).send('An error occurred. Please try again later.'); 
  }
});

module.exports = router;
