// routes/exam.js
require("xtend");
const express = require('express');
const router = express.Router();
const { getQuestions } = require('../utils/dataHelpers');

// Optimized debounce function with request cancellation, URL tracking, and memory management
function debounceRequest(callback, delay = 300) {
  // Use WeakMap for better memory management when possible
  const inFlightRequests = new Map();  // To track requests per URL
  const timeouts = new Map();          // To track timeouts per URL
  
  // Shared cleanup function to reduce code duplication
  const cleanup = (url) => {
    if (timeouts.has(url)) {
      clearTimeout(timeouts.get(url));
      timeouts.delete(url);
    }
    if (inFlightRequests.has(url)) {
      inFlightRequests.delete(url);
    }
  };

  return function(...args) {
    const req = args[0];
    const url = req.originalUrl;
    const requestId = `${url}-${Date.now()}`;
    
    // Cancel any pending request for this URL
    if (inFlightRequests.has(url)) {
      inFlightRequests.get(url).abort();
      inFlightRequests.delete(url);
    }

    // Clear previous timeout for this URL
    if (timeouts.has(url)) {
      clearTimeout(timeouts.get(url));
      timeouts.delete(url);
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    inFlightRequests.set(url, abortController);

    // Set new timeout with performance optimization
    const timeout = setTimeout(async () => {
      try {
        // Pass the abort signal and requestId to the callback
        const result = await callback(...args, { 
          signal: abortController.signal,
          requestId
        });
        return result;
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`Request aborted for URL: ${url}`);
          return;
        }
        console.error(`Request failed for URL: ${url}`, error);
        throw error;
      } finally {
        cleanup(url);
      }
    }, delay);

    // Store timeout so we can clear it later
    timeouts.set(url, timeout);

    // Add cleanup on request end and error
    req.on('end', () => cleanup(url));
    req.on('error', () => cleanup(url));
    
    // Add cleanup on response finish to handle cases where 'end' isn't triggered
    const res = args[1];
    if (res && typeof res.on === 'function') {
      res.on('finish', () => cleanup(url));
    }
  };
}

// Optimized rendering helper with caching
function renderWithCache(res, template, data, cacheKey, cacheDuration = 3600000) {
  // Get cache for this specific route
  const cache = renderWithCache.cache || {};
  const cacheEntry = cache[cacheKey];
  
  // Set cache-control headers for better browser caching
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=60');
  res.setHeader('Vary', 'Accept');
  
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
router.get('/:exam', debounceRequest(async (req, res, options = {}) => {
  try {
    const examId = req.params.exam.toLowerCase();
    const cacheKey = `exam-${examId}-subjects`;
    
    // Get data in parallel
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
router.get('/:exam/:subject/questionPapers', debounceRequest(async (req, res, options = {}) => { 
  try {
    const { exam: examId, subject: subjectId } = req.params;
    const cacheKey = `exam-${examId}-subject-${subjectId}-questionPapers`;

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
router.get('/:exam/:subject', debounceRequest(async (req, res, options = {}) => {
  try {
    const examId = req.params.exam.toLowerCase();
    const subjectId = req.params.subject.toLowerCase();
    const cacheKey = `exam-${examId}-subject-${subjectId}-questions`;

    // Get data in parallel
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
router.get('/:exam/:subject/:questionPaper/questions', debounceRequest(async (req, res, options = {}) => {
  try {
    const { exam: examId, subject: subjectId, questionPaper: questionPaperId } = req.params;
    const cacheKey = `exam-${examId}-subject-${subjectId}-questionPaper-${questionPaperId}`;

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
