// /Volumes/Macintosh HD/Users/burnt/Documents/workspace/DevOps/Terraform/eatpl/routes/dashboard.js
const express = require('express');
const router = express.Router();
const { getQuestions } = require('../utils/dataHelpers');
const path = require('path');

// Authentication middleware
const authenticateDashboard = (req, res, next) => {
  // 1. Your authentication check logic here 
  const isAuthenticated = true; // **REPLACE with your actual check!**

  if (isAuthenticated) {
    next(); // Allow access to the route
  } else {
    res.redirect('/login'); // Redirect to login if not authenticated
  }
};

// Apply authentication middleware to ALL routes in this router
router.use(authenticateDashboard);

router.get('/', async (req, res) => {
  try {
    const data = await getQuestions();
    res.render('dashboard/index', {
      data,
      currentPage: 'overview'
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// Route for subjects under a specific exam 
router.get('/subjects/:examId', async (req, res) => {
  try {
    const data = await getQuestions();
    const { examId } = req.params; // Change here
    const examData = data.exams.find(e => e.examId === examId);

    res.render('dashboard/subjects', {
      examData,
      subjects: examData.subjects,
      currentPage: 'subjects',
      examName: examData.examName,
      examId: examId // Change here 
    });
  } catch (error) {
    res.status(500).send('Error loading subjects: ' + error.message);
  }
});

// Route for questions under a specific subject
router.get('/questions/:exam/:subject', async (req, res) => {
  try {
    const data = await getQuestions();
    const { exam, subject } = req.params;
    const examData = data.exams.find(e => e.examId === exam);
    const subjectData = examData.subjects.find(s => s.subjectId === subject);

    res.render('dashboard/questions', {
      examData,
      subjectData,
      examName: examData.examName,
      currentPage: 'questions'
    });
  } catch (error) {
    res.status(500).send('Error loading questions: ' + error.message);
  }
});

router.get('/questionPapers/:examId/:subjectId', async (req, res) => {
  try {
    const { examId, subjectId } = req.params;
    const data = await getQuestions();

    // Find the exam
    const examData = data.exams.find(e => e.examId === examId);
    if (!examData) return res.status(404).send('Exam not found');

    // Find the subject
    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subjectData) return res.status(404).send('Subject not found');

    // Get question papers (make sure subjectData has a questionPapers property!)
    const questionPapers = subjectData.questionPapers || [];  // Handle case where there are no question papers

    res.render('dashboard/questionPapers', {
      examData,
      subjectData,
      currentPage: 'questionPapers',
      examId: examId,
      subjectId: subjectId,
      examName: examData.examName,
      subjectName: subjectData.subjectName,
      questionPapers: questionPapers
    });

  } catch (error) {
    res.status(500).send('Error loading question papers: ' + error.message);
  }
});

const formatQuestion = (question) => {
  // First, trim any leading/trailing whitespace
  let formattedQuestion = question.trim();

  // Replace multiple consecutive newlines with a single newline
  formattedQuestion = formattedQuestion.replace(/\n{2,}/g, '\n');

  // If the question contains numbered lines, ensure proper formatting
  if (/^\d+\./.test(formattedQuestion)) {
    // Split the question into lines
    const lines = formattedQuestion.split('\n');
    
    // Process lines to ensure proper numbering and spacing
    const processedLines = lines.map((line, index) => {
      // Check if the line starts with a number
      if (/^\d+\./.test(line.trim())) {
        // Ensure single space after the number and period
        return line.replace(/^(\d+\.)(\S)/, '$1 $2');
      }
      return line;
    });

    // Join the lines back together
    formattedQuestion = processedLines.join('\n');
  }

  return formattedQuestion;
};


router.get('/questions/:examId/:subjectId/:questionPaperId', async (req, res) => {
  try {
    const { examId, subjectId, questionPaperId } = req.params;
    const data = await getQuestions();

    // Find the exam, subject, and question paper
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
      return res.status(404).send('Question paper not found');
    }

    // Format questions
    const formattedQuestions = questionPaper.questions.map(question => {
      return {
        ...question,
        question: formatQuestion(question.question),
        explanation: formatQuestion(question.explanation || '')
      };
    });

    // Render the template
    res.render('dashboard/questions', {
      examData,
      subjectData,
      questions: questionPaper.questions,
      currentPage: 'questions',
      paperId: questionPaperId,
      sections: ["PYQ", "Section I", "Section II", "Section III"]
    });

  } catch (error) {
    console.error('Error loading questions:', error);
    res.status(500).send('Error loading questions: ' + error.message);
  }
});



module.exports = router;
