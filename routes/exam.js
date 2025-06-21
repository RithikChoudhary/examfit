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

// Validation function to check if request is for static files or invalid exams
function isValidExamRequest(examId, subjectId) {
  // Block obvious static file patterns
  const staticPatterns = [
    'templates', 'public', 'css', 'js', 'images', 'icons', 'fonts',
    'assets', 'static', 'uploads', 'files', 'media'
  ];
  
  // Block file extensions
  const fileExtensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', 
                         '.css', '.js', '.json', '.xml', '.txt', '.pdf', '.zip'];
  
  // Check if examId or subjectId looks like a static file request
  if (staticPatterns.includes(examId) || staticPatterns.includes(subjectId)) {
    return false;
  }
  
  // Check for file extensions
  if (fileExtensions.some(ext => examId.endsWith(ext) || subjectId?.endsWith(ext))) {
    return false;
  }
  
  // Check for paths that contain dots (likely files)
  if (examId.includes('.') || subjectId?.includes('.')) {
    return false;
  }
  
  return true;
}

// Route for displaying question papers for a subject within an exam
router.get('/:exam/:subject/questionPapers', debounceRequest(async (req, res, options = {}) => { 
  try {
    const { exam: examId, subject: subjectId } = req.params;
    
    // Validate that this is not a static file request
    if (!isValidExamRequest(examId, subjectId)) {
      console.log(`🚫 DEBUG: Rejecting static file request: ${examId}/${subjectId}/questionPapers`);
      return res.status(404).send('Static file not found');
    }
    
    console.log(`📄 DEBUG: Loading question papers for ${examId}/${subjectId}`);
    
    const cacheKey = `exam-${examId}-subject-${subjectId}-questionPapers`;

    console.log(`📄 DEBUG: Step 1 - Getting exam data for ${examId}`);
    const examData = await examService.getExamById(examId);
    if (!examData) {
      console.log(`❌ DEBUG: Exam not found: ${examId}`);
      return res.status(404).send(`Exam not found: ${examId}`);
    }
    console.log(`✅ DEBUG: Exam found: ${examData.examName}`);

    console.log(`📄 DEBUG: Step 2 - Getting question papers for ${examId}/${subjectId}`);
    const questionPapers = await examService.getQuestionPapers(examId, subjectId);
    console.log(`✅ DEBUG: Question papers retrieved: ${questionPapers?.length || 0}`);
    
    console.log(`📄 DEBUG: Step 3 - Finding subject data for ${subjectId}`);
    const subjectData = examData.subjects?.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      console.log(`❌ DEBUG: Subject not found: ${subjectId}`);
      console.log(`📄 DEBUG: Available subjects:`, examData.subjects?.map(s => s.subjectId) || []);
      return res.status(404).send(`Subject not found: ${subjectId}. Available: ${examData.subjects?.map(s => s.subjectId).join(', ') || 'none'}`);
    }
    console.log(`✅ DEBUG: Subject found: ${subjectData.subjectName}`);

    const templateData = { 
      exam: examId,
      examName: examData.examName,
      subject: subjectId,
      subjectName: subjectData.subjectName,
      questionPapers: questionPapers || [],
      subjects: examData.subjects,
      animationSpeed: '0.3s'  // Added animation speed control
    };

    console.log(`✅ DEBUG: Rendering question papers with ${questionPapers?.length || 0} papers`);
    renderWithCache(res, 'questionPapers', templateData, cacheKey);
  } catch (error) {
    console.error(`❌ DEBUG: Error in questionPapers route for ${req.params.exam}/${req.params.subject}:`, error);
    console.error(`❌ DEBUG: Error stack:`, error.stack);
    res.status(500).send(`Error loading question papers: ${error.message}`);
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
  console.log(`❓ DEBUG: Loading questions for paper: ${examId}/${subjectId}/${questionPaperId}`);

  try {
    console.log(`❓ DEBUG: Step 1 - Getting exam data for ${examId}`);
    const examData = await examService.getExamById(examId);
    if (!examData) {
      console.log(`❌ DEBUG: Exam not found: ${examId}`);
      return res.status(404).send('Exam not found');
    }
    console.log(`✅ DEBUG: Exam found: ${examData.examName}`);

    console.log(`❓ DEBUG: Step 2 - Getting question papers for ${examId}/${subjectId}`);
    const questionPapers = await examService.getQuestionPapers(examId, subjectId);
    console.log(`✅ DEBUG: Question papers retrieved: ${questionPapers?.length || 0} papers`);
    
    if (questionPapers?.length > 0) {
      console.log(`❓ DEBUG: Available paper IDs:`, questionPapers.map(p => p.questionPaperId));
    }
    
    console.log(`❓ DEBUG: Step 3 - Looking for paper with ID: ${questionPaperId}`);
    const paper = questionPapers.find(p => p.questionPaperId === questionPaperId);
    if (!paper) {
      console.log(`❌ DEBUG: Question paper not found: ${questionPaperId}`);
      console.log(`❓ DEBUG: Available papers:`, questionPapers?.map(p => ({id: p.questionPaperId, name: p.questionPaperName})) || []);
      return res.status(404).send('Question paper not found');
    }
    console.log(`✅ DEBUG: Paper found: ${paper.questionPaperName}`);
    
    // PERFORMANCE FIX: Load questions directly from MongoDB for this specific paper
    console.log(`❓ DEBUG: Step 4 - Loading questions directly from MongoDB for paper ${questionPaperId}`);
    const questions = await examService.getQuestionsForPaper(examId, subjectId, questionPaperId);
    console.log(`❓ DEBUG: Step 4 - Questions loaded from MongoDB: ${questions.length}`);
    
    if (questions.length > 0) {
      console.log(`✅ DEBUG: First question preview:`, {
        id: questions[0].questionId,
        text: questions[0].question?.substring(0, 50) + '...',
        optionsCount: questions[0].options?.length || 0
      });
    } else {
      console.log(`❌ DEBUG: No questions found in MongoDB for paper ${questionPaperId}`);
      console.log(`❓ DEBUG: This suggests a field name mismatch in the database query`);
    }
    
    const subjectData = examData.subjects?.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      console.log(`❌ DEBUG: Subject not found: ${subjectId}`);
      return res.status(404).send('Subject not found');
    }
    console.log(`✅ DEBUG: Subject found: ${subjectData.subjectName}`);
    
    const templateData = {
      exam: examId,
      examName: examData.examName,
      subject: subjectId, 
      subjectName: subjectData.subjectName,
      questionPaper: questionPaperId, 
      questionPaperName: paper.questionPaperName || `Question Paper ${questionPaperId}`,
      questions: questions,
      subjects: examData.subjects,
      animationSpeed: '0.3s'
    };

    console.log(`✅ DEBUG: Rendering questions template with ${questions.length} questions`);
    res.render('questions', templateData);
  } catch (error) {
    console.error(`❌ DEBUG: Error loading questions:`, error);
    console.error(`❌ DEBUG: Stack trace:`, error.stack);
    res.status(500).send(`Error loading questions: ${error.message}`);
  }
}));

module.exports = router;
