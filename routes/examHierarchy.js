const express = require('express');
const router = express.Router();
const examService = require('../services/examService');
const { asyncHandler } = require('../middleware/errorHandler');


// Route for sub-exams (e.g., IPS, IRS under UPSC) - MongoDB optimized
router.get('/:exam', asyncHandler(async (req, res) => {
    const exam = req.params.exam.toLowerCase();
    console.log(`📚 Loading exam: ${exam}`);
    
    // Get exam data using MongoDB service
    const examData = await examService.getExamById(exam);
    
    if (!examData) {
        return res.status(404).send('Exam not found');
    }

    if (examData.subExams) {
        res.render('subexams', { 
            exam: examData.examId,
            examName: examData.examName,
            subExams: examData.subExams
        });
    } else {
        // Get subjects using optimized MongoDB service
        const subjects = await examService.getExamSubjects(exam);
        
        res.render('subjects', { 
            examId: exam, 
            examName: examData.examName,
            subjects: subjects.map(s => ({
                subjectId: s.subjectId,
                subjectName: s.subjectName
            })),
            isSubExamView: false
        });
    }
}));


// Route for subjects under sub-exams - MongoDB optimized
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

    const subjects = subExamData.subjects.map(s => ({
        id: s.subjectId,
        name: s.subjectName
    }));

    res.render('subjects', { 
        exam,
        subExam,
        examName: `${examData.examName} - ${subExamData.subExamName}`,
        subjects,
        isSubExamView: true
    });
}));
// NOTE: Removed duplicate questionPapers route - now handled by examRouter.js
// This prevents route conflicts and ensures consistent behavior
module.exports = router;
