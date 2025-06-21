const express = require('express');
const router = express.Router();
const examService = require('../services/examService');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/:exam/questions/:subject', asyncHandler(async (req, res) => {
    const { exam, subject } = req.params;
    console.log(`❓ Loading questions for: ${exam}/${subject}`);

    // Get exam data using MongoDB service
    const examData = await examService.getExamById(exam);
    if (!examData) {
        return res.status(404).send('Exam not found');
    }

    // Find subject data
    const subjectData = examData.subjects?.find(s => s.subjectId === subject);
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

    res.render('questions', { 
        exam,
        examName: examData.examName,
        subject,
        subjectName: subjectData.subjectName,
        questions: allQuestions,
        subjects: examData.subjects || []
    });
}));

module.exports = router;
