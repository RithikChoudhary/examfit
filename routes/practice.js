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
    const exams = await examService.getAllExams();
    res.render('practice/index', { 
        exams,
        title: 'Practice Sessions'
    });
}));

// Get subjects for an exam (API endpoint)
router.get('/api/subjects/:examId', asyncHandler(async (req, res) => {
    const subjects = await examService.getExamSubjects(req.params.examId);
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
    const analytics = await progressService.getPerformanceAnalytics();
    
    res.render('practice/progress', {
        recentSessions: analytics.recentSessions,
        overallStats: analytics.overview,
        subjectPerformance: analytics.subjectPerformance
    });
}));

module.exports = router;
