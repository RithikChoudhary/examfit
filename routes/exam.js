// routes/exam.js
require("xtend");
const express = require('express');
const router = express.Router();
const { getQuestions } = require('../utils/dataHelpers');

// Enhanced debounce function with request cancellation
let inFlightRequest = false;

function debounceRequest(callback, delay = 300) {
  let timeout;
  return function(...args) {
    const requestAborted = () => {
      clearTimeout(timeout);
      inFlightRequest = false;
    };

    const wrappedCallback = () => {
      if (!inFlightRequest) {
        inFlightRequest = true;
        callback(...args).finally(() => {
          inFlightRequest = false;
        });
      }
    };

    clearTimeout(timeout);
    timeout = setTimeout(wrappedCallback, delay);
  };
}

// Optimized rendering helper with caching
function renderWithCache(res, template, data, cacheKey, cacheDuration = 5000) {
  // Get cache for this specific route
  const cache = renderWithCache.cache || {};
  const cacheEntry = cache[cacheKey];
  
  // Check if we have valid cached data
  if (cacheEntry && cacheEntry.timestamp > Date.now() - cacheDuration) {
    return res.render(template, data);
  }

  // Update cache
  renderWithCache.cache = {
    ...cache,
    [cacheKey]: {
      data: data,
      timestamp: Date.now()
    }
  };

  return res.render(template, data);
}

renderWithCache.cache = {};

// Route for displaying subjects for a specific exam (e.g., /upsc or /cgl)
router.get('/:exam', debounceRequest(async (req, res) => {
  try {
    const examId = req.params.exam.toLowerCase();
    const cacheKey = `exam-${examId}`;
    
    // Get data
    const data = await getQuestions();
    const examData = data.exams.find(e => e.examId === examId);

    if (!examData) {
      return res.status(404).send('Exam not found');
    }

    const templateData = { 
      exam: examId,
      examName: examData.examName,
      subjects: examData.subjects,
      animationSpeed: '0.3s'  // Added animation speed control
    };

    renderWithCache(res, 'subjects', templateData, cacheKey);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error loading exam data');
  }
}));

// Route for displaying question papers for a subject within an exam
router.get('/:exam/:subject/questionPapers', debounceRequest(async (req, res) => { 
  try {
    const { exam: examId, subject: subjectId } = req.params;
    const cacheKey = `questionPapers-${examId}-${subjectId}`;

    const data = await getQuestions();
    const examData = data.exams.find(e => e.examId === examId);
    if (!examData) return res.status(404).send('Exam not found');

    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subjectData) return res.status(404).send('Subject not found');

    const templateData = { 
      exam: examId,
      examName: examData.examName,
      subject: subjectId,
      subjectName: subjectData.subjectName,
      questionPapers: subjectData.questionPapers || [],
      subjects: examData.subjects,
      animationSpeed: '0.3s'  // Added animation speed control
    };

    renderWithCache(res, 'questionPapers', templateData, cacheKey);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error loading question papers');
  }
}));
router.get('/:exam/:subject', debounceRequest(async (req, res) => {
  try {
    const examId = req.params.exam.toLowerCase();
    const subjectId = req.params.subject.toLowerCase();
    const cacheKey = `subject-${examId}-${subjectId}`;

    const data = await getQuestions();
    const examData = data.exams.find(e => e.examId === examId);
    if (!examData) {
      return res.status(404).send('Exam not found');
    }

    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      return res.status(404).send('Subject not found');
    }

    const templateData = { 
      exam: examId,
      subject: subjectId,
      questions: subjectData.questions,
      examName: examData.examName,
      subjectName: subjectData.subjectName,
      animationSpeed: '0.3s'  // Added animation speed control
    };

    renderWithCache(res, 'subject-questions', templateData, cacheKey);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error loading questions');
  }
}));

// Route for displaying questions for a specific question paper
router.get('/:exam/:subject/:questionPaper/questions', debounceRequest(async (req, res) => {
  try {
    const { exam: examId, subject: subjectId, questionPaper: questionPaperId } = req.params;
    const cacheKey = `questions-${examId}-${subjectId}-${questionPaperId}`;

    const data = await getQuestions();
    const examData = data.exams.find(e => e.examId === examId);
    if (!examData) {
      return res.status(404).send('Exam not found');
    }

    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      return res.status(404).send('Subject not found');
    }

    const questionPaper = subjectData.questionPapers.find(qp => qp.questionPaperId === questionPaperId);
    if (!questionPaper) {
      return res.status(404).send('Question Paper not found');
    }
    
    const templateData = {
      exam: examId,
      examName: examData.examName,
      subject: subjectId, 
      subjectName: subjectData.subjectName,
      questionPaper: questionPaperId, 
      questionPaperName: questionPaper.questionPaperName,
      questions: questionPaper.questions,
      subjects: examData.subjects,
      animationSpeed: '0.3s'  // Added animation speed control
    };

    renderWithCache(res, 'questions', templateData, cacheKey);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error loading questions');
  }
}));

module.exports = router;
