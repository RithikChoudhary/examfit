// routes/exam.js
const express = require('express');
const router = express.Router();
const { getQuestions } = require('../utils/dataHelpers');

// Route for displaying subjects for a specific exam (e.g., /upsc or /cgl)
router.get('/:exam', async (req, res) => {
  try {
    const data = await getQuestions();
    const examId = req.params.exam.toLowerCase();
    const examData = data.exams.find(e => e.examId === examId);

    if (!examData) {
      return res.status(404).send('Exam not found');
    }

    // Create a Set to track unique subject IDs
    const seenSubjects = new Set();
    const uniqueSubjects = examData.subjects.filter(subject => {
      const subjectId = subject.subjectId;
      if (!seenSubjects.has(subjectId)) {
        seenSubjects.add(subjectId);
        return true;
      }
      return false;
    });

    res.render('subjects', { 
      exam: examId,
      examName: examData.examName,
      subjects: uniqueSubjects
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error loading exam data');
  }
});

// Route for displaying question papers for a subject within an exam
router.get('/:exam/:subject/questionPapers', async (req, res) => { 
  try {
    const data = await getQuestions();
    const { exam: examId, subject: subjectId } = req.params;

    const examData = data.exams.find(e => e.examId === examId);
    if (!examData) return res.status(404).send('Exam not found');

    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subjectData) return res.status(404).send('Subject not found');

    res.render('questionPapers', { 
      exam: examId,
      examName: examData.examName,
      subject: subjectId,
      subjectName: subjectData.subjectName,
      questionPapers: subjectData.questionPapers || [],
      subjects: examData.subjects
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error loading question papers');
  }
});
router.get('/:exam/:subject', async (req, res) => {
  try {
    const data = await getQuestions();
    const examId = req.params.exam.toLowerCase();
    const subjectId = req.params.subject.toLowerCase();

    const examData = data.exams.find(e => e.examId === examId);
    if (!examData) {
      return res.status(404).send('Exam not found');
    }

    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      return res.status(404).send('Subject not found');
    }

    res.render('subject-questions', { 
      exam: examId,
      subject: subjectId,
      questions: subjectData.questions,
      examName: examData.examName,
      subjectName: subjectData.subjectName
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error loading questions');
  }
});

// Route for displaying questions for a specific question paper
router.get('/:exam/:subject/:questionPaper/questions', async (req, res) => {
  try {
    const data = await getQuestions();
    const { exam: examId, subject: subjectId, questionPaper: questionPaperId } = req.params;

    const examData = data.exams.find(e => e.examId === examId);
    if (!examData) {
      return res.status(404).send('Exam not found');
    }

    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      return res.status(404).send('Subject not found');
    }

    const questionPaper = subjectData.questionPapers.find(qp => qp.questionPaperId === questionPaperId);
    if (!questionPaper) {
      return res.status(404).send('Question Paper not found');
    }
    res.render('questions', {
      exam: examId,
      examName: examData.examName,
      subject: subjectId, 
      subjectName: subjectData.subjectName,
      questionPaper: questionPaperId, 
      questionPaperName: questionPaper.questionPaperName,
      questions: questionPaper.questions,
      subjects: examData.subjects
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error loading questions');
  }
});

module.exports = router;
