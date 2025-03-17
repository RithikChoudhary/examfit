// /Volumes/Macintosh HD/Users/burnt/Documents/workspace/DevOps/Terraform/eatpl/routes/dashboard.js
const express = require('express');
const router = express.Router();
const { getQuestions, saveQuestions } = require('../utils/dataHelpers');
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
    
    // Handle case where data is empty or invalid
    if (!data || !data.exams || !Array.isArray(data.exams)) {
      console.error('Invalid data structure:', data);
      return res.status(500).send('Invalid data structure');
    }

    res.render('dashboard/index', {
      title: 'Dashboard',
      message: 'Welcome to the Exam Management Dashboard',
      data,
      currentPage: 'overview',
      exams: data.exams,
      totalExams: data.exams.length
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
    
    // Validate data structure
    if (!data || !data.exams || !Array.isArray(data.exams)) {
      console.error('Invalid data structure:', data);
      return res.status(500).send('Invalid data structure');
    }
    
    const { examId } = req.params;
    const examData = data.exams.find(e => e.examId === examId);
    
    if (!examData) {
      console.error(`Exam not found with ID: ${examId}`);
      return res.status(404).send('Exam not found');
    }
    
    if (!examData.subjects || !Array.isArray(examData.subjects)) {
      console.error(`Invalid subjects data for exam: ${examId}`, examData);
      return res.status(500).send('Invalid subject data structure');
    }

    res.render('dashboard/subjects', {
      examData,
      subjects: examData.subjects,
      currentPage: 'subjects',
      examName: examData.examName,
      examId: examId
    });
  } catch (error) {
    console.error('Error loading subjects:', error);
    res.status(500).send('Error loading subjects: ' + error.message);
  }
});

// Route for questions under a specific subject
router.get('/questions/:examId/:subjectId', async (req, res) => {
  try {
    const data = await getQuestions();
    const { examId, subjectId } = req.params;
    const examData = data.exams.find(e => e.examId === examId);
    
    if (!examData) {
      return res.status(404).send('Exam not found');
    }

    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    
    if (!subjectData) {
      return res.status(404).send('Subject not found');
    }

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

    // Validate data structure
    if (!data || !data.exams || !Array.isArray(data.exams)) {
      console.error('Invalid data structure:', data);
      return res.status(500).send('Invalid data structure');
    }

    // Find the exam
    const examData = data.exams.find(e => e.examId === examId);
    if (!examData) {
      console.error(`Exam not found with ID: ${examId}`);
      return res.status(404).send('Exam not found');
    }

    // Validate subjects array
    if (!examData.subjects || !Array.isArray(examData.subjects)) {
      console.error(`Invalid subjects data for exam: ${examId}`, examData);
      return res.status(500).send('Invalid subject data structure');
    }

    // Find the subject
    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      console.error(`Subject not found with ID: ${subjectId} in exam: ${examId}`);
      return res.status(404).send('Subject not found');
    }

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
    console.error('Error loading question papers:', error);
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

    // Validate data structure
    if (!data || !data.exams || !Array.isArray(data.exams)) {
      console.error('Invalid data structure:', data);
      return res.status(500).send('Invalid data structure');
    }

    // Find the exam
    const examData = data.exams.find(e => e.examId === examId);
    if (!examData) {
      console.error(`Exam not found with ID: ${examId}`);
      return res.status(404).send('Exam not found');
    }

    // Validate subjects array
    if (!examData.subjects || !Array.isArray(examData.subjects)) {
      console.error(`Invalid subjects data for exam: ${examId}`, examData);
      return res.status(500).send('Invalid subject data structure');
    }

    // Find the subject
    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      console.error(`Subject not found with ID: ${subjectId} in exam: ${examId}`);
      return res.status(404).send('Subject not found');
    }

    // Validate question papers array
    if (!subjectData.questionPapers || !Array.isArray(subjectData.questionPapers)) {
      console.error(`Invalid question papers data for subject: ${subjectId}`, subjectData);
      return res.status(500).send('Invalid question papers data structure');
    }

    // Find the question paper
    const questionPaper = subjectData.questionPapers.find(qp => qp.questionPaperId === questionPaperId);
    if (!questionPaper) {
      console.error(`Question paper not found with ID: ${questionPaperId} in subject: ${subjectId}`);
      return res.status(404).send('Question paper not found');
    }

    // Validate questions array
    if (!questionPaper.questions || !Array.isArray(questionPaper.questions)) {
      console.error(`Invalid questions data for paper: ${questionPaperId}`, questionPaper);
      return res.status(500).send('Invalid questions data structure');
    }

    // Format questions
    const formattedQuestions = questionPaper.questions.map(question => {
      return {
        ...question,
        question: formatQuestion(question.question || ''),
        explanation: formatQuestion(question.explanation || '')
      };
    });

    // Render the template
    res.render('dashboard/questions', {
      examData,
      subjectData,
      questions: formattedQuestions, // Use the formatted questions
      currentPage: 'questions',
      paperId: questionPaperId,
      sections: ["PYQ", "Section I", "Section II", "Section III"]
    });

  } catch (error) {
    console.error('Error loading questions:', error);
    res.status(500).send('Error loading questions: ' + error.message);
  }
});

// Route for creating a new exam
router.post('/exams', express.json(), async (req, res) => {
  try {
    const { examName, examType } = req.body;
    if (!examName) {
      return res.status(400).json({ error: 'Exam name is required' });
    }

    const data = await getQuestions();
    const examId = examName.toLowerCase().replace(/\s+/g, '-');
    
    if (data.exams.some(e => e.examId === examId)) {
      return res.status(400).json({ error: 'Exam already exists' });
    }

    const newExam = {
      examId,
      examName,
      disabled: false,
      // Set default structure based on exam type
      ...(examType === 'complex' ? {
        subExams: []
      } : {
        subjects: []
      })
    };

    data.exams.push(newExam);
    await saveQuestions(data);
    
    // Redirect back to dashboard with success message
    res.redirect('/dashboard?reload=true');
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ error: 'Failed to create exam: ' + error.message });
  }
});

// Route for deleting an exam
router.post('/exams/delete', express.json(), async (req, res) => {
  try {
    const { examId } = req.body;
    
    if (!examId) {
      return res.status(400).json({ error: 'Exam ID is required' });
    }
    
    const data = await getQuestions();
    const examIndex = data.exams.findIndex(e => e.examId === examId);
    
    if (examIndex === -1) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Remove the exam
    data.exams.splice(examIndex, 1);
    await saveQuestions(data);
    
    res.json({ success: true, message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('Error deleting exam:', error);
    res.status(500).json({ error: 'Failed to delete exam: ' + error.message });
  }
});

module.exports = router;
