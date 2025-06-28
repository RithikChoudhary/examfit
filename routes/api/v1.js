const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');

// Import services
const examService = require('../../services/examService');
const questionService = require('../../services/questionService');
const progressService = require('../../services/progressService');
const analyticsService = require('../../services/analyticsService');
const cacheService = require('../../services/cacheService');

// Import middleware
const { asyncHandler, formatResponse } = require('../../middleware/errorHandler');
const {
    handleValidationErrors,
    validateExamParams,
    validateSubjectParams,
    validatePaperParams,
    validateQuestionParams,
    validateCreateSubject,
    validateCreatePaper,
    validateCreateQuestion,
    validateUpdateQuestion,
    validateSubmitSession,
    validateSearch,
    validateSessionsQuery,
    paginationValidation
} = require('../../middleware/validation');

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// =============================================================================
// EXAM ROUTES
// =============================================================================

// GET /api/v1/exams - Get all exams
router.get('/exams', asyncHandler(async (req, res) => {
    const exams = await examService.getAllExams();
    res.json(formatResponse(true, exams));
}));

// GET /api/v1/exams/:examId - Get specific exam
router.get('/exams/:examId', validateExamParams, handleValidationErrors, asyncHandler(async (req, res) => {
    const exam = await examService.getExamById(req.params.examId);
    res.json(formatResponse(true, exam));
}));

// GET /api/v1/exams/:examId/stats - Get exam statistics
router.get('/exams/:examId/stats', validateExamParams, handleValidationErrors, asyncHandler(async (req, res) => {
    const stats = await examService.getExamStats(req.params.examId);
    res.json(formatResponse(true, stats));
}));

// GET /api/v1/exams/search - Search exams
router.get('/exams/search', validateSearch, handleValidationErrors, asyncHandler(async (req, res) => {
    const results = await examService.searchExams(req.query.q);
    res.json(formatResponse(true, results));
}));

// =============================================================================
// SUBJECT ROUTES
// =============================================================================

// GET /api/v1/exams/:examId/subjects - Get subjects for exam
router.get('/exams/:examId/subjects', validateExamParams, handleValidationErrors, asyncHandler(async (req, res) => {
    const subjects = await examService.getExamSubjects(req.params.examId);
    res.json(formatResponse(true, subjects));
}));

// POST /api/v1/exams/:examId/subjects - Create new subject
router.post('/exams/:examId/subjects', validateCreateSubject, handleValidationErrors, asyncHandler(async (req, res) => {
    const subject = await examService.addSubject(req.params.examId, req.body);
    res.status(201).json(formatResponse(true, subject));
}));

// DELETE /api/v1/exams/:examId/subjects/:subjectId - Delete subject
router.delete('/exams/:examId/subjects/:subjectId', validateSubjectParams, handleValidationErrors, asyncHandler(async (req, res) => {
    await examService.deleteSubject(req.params.examId, req.params.subjectId);
    res.json(formatResponse(true, { message: 'Subject deleted successfully' }));
}));

// =============================================================================
// QUESTION PAPER ROUTES
// =============================================================================

// GET /api/v1/exams/:examId/subjects/:subjectId/papers - Get question papers
router.get('/exams/:examId/subjects/:subjectId/papers', validateSubjectParams, handleValidationErrors, asyncHandler(async (req, res) => {
    const papers = await examService.getQuestionPapers(req.params.examId, req.params.subjectId);
    res.json(formatResponse(true, papers));
}));

// POST /api/v1/exams/:examId/subjects/:subjectId/papers - Create question paper
router.post('/exams/:examId/subjects/:subjectId/papers', validateCreatePaper, handleValidationErrors, asyncHandler(async (req, res) => {
    const paper = await questionService.addQuestionPaper(req.params.examId, req.params.subjectId, req.body);
    res.status(201).json(formatResponse(true, paper));
}));

// DELETE /api/v1/exams/:examId/subjects/:subjectId/papers/:paperId - Delete question paper
router.delete('/exams/:examId/subjects/:subjectId/papers/:paperId', validatePaperParams, handleValidationErrors, asyncHandler(async (req, res) => {
    await questionService.deleteQuestionPaper(req.params.examId, req.params.subjectId, req.params.paperId);
    res.json(formatResponse(true, { message: 'Question paper deleted successfully' }));
}));

// =============================================================================
// QUESTION ROUTES
// =============================================================================

