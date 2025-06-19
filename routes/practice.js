const express = require('express');
const router = express.Router();
const { getQuestions } = require('../utils/dataHelpers');
const fs = require('fs').promises;
const path = require('path');

// Path for storing user progress
const progressPath = path.join(__dirname, '..', 'data', 'progress.json');

// Get or create progress data
async function getProgressData() {
    try {
        const data = await fs.readFile(progressPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            const defaultData = { sessions: [], userStats: {} };
            await fs.writeFile(progressPath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        throw error;
    }
}

async function saveProgressData(data) {
    await fs.writeFile(progressPath, JSON.stringify(data, null, 2));
}

// Practice session selection page
router.get('/', async (req, res) => {
    try {
        const data = await getQuestions();
        res.render('practice/index', { 
            exams: data.exams,
            title: 'Practice Sessions'
        });
    } catch (error) {
        console.error('Error loading practice page:', error);
        res.status(500).send('Error loading practice page');
    }
});

// Get subjects for an exam (API endpoint)
router.get('/api/subjects/:examId', async (req, res) => {
    try {
        const data = await getQuestions();
        const exam = data.exams.find(e => e.examId === req.params.examId);
        if (!exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }
        res.json({ subjects: exam.subjects || [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch subjects' });
    }
});

// Get question papers for a subject (API endpoint)
router.get('/api/questionPapers/:examId/:subjectId', async (req, res) => {
    try {
        const data = await getQuestions();
        const exam = data.exams.find(e => e.examId === req.params.examId);
        if (!exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }
        
        const subject = exam.subjects.find(s => s.subjectId === req.params.subjectId);
        if (!subject) {
            return res.status(404).json({ error: 'Subject not found' });
        }
        
        res.json({ questionPapers: subject.questionPapers || [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch question papers' });
    }
});

// Start a timed practice session
router.get('/session/:examId/:subjectId/:paperId', async (req, res) => {
    try {
        const { examId, subjectId, paperId } = req.params;
        const { duration, questionCount } = req.query;
        
        const data = await getQuestions();
        const exam = data.exams.find(e => e.examId === examId);
        const subject = exam?.subjects.find(s => s.subjectId === subjectId);
        const paper = subject?.questionPapers.find(p => p.questionPaperId === paperId);
        
        if (!paper) {
            return res.status(404).send('Question paper not found');
        }
        
        // Shuffle and limit questions if needed
        let questions = [...(paper.questions || [])];
        if (questionCount && questionCount < questions.length) {
            questions = questions.sort(() => Math.random() - 0.5).slice(0, parseInt(questionCount));
        }
        
        res.render('practice/session', {
            exam: exam,
            subject: subject,
            paper: paper,
            questions: questions,
            duration: duration || 60, // default 60 minutes
            sessionData: {
                examId,
                subjectId,
                paperId,
                startTime: Date.now()
            }
        });
    } catch (error) {
        console.error('Error starting practice session:', error);
        res.status(500).send('Error starting practice session');
    }
});

// Submit practice session results
router.post('/session/submit', express.json(), async (req, res) => {
    try {
        const { sessionData, answers, timeSpent } = req.body;
        
        // Get questions to calculate score
        const data = await getQuestions();
        const exam = data.exams.find(e => e.examId === sessionData.examId);
        const subject = exam?.subjects.find(s => s.subjectId === sessionData.subjectId);
        const paper = subject?.questionPapers.find(p => p.questionPaperId === sessionData.paperId);
        
        if (!paper) {
            return res.status(404).json({ error: 'Question paper not found' });
        }
        
        // Calculate score
        let correct = 0;
        let total = 0;
        const results = [];
        
        paper.questions.forEach(question => {
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
        
        // Save session to progress data
        const progressData = await getProgressData();
        const session = {
            id: Date.now().toString(),
            examId: sessionData.examId,
            examName: exam.examName,
            subjectId: sessionData.subjectId,
            subjectName: subject.subjectName,
            paperId: sessionData.paperId,
            paperName: paper.questionPaperName,
            date: new Date().toISOString(),
            score,
            correct,
            total,
            timeSpent,
            results
        };
        
        progressData.sessions.push(session);
        
        // Update user stats
        if (!progressData.userStats[sessionData.examId]) {
            progressData.userStats[sessionData.examId] = {};
        }
        if (!progressData.userStats[sessionData.examId][sessionData.subjectId]) {
            progressData.userStats[sessionData.examId][sessionData.subjectId] = {
                totalSessions: 0,
                totalQuestions: 0,
                totalCorrect: 0,
                totalTime: 0,
                bestScore: 0,
                averageScore: 0
            };
        }
        
        const stats = progressData.userStats[sessionData.examId][sessionData.subjectId];
        stats.totalSessions++;
        stats.totalQuestions += total;
        stats.totalCorrect += correct;
        stats.totalTime += timeSpent;
        stats.bestScore = Math.max(stats.bestScore, score);
        stats.averageScore = Math.round((stats.totalCorrect / stats.totalQuestions) * 100);
        
        await saveProgressData(progressData);
        
        res.json({ 
            success: true, 
            sessionId: session.id,
            score,
            correct,
            total,
            results
        });
    } catch (error) {
        console.error('Error submitting session:', error);
        res.status(500).json({ error: 'Failed to submit session' });
    }
});

// Get session results
router.get('/results/:sessionId', async (req, res) => {
    try {
        const progressData = await getProgressData();
        const session = progressData.sessions.find(s => s.id === req.params.sessionId);
        
        if (!session) {
            return res.status(404).send('Session not found');
        }
        
        res.render('practice/results', { session });
    } catch (error) {
        console.error('Error loading results:', error);
        res.status(500).send('Error loading results');
    }
});

// Progress tracking page
router.get('/progress', async (req, res) => {
    try {
        const progressData = await getProgressData();
        const recentSessions = progressData.sessions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);
        
        // Calculate overall stats
        const totalSessions = progressData.sessions.length;
        const totalQuestions = progressData.sessions.reduce((sum, s) => sum + s.total, 0);
        const totalCorrect = progressData.sessions.reduce((sum, s) => sum + s.correct, 0);
        const averageScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
        
        // Subject-wise performance
        const subjectPerformance = {};
        progressData.sessions.forEach(session => {
            const key = `${session.examName} - ${session.subjectName}`;
            if (!subjectPerformance[key]) {
                subjectPerformance[key] = {
                    sessions: 0,
                    totalQuestions: 0,
                    totalCorrect: 0,
                    averageScore: 0
                };
            }
            subjectPerformance[key].sessions++;
            subjectPerformance[key].totalQuestions += session.total;
            subjectPerformance[key].totalCorrect += session.correct;
            subjectPerformance[key].averageScore = Math.round(
                (subjectPerformance[key].totalCorrect / subjectPerformance[key].totalQuestions) * 100
            );
        });
        
        res.render('practice/progress', {
            recentSessions,
            overallStats: {
                totalSessions,
                totalQuestions,
                totalCorrect,
                averageScore
            },
            subjectPerformance
        });
    } catch (error) {
        console.error('Error loading progress:', error);
        res.status(500).send('Error loading progress');
    }
});

module.exports = router;
