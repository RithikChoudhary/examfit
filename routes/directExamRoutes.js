// /Volumes/Macintosh HD/Users/burnt/Documents/workspace/DevOps/Terraform/eatpl/routes/directExamRoutes.js
const express = require('express');
const router = express.Router();
const { getQuestions } = require('../utils/dataHelpers');


router.get('/:exam/questions/:subject', async (req, res) => {
    try {
        const data = await getQuestions();
        const { exam, subject } = req.params;

        const examData = data.exams.find(e => e.examId === exam);
        if (!examData) {
            return res.status(404).send('Exam not found');
        }

        // Find subject in regular exam subjects (CGL)
        const subjectData = examData.subjects.find(s => s.subjectId === subject);
        if (!subjectData) {
            return res.status(404).send('Subject not found');
        }

        res.render('questions', { 
            exam,
            examName: examData.examName,
            subject,
            subjectName: subjectData.subjectName,
            questions: subjectData.questions,
            subjects: examData.subjects 
        });

    } catch (error) {
        console.error('Error loading CGL. questions:', error);
        res.status(500).send('Error loading.cgl. questions');
    }
});

module.exports = router;