// GET /api/v1/exams/:examId/subjects/:subjectId/papers/:paperId/questions - Get questions for paper
router.get('/exams/:examId/subjects/:subjectId/papers/:paperId/questions', 
    [...validatePaperParams, ...paginationValidation], 
    handleValidationErrors, 
    asyncHandler(async (req, res) => {
        const questions = await questionService.getQuestionsByPaper(
            req.params.examId, 
            req.params.subjectId, 
            req.params.paperId
        );
        
        // Apply pagination if requested
        const page = req.query.page || 1;
        const limit = req.query.limit || 20;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        const paginatedQuestions = questions.slice(startIndex, endIndex);
        
        const meta = {
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: questions.length,
                totalPages: Math.ceil(questions.length / limit),
                hasNext: endIndex < questions.length,
                hasPrev: page > 1
            }
        };
        
        res.json(formatResponse(true, paginatedQuestions, null, meta));
    })
);

// GET /api/v1/exams/:examId/subjects/:subjectId/questions - Get all questions for subject
router.get('/exams/:examId/subjects/:subjectId/questions', 
    [...validateSubjectParams, ...paginationValidation], 
    handleValidationErrors, 
    asyncHandler(async (req, res) => {
        const questions = await questionService.getQuestionsBySubject(req.params.examId, req.params.subjectId);
        
        // Apply pagination if requested
        const page = req.query.page || 1;
        const limit = req.query.limit || 50;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        const paginatedQuestions = questions.slice(startIndex, endIndex);
        
        const meta = {
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: questions.length,
                totalPages: Math.ceil(questions.length / limit),
                hasNext: endIndex < questions.length,
                hasPrev: page > 1
            }
        };
        
        res.json(formatResponse(true, paginatedQuestions, null, meta));
    })
);

// POST /api/v1/exams/:examId/subjects/:subjectId/papers/:paperId/questions - Add question
router.post('/exams/:examId/subjects/:subjectId/papers/:paperId/questions', 
    validateCreateQuestion, 
    handleValidationErrors, 
    asyncHandler(async (req, res) => {
        const question = await questionService.addQuestion(
            req.params.examId, 
            req.params.subjectId, 
            req.params.paperId, 
            req.body
        );
        res.status(201).json(formatResponse(true, question));
    })
);

// PUT /api/v1/exams/:examId/subjects/:subjectId/questions/:questionId - Update question
router.put('/exams/:examId/subjects/:subjectId/questions/:questionId', validateUpdateQuestion, handleValidationErrors, asyncHandler(async (req, res) => {
    const question = await questionService.updateQuestion(
        req.params.examId, 
        req.params.subjectId, 
        req.params.questionId, 
        req.body
    );
    res.json(formatResponse(true, question));
}));

// DELETE /api/v1/exams/:examId/subjects/:subjectId/questions/:questionId - Delete question
router.delete('/exams/:examId/subjects/:subjectId/questions/:questionId', validateQuestionParams, handleValidationErrors, asyncHandler(async (req, res) => {
    await questionService.deleteQuestion(req.params.examId, req.params.subjectId, req.params.questionId);
    res.json(formatResponse(true, { message: 'Question deleted successfully' }));
}));

