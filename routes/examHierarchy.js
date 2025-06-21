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
// Route for displaying question papers for a subject within an exam - MongoDB optimized
router.get('/:examId/:subjectId/questionPapers', asyncHandler(async (req, res) => {
    const { examId, subjectId } = req.params;
    console.log(`📄 Loading question papers for: ${examId}/${subjectId}`);
    
    // Get exam data using MongoDB service
    const examData = await examService.getExamById(examId);
    if (!examData) {
        return res.status(404).send('Exam not found');
    }
    
    // Get question papers using MongoDB service
    const questionPapers = await examService.getQuestionPapers(examId, subjectId);
    
    // Find subject name
    const subjectData = examData.subjects?.find(s => s.subjectId === subjectId);
    if (!subjectData) {
        return res.status(404).send('Subject not found');
    }
    
    // Define possible sections
    const sections = ["Previous Year", "Section I", "Section II", "Section III"];
    
    // Filter sections that have actual data
    const availableSections = sections.filter(section => {
        return questionPapers?.find(qp => qp.section === section);
    });

    res.render('questionPapers', { 
        exam: examId,
        subject: subjectId,
        examName: examData.examName,
        subjectName: subjectData.subjectName,
        questionPapers: questionPapers || [],
        sections: availableSections,
        subjects: examData.subjects || []
    });
}));
module.exports = router;
