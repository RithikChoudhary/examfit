const express = require('express');
const router = express.Router();
const examService = require('../services/examService');
const { asyncHandler } = require('../middleware/errorHandler');


// NOTE: Removed duplicate /:exam route to prevent conflicts with examRouter.js
// examRouter.js now handles all main exam routes like /upsc, /ssc, etc.
// This file only handles sub-exam specific routes


// Route for subjects under sub-exams - MongoDB optimized
router.get('/:exam/:subExam/subjects', asyncHandler(async (req, res) => {
    const { exam, subExam } = req.params;
    console.log(`� Loading sub-exam subjects: ${exam}/${subExam}`);
    
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
