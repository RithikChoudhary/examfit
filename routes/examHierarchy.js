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
    console.log(`📄 DEBUG: Loading question papers for: ${examId}/${subjectId}`);
    
    try {
        // Get exam data using MongoDB service
        console.log(`📄 DEBUG: Getting exam data for ${examId}...`);
        const examData = await examService.getExamById(examId);
        if (!examData) {
            console.log(`❌ DEBUG: Exam not found: ${examId}`);
            return res.status(404).send('Exam not found');
        }
        console.log(`✅ DEBUG: Exam found: ${examData.examName}, subjects: ${examData.subjects?.length || 0}`);
        
        // Find subject name first
        const subjectData = examData.subjects?.find(s => s.subjectId === subjectId);
        if (!subjectData) {
            console.log(`❌ DEBUG: Subject not found: ${subjectId} in exam ${examId}`);
            console.log(`📄 DEBUG: Available subjects:`, examData.subjects?.map(s => s.subjectId) || []);
            return res.status(404).send('Subject not found');
        }
        console.log(`✅ DEBUG: Subject found: ${subjectData.subjectName}`);
        
        // Get question papers using MongoDB service
        console.log(`📄 DEBUG: Getting question papers for ${examId}/${subjectId}...`);
        const questionPapers = await examService.getQuestionPapers(examId, subjectId);
        console.log(`✅ DEBUG: Question papers loaded: ${questionPapers?.length || 0} papers`);
        
        if (questionPapers?.length > 0) {
            console.log(`📄 DEBUG: First paper:`, {
                id: questionPapers[0].questionPaperId,
                name: questionPapers[0].questionPaperName,
                questionCount: questionPapers[0].questionCount
            });
        }
        
        // Define possible sections
        const sections = ["Previous Year", "Section I", "Section II", "Section III"];
        
        // Filter sections that have actual data
        const availableSections = sections.filter(section => {
            return questionPapers?.find(qp => qp.section === section);
        });
        console.log(`📄 DEBUG: Available sections:`, availableSections);

        res.render('questionPapers', { 
            exam: examId,
            subject: subjectId,
            examName: examData.examName,
            subjectName: subjectData.subjectName,
            questionPapers: questionPapers || [],
            sections: availableSections,
            subjects: examData.subjects || []
        });
    } catch (error) {
        console.error(`❌ DEBUG: Error in questionPapers route:`, error);
        console.error(`❌ DEBUG: Stack trace:`, error.stack);
        res.status(500).send(`Error loading question papers: ${error.message}`);
    }
}));
module.exports = router;