// POST /api/v1/exams/:examId/subjects/:subjectId/papers/:paperId/questions/bulk - Bulk upload questions
router.post('/exams/:examId/subjects/:subjectId/papers/:paperId/questions/bulk', 
    upload.single('file'), 
    validatePaperParams, 
    handleValidationErrors, 
    asyncHandler(async (req, res) => {
        if (!req.file) {
            return res.status(400).json(formatResponse(false, null, { message: 'No file uploaded' }));
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawQuestions = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' });

        if (!rawQuestions.length) {
            return res.status(400).json(formatResponse(false, null, { message: 'Excel file is empty' }));
        }

        // Validate headers
        const expectedHeaders = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option'];
        const firstRow = rawQuestions[0];
        const missingHeaders = expectedHeaders.filter(header => !(header in firstRow));
        
        if (missingHeaders.length) {
            return res.status(400).json(formatResponse(false, null, { 
                message: `Missing headers: ${missingHeaders.join(', ')}` 
            }));
        }

        // Process questions
        const processedQuestions = rawQuestions.map((q, index) => {
            if (!q.Question || !q['Option A'] || !q['Option B'] || !q['Option C'] || !q['Option D'] || !q['Correct Option']) {
                throw new Error(`Row ${index + 1} has missing required fields`);
            }

            if (!['a', 'b', 'c', 'd'].includes(String(q['Correct Option']).toLowerCase())) {
                throw new Error(`Row ${index + 1} has invalid Correct Option. Must be a, b, c, or d`);
            }

            return {
                question: q.Question,
                options: [
                    { optionId: 'a', text: q['Option A'] },
                    { optionId: 'b', text: q['Option B'] },
                    { optionId: 'c', text: q['Option C'] },
                    { optionId: 'd', text: q['Option D'] }
                ],
                correctOption: String(q['Correct Option']).toLowerCase(),
                explanation: q.Explanation || ''
            };
        });

        const questions = await questionService.bulkAddQuestions(
            req.params.examId, 
            req.params.subjectId, 
            req.params.paperId, 
            processedQuestions
        );

        res.json(formatResponse(true, { 
            message: `Successfully added ${questions.length} questions`,
            count: questions.length 
        }));
    })
);

// GET /api/v1/exams/:examId/subjects/:subjectId/questions/search - Search questions
router.get('/exams/:examId/subjects/:subjectId/questions/search', 
    [...validateSubjectParams, ...validateSearch], 
    handleValidationErrors, 
    asyncHandler(async (req, res) => {
        const options = {
            section: req.query.section,
            page: req.query.page,
            limit: req.query.limit
        };
        
        const questions = await questionService.searchQuestions(
            req.params.examId, 
            req.params.subjectId, 
            req.query.q, 
            options
        );
        
        res.json(formatResponse(true, questions));
    })
);

// GET /api/v1/exams/:examId/subjects/:subjectId/questions/stats - Get question statistics
router.get('/exams/:examId/subjects/:subjectId/questions/stats', 
    validateSubjectParams, 
    handleValidationErrors, 
    asyncHandler(async (req, res) => {
        const stats = await questionService.getQuestionStats(req.params.examId, req.params.subjectId);
        res.json(formatResponse(true, stats));
    })
);

// =============================================================================
// PRACTICE SESSION ROUTES
// =============================================================================

// POST /api/v1/sessions - Submit practice session
router.post('/sessions', validateSubmitSession, handleValidationErrors, asyncHandler(async (req, res) => {
    const session = await progressService.saveSession(req.body);
    res.status(201).json(formatResponse(true, session));
}));

// GET /api/v1/sessions/:sessionId - Get session details
router.get('/sessions/:sessionId', asyncHandler(async (req, res) => {
    const session = await progressService.getSession(req.params.sessionId);
    res.json(formatResponse(true, session));
}));

// GET /api/v1/sessions - Get user sessions
router.get('/sessions', validateSessionsQuery, handleValidationErrors, asyncHandler(async (req, res) => {
    const options = {
        examId: req.query.examId,
        subjectId: req.query.subjectId,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        page: req.query.page,
        limit: req.query.limit
    };
    
    const result = await progressService.getUserSessions(options);
    res.json(formatResponse(true, result.sessions, null, { pagination: result.pagination }));
}));

// DELETE /api/v1/sessions/:sessionId - Delete session
router.delete('/sessions/:sessionId', asyncHandler(async (req, res) => {
    await progressService.deleteSession(req.params.sessionId);
    res.json(formatResponse(true, { message: 'Session deleted successfully' }));
}));

// =============================================================================
// ANALYTICS & STATS ROUTES
// =============================================================================

// GET /api/v1/analytics/performance - Get performance analytics
router.get('/analytics/performance', validateSessionsQuery, handleValidationErrors, asyncHandler(async (req, res) => {
    const options = {
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo
    };
    
    const analytics = await progressService.getPerformanceAnalytics(options);
    res.json(formatResponse(true, analytics));
}));

// GET /api/v1/analytics/advanced - Get advanced AI-powered analytics
router.get('/analytics/advanced', validateSessionsQuery, handleValidationErrors, asyncHandler(async (req, res) => {
    const options = {
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo
    };
    
    const analytics = await analyticsService.getAdvancedAnalytics(options);
    res.json(formatResponse(true, analytics));
}));

// GET /api/v1/analytics/realtime - Get real-time metrics
router.get('/analytics/realtime', asyncHandler(async (req, res) => {
    const metrics = await analyticsService.getRealtimeMetrics();
    res.json(formatResponse(true, metrics));
}));

// GET /api/v1/analytics/strength-weakness/:examId/:subjectId - Get strength/weakness analysis
router.get('/analytics/strength-weakness/:examId/:subjectId', 
    validateSubjectParams, 
    handleValidationErrors, 
    asyncHandler(async (req, res) => {
        const analysis = await progressService.getStrengthWeaknessAnalysis(
            req.params.examId, 
            req.params.subjectId
        );
        res.json(formatResponse(true, analysis));
    })
);

// GET /api/v1/analytics/adaptive-difficulty/:examId/:subjectId - Get adaptive difficulty recommendation
router.get('/analytics/adaptive-difficulty/:examId/:subjectId', 
    validateSubjectParams, 
    handleValidationErrors, 
    asyncHandler(async (req, res) => {
        const { currentScore } = req.query;
        const userId = req.query.userId || 'default'; // In real app, get from auth
        
        const difficulty = await analyticsService.getAdaptiveDifficulty(
            userId, 
            req.params.subjectId, 
            parseInt(currentScore) || 50
        );
        
        res.json(formatResponse(true, { 
            recommendedDifficulty: difficulty,
            subjectId: req.params.subjectId 
        }));
    })
);

// GET /api/v1/stats/user - Get user statistics
router.get('/stats/user', asyncHandler(async (req, res) => {
    const { examId, subjectId } = req.query;
    const stats = await progressService.getUserStats(examId, subjectId);
    res.json(formatResponse(true, stats));
}));

// GET /api/v1/stats/cache - Get cache statistics
router.get('/stats/cache', asyncHandler(async (req, res) => {
    const stats = cacheService.getStats();
    const preloadStats = cacheService.getPreloadStats();
    const isPreloaded = cacheService.isPreloadCompleted();
    
    res.json(formatResponse(true, {
        ...stats,
        preload: {
            completed: isPreloaded,
            ...preloadStats
        }
    }));
}));

// GET /api/v1/performance/status - Get performance status
router.get('/performance/status', asyncHandler(async (req, res) => {
    const cacheStats = cacheService.getStats();
    const preloadStats = cacheService.getPreloadStats();
    const isPreloaded = cacheService.isPreloadCompleted();
    
    const status = {
        cache: {
            hitRate: cacheStats.hitRate,
            size: cacheStats.size,
            memoryUsage: cacheStats.memoryUsage
        },
        preload: {
            completed: isPreloaded,
            examsPreloaded: preloadStats.examsPreloaded,
            duration: preloadStats.duration + 'ms',
            lastPreload: preloadStats.timestamp ? new Date(preloadStats.timestamp).toISOString() : null
        },
        performance: {
            subjectLoadSpeed: isPreloaded ? 'Instant' : 'First load: 2-3s, subsequent: instant',
            sitemapCached: !!cacheService.get('sitemap_xml'),
            recommendation: isPreloaded ? 'All systems optimized' : 'Cache still warming up'
        }
    };
    
    res.json(formatResponse(true, status));
}));

// =============================================================================
// UTILITY ROUTES
// =============================================================================

// POST /api/v1/cache/clear - Clear service caches (for admin use)
router.post('/cache/clear', asyncHandler(async (req, res) => {
    examService.clearCache();
    questionService.clearCache();
    progressService.clearCache();
    
    res.json(formatResponse(true, { message: 'All caches cleared successfully' }));
}));

// GET /api/v1/health - Health check
router.get('/health', (req, res) => {
    res.json(formatResponse(true, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    }));
});

