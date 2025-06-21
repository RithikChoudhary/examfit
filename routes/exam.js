const express = require('express');
const router = express.Router();
const examService = require('../services/examService');
const { asyncHandler } = require('../middleware/errorHandler');

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
    const examData = await examService.getExamById(examId);

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

    const examData = await examService.getExamById(examId);
    if (!examData) return res.status(404).send('Exam not found');

    const questionPapers = await examService.getQuestionPapers(examId, subjectId);
    const subjectData = examData.subjects?.find(s => s.subjectId === subjectId);
    if (!subjectData) return res.status(404).send('Subject not found');

    const templateData = { 
      exam: examId,
      examName: examData.examName,
      subject: subjectId,
      subjectName: subjectData.subjectName,
      questionPapers: questionPapers || [],
      subjects: examData.subjects,
      animationSpeed: '0.3s'  // Added animation speed control
    };

    renderWithCache(res, 'questionPapers', templateData, cacheKey);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error loading question papers');
  }
}));
router.get('/:exam/:subject', asyncHandler(async (req, res) => {
  const examId = req.params.exam.toLowerCase();
  const subjectId = req.params.subject.toLowerCase();
  console.log(`📖 Loading subject questions: ${examId}/${subjectId}`);

  try {
    const examData = await examService.getExamById(examId);
    if (!examData) {
      return res.status(404).send('Exam not found');
    }

    const subjectData = examData.subjects?.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      return res.status(404).send('Subject not found');
    }

    // Get all questions for this subject across all papers
    let allQuestions = [];
    if (subjectData.questionPapers) {
      for (const paper of subjectData.questionPapers) {
        if (paper.questions) {
          allQuestions = allQuestions.concat(paper.questions);
        }
      }
    }

    const templateData = { 
      exam: examId,
      subject: subjectId,
      questions: allQuestions,
      examName: examData.examName,
      subjectName: subjectData.subjectName,
      animationSpeed: '0.3s'
    };

    res.render('subject-questions', templateData);
  } catch (error) {
    console.error('Error loading subject questions:', error);
    res.status(500).send('Error loading questions');
  }
}));

// Route for individual question (e.g., /general/gk/questionPapers/auto-2025-06/q1750325224-101cac6e)
router.get('/:exam/:subject/questionPapers/:paperId/:questionId', asyncHandler(async (req, res) => {
  const { exam: examId, subject: subjectId, paperId, questionId } = req.params;
  console.log(`❓ Loading individual question: ${examId}/${subjectId}/${paperId}/${questionId}`);
  
  try {
    const examData = await examService.getExamById(examId);
    if (!examData) return res.status(404).send('Exam not found');

    const questionPapers = await examService.getQuestionPapers(examId, subjectId);
    const paper = questionPapers.find(p => p.questionPaperId === paperId);
    if (!paper) return res.status(404).send('Question paper not found');
    
    const question = paper.questions.find(q => q.questionId === questionId);
    
    if (!question) return res.status(404).send('Question not found');

    res.render('single-question', {
      exam: examId,
      subject: subjectId,
      paperId,
      question,
      examName: examData.examName
    });
  } catch (error) {
    console.error('Error loading question:', error);
    res.status(500).send('Error loading question');
  }
}));

// Route for displaying questions for a specific question paper
router.get('/:exam/:subject/:questionPaper/questions', asyncHandler(async (req, res) => {
  const { exam: examId, subject: subjectId, questionPaper: questionPaperId } = req.params;
  console.log(`❓ Loading questions for paper: ${examId}/${subjectId}/${questionPaperId}`);

  try {
    const examData = await examService.getExamById(examId);
    if (!examData) {
      return res.status(404).send('Exam not found');
    }

    const questionPapers = await examService.getQuestionPapers(examId, subjectId);
    const paper = questionPapers.find(p => p.questionPaperId === questionPaperId);
    if (!paper) {
      return res.status(404).send('Question paper not found');
    }
    const questions = paper.questions || [];
    
    const subjectData = examData.subjects?.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      return res.status(404).send('Subject not found');
    }
    
    const templateData = {
      exam: examId,
      examName: examData.examName,
      subject: subjectId, 
      subjectName: subjectData.subjectName,
      questionPaper: questionPaperId, 
      questionPaperName: `Question Paper ${questionPaperId}`,
      questions: questions,
      subjects: examData.subjects,
      animationSpeed: '0.3s'
    };

    res.render('questions', templateData);
  } catch (error) {
    console.error('Error loading questions:', error);
    res.status(500).send('Error loading questions');
  }
}));

module.exports = router;
