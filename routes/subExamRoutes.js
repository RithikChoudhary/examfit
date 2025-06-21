const express = require('express');
const router = express.Router();
const examService = require('../services/examService');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/:exam/:subExam/subjects', asyncHandler(async (req, res) => {
    const { exam, subExam } = req.params;
    console.log(`📖 Loading sub-exam subjects: ${exam}/${subExam}`);

    // Get exam data using MongoDB service
    const examData = await examService.getExamById(exam);
    if (!examData) {
        return res.status(404).send('Exam not found');
    }

    const subExamData = examData.subExams?.find(se => se.subExamId === subExam);
    if (!subExamData) {
        return res.status(404).send('Sub-exam not found');
    }

    res.render('subjects', {
        exam,
        subExam,
        examName: `${examData.examName} - ${subExamData.subExamName}`,
        subjects: subExamData.subjects.map(subject => ({
            id: subject.subjectId,
            name: subject.subjectName,
            questionCount: subject.questions?.length || 0
        })),
        isSubExamView: true 
    });
}));

// Route for displaying questions for a sub-exam subject (e.g., /upsc/ips/questions/history)
router.get('/:exam/:subExam/questions/:subject', asyncHandler(async (req, res) => {
    const { exam, subExam, subject } = req.params;
    console.log(`❓ Loading sub-exam questions: ${exam}/${subExam}/${subject}`);

    // Get exam data using MongoDB service
    const examData = await examService.getExamById(exam);
    if (!examData) {
        return res.status(404).send('Exam not found');
    }

    // Find sub-exam (IPS, IRS, IFS)
    const subExamData = examData.subExams?.find(se => se.subExamId === subExam);
    if (!subExamData) {
        return res.status(404).send('Sub-exam not found');
    }

    // Find subject (History, Geography, etc.)
    const subjectData = subExamData.subjects?.find(s => s.subjectId === subject); 
    if (!subjectData) {
        return res.status(404).send('Subject not found');
    }

    res.render('questions', {
        exam,
        examName: examData.examName,
        subExam,
        subExamName: subExamData.subExamName,
        subject,
        subjectName: subjectData.subjectName,
        questions: subjectData.questions || [],
        subjects: subExamData.subjects || []
    });
}));
  router.get('/:exam/:subExam', (req, res) => {
    res.redirect(`/${req.params.exam}/${req.params.subExam}/subjects`); 
});
// Redirect from /exam/subExam to /exam/subExam/subjects
module.exports = router;
