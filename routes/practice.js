const express = require('express');
const router = express.Router();

// Import new services
const examService = require('../services/examService');
const questionService = require('../services/questionService');
const progressService = require('../services/progressService');

// Import middleware
const { asyncHandler } = require('../middleware/errorHandler');

// Practice session selection page
router.get('/', asyncHandler(async (req, res) => {
    try {
        console.log('Loading practice page...');
        
        // Get exam summaries first
        const examSummaries = await examService.getAllExams();
        console.log('Exam summaries loaded:', examSummaries.length, 'exams');
        
        if (examSummaries.length === 0) {
            console.warn('⚠️ No exams found in database');
            // Check data source health
            const { healthCheck } = require('../utils/dataHelpers');
            const health = await healthCheck();
            console.log('📊 Data source health:', {
                dataSource: health.dataSource,
                examCount: health.examCount || 0,
                status: health.status
            });
        }
        
        // Only send exam summaries - load subjects via AJAX when needed
        console.log(`✅ Sending ${examSummaries.length} exam summaries (lightweight)`);
        
        res.render('practice/index', { 
            exams: examSummaries, // Just the summaries, not full data
            title: 'Practice Sessions'
        });
    } catch (error) {
        console.error('Error in practice route:', error);
        console.log('🚨 Rendering emergency fallback for practice due to MongoDB failure');
        res.render('practice/index', { 
            exams: [],
            title: 'Practice Sessions',
            error: 'Database temporarily unavailable. Please try again later.'
        });
    }
}));

// Get subjects for an exam (API endpoint) - MongoDB only
router.get('/api/subjects/:examId', asyncHandler(async (req, res) => {
    const { examId } = req.params;
    
    console.log(`🔍 MongoDB-only API request for subjects: ${examId}`);
    
    // Direct MongoDB query for optimal performance
    const mongoService = require('../services/mongoService');
    const subjects = await mongoService.getSubjectsByExam(examId);
    
    console.log(`✅ MongoDB subjects loaded for ${examId}: ${subjects.length} subjects`);
    res.json({ subjects });
}));

// Get question papers for a subject (API endpoint)
router.get('/api/questionPapers/:examId/:subjectId', asyncHandler(async (req, res) => {
    const questionPapers = await examService.getQuestionPapers(req.params.examId, req.params.subjectId);
    res.json({ questionPapers });
}));

// Start a timed practice session
router.get('/session/:examId/:subjectId/:paperId', asyncHandler(async (req, res) => {
    const { examId, subjectId, paperId } = req.params;
    const { duration, questionCount } = req.query;
    
    // Get exam and paper data using services
    const exam = await examService.getExamById(examId);
    const subject = exam.subjects?.find(s => s.subjectId === subjectId);
    const paper = subject?.questionPapers?.find(p => p.questionPaperId === paperId);
    
    if (!paper) {
        return res.status(404).send('Question paper not found');
    }
    
    // Get questions for the paper
    let questions = await questionService.getQuestionsByPaper(examId, subjectId, paperId);
    
    // Shuffle and limit questions if needed
    if (questionCount && questionCount < questions.length) {
        questions = questions.sort(() => Math.random() - 0.5).slice(0, parseInt(questionCount));
    }
    
    res.render('practice/session', {
        exam,
        subject,
        paper,
        questions,
        duration: duration || 60, // default 60 minutes
        sessionData: {
            examId,
            subjectId,
            paperId,
            startTime: Date.now()
        }
    });
}));

// Submit practice session results
router.post('/session/submit', express.json(), asyncHandler(async (req, res) => {
    const { sessionData, answers, timeSpent } = req.body;
    
    // Get exam data
    const exam = await examService.getExamById(sessionData.examId);
    const subject = exam.subjects?.find(s => s.subjectId === sessionData.subjectId);
    const paper = subject?.questionPapers?.find(p => p.questionPaperId === sessionData.paperId);
    
    if (!paper) {
        return res.status(404).json({ error: 'Question paper not found' });
    }
    
    // Get questions to calculate score
    const questions = await questionService.getQuestionsByPaper(
        sessionData.examId, 
        sessionData.subjectId, 
        sessionData.paperId
    );
    
    // Calculate score
    let correct = 0;
    let total = 0;
    const results = [];
    
    questions.forEach(question => {
        if (answers[question.questionId]) {
            total++;
            const isCorrect = answers[question.questionId] === question.correctOption;
            if (isCorrect) correct++;
            
            results.push({
                questionId: question.questionId,
                userAnswer: answers[question.questionId],
                correctAnswer: question.correctOption,
                isCorrect
            });
        }
    });
    
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    // Prepare session data for saving
    const newSessionData = {
        examId: sessionData.examId,
        examName: exam.examName,
        subjectId: sessionData.subjectId,
        subjectName: subject.subjectName,
        paperId: sessionData.paperId,
        paperName: paper.questionPaperName,
        score,
        correct,
        total,
        timeSpent: timeSpent || 0,
        results
    };
    
    // Save session using progress service
    const session = await progressService.saveSession(newSessionData);
    
    res.json({ 
        success: true, 
        sessionId: session.id,
        score,
        correct,
        total,
        results
    });
}));

// Get session results
router.get('/results/:sessionId', asyncHandler(async (req, res) => {
    const session = await progressService.getSession(req.params.sessionId);
    res.render('practice/results', { session });
}));

// Progress tracking page
router.get('/progress', asyncHandler(async (req, res) => {
    try {
        console.log('Loading progress page...');
        
        // Always start with empty data - no fake/mock data
        const emptyData = {
            recentSessions: [],
            overallStats: {
                totalSessions: 0,
                totalQuestions: 0,
                totalCorrect: 0,
                averageScore: 0
            },
            subjectPerformance: {}
        };
        
        // Try to get real analytics, but if it fails or returns fake data, use empty
        try {
            const analytics = await progressService.getPerformanceAnalytics();
            
            // Check if we have real session data (not test/fake data)
            const realSessions = analytics.recentSessions?.filter(session => {
                // Filter out any test/fake sessions
                return session.examName && session.subjectName && 
                       !session.examName.includes('Test') && 
                       !session.examName.includes('Sample') &&
                       new Date(session.date).getFullYear() >= 2024; // Only recent sessions
            }) || [];
            
            console.log('Real sessions found:', realSessions.length);
            
            if (realSessions.length > 0) {
                // Recalculate stats based on real sessions only
                const totalQuestions = realSessions.reduce((sum, s) => sum + s.total, 0);
                const totalCorrect = realSessions.reduce((sum, s) => sum + s.correct, 0);
                const averageScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
                
                res.render('practice/progress', {
                    recentSessions: realSessions,
                    overallStats: {
                        totalSessions: realSessions.length,
                        totalQuestions,
                        totalCorrect,
                        averageScore
                    },
                    subjectPerformance: {} // Empty for now
                });
            } else {
                console.log('No real sessions found, showing empty state');
                res.render('practice/progress', emptyData);
            }
        } catch (analyticsError) {
            console.log('Analytics service failed, showing empty state:', analyticsError.message);
            res.render('practice/progress', emptyData);
        }
        
    } catch (error) {
        console.error('Error loading progress page:', error);
        
        // Always fallback to empty data - never show fake data
        const emptyData = {
            recentSessions: [],
            overallStats: {
                totalSessions: 0,
                totalQuestions: 0,
                totalCorrect: 0,
                averageScore: 0
            },
            subjectPerformance: {}
        };
        
        res.render('practice/progress', emptyData);
    }
}));

module.exports = router;