// GET /api/v1/debug/data - Debug data structure
router.get('/debug/data', asyncHandler(async (req, res) => {
    try {
        // Use MongoDB directly instead of getQuestions()
        const mongoService = require('../../services/mongoService');
        const db = await mongoService.connect();
        
        // Get data directly from MongoDB
        const exams = await db.collection('exams').find({ isActive: true }).toArray();
        const subjects = await db.collection('subjects').find({}).toArray();
        const papers = await db.collection('questionPapers').find({}).toArray();
        const questions = await db.collection('questions').find({}).toArray();
        
        const debugInfo = {
            dataStructure: {
                hasExams: exams.length > 0,
                examCount: exams.length,
                subjectCount: subjects.length,
                paperCount: papers.length,
                questionCount: questions.length,
                exams: exams.map(exam => {
                    const examSubjects = subjects.filter(s => s.examId === exam.examId);
                    return {
                        examId: exam.examId,
                        examName: exam.examName,
                        subjectCount: examSubjects.length,
                        hasSubjects: examSubjects.length > 0,
                        firstSubject: examSubjects.length > 0 ? examSubjects[0].subjectName : 'none'
                    };
                })
            },
            serviceResults: {
                examServiceCount: 0,
                examServiceError: null
            },
            mongoCollections: {
                exams: exams.length,
                subjects: subjects.length,
                questionPapers: papers.length,
                questions: questions.length
            }
        };
        
        // Test examService
        try {
            const examService = require('../../services/examService');
            const serviceExams = await examService.getAllExams(false); // Don't use cache
            debugInfo.serviceResults.examServiceCount = serviceExams.length;
        } catch (error) {
            debugInfo.serviceResults.examServiceError = error.message;
        }
        
        res.json(formatResponse(true, debugInfo));
    } catch (error) {
        res.json(formatResponse(false, null, { message: error.message }));
    }
}));

module.exports = router;
