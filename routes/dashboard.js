// /Volumes/Macintosh HD/Users/burnt/Documents/workspace/DevOps/Terraform/eatpl/routes/dashboard.js
const express = require('express');
const router = express.Router();
const { 
    getQuestions, 
    saveQuestions, 
    getAllExams, 
    getExamById, 
    getSubjectsByExam, 
    getQuestionsByPaper,
    healthCheck 
} = require('../utils/dataHelpers');
const path = require('path');

// Authentication middleware
const authenticateDashboard = (req, res, next) => {
  // Check if dashboard authentication is enabled
  const authEnabled = process.env.DASHBOARD_AUTH_ENABLED === 'true';
  
  if (!authEnabled) {
    // Skip authentication in development or when disabled
    return next();
  }
  
  // TODO: Implement proper authentication logic here
  // For now, allow access but log the attempt
  console.log('🔐 Dashboard access attempt from:', req.ip);
  
  // You can implement session-based auth, JWT, or basic auth here
  const isAuthenticated = true; // Replace with actual auth logic
  
  if (isAuthenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Apply authentication middleware to ALL routes in this router
router.use(authenticateDashboard);

router.get('/', async (req, res) => {
  try {
    console.log('🏠 Loading dashboard - fetching exams and stats from MongoDB...');
    
    let exams = [];
    let health = { status: 'unknown', dataSource: 'none' };
    let dashboardStats = {
      totalExams: 0,
      totalSubjects: 0,
      totalPapers: 0,
      totalQuestions: 0
    };
    
    try {
      // Get basic exams list (without subjects for performance)
      exams = await getAllExams();
      
      // Get health check info
      health = await healthCheck();
      
      // Get dashboard stats directly from MongoDB for accurate counts
      const mongoService = require('../services/mongoService');
      const db = await mongoService.connect();
      
      // Get actual counts from MongoDB collections
      const [examCount, subjectCount, paperCount, questionCount] = await Promise.all([
        db.collection('exams').countDocuments({ isActive: true }),
        db.collection('subjects').countDocuments(),
        db.collection('questionPapers').countDocuments(),
        db.collection('questions').countDocuments()
      ]);
      
      dashboardStats = {
        totalExams: examCount,
        totalSubjects: subjectCount,
        totalPapers: paperCount,
        totalQuestions: questionCount
      };
      
      // For the exam cards, we need to get subject/question counts per exam
      for (let exam of exams) {
        const examSubjects = await db.collection('subjects').find({ examId: exam.examId }).toArray();
        const examQuestions = await db.collection('questions').countDocuments({ examId: exam.examId });
        
        exam.subjects = examSubjects; // Add subjects for template calculations
        exam.totalQuestions = examQuestions;
      }
      
      console.log(`✅ Dashboard loaded ${exams.length} exams with stats: ${dashboardStats.totalSubjects} subjects, ${dashboardStats.totalQuestions} questions`);
    } catch (dbError) {
      console.error('⚠️ Database connection failed, showing empty dashboard:', dbError.message);
      // Continue with empty data instead of failing completely
      exams = [];
      health = { 
        status: 'error', 
        dataSource: 'none',
        error: dbError.message 
      };
    }
    
    // Handle case where data is empty or invalid
    if (!exams || !Array.isArray(exams)) {
      console.warn('Invalid exams data, using empty array');
      exams = [];
    }

    res.render('dashboard/index', {
      title: 'Dashboard',
      message: 'Welcome to the Exam Management Dashboard',
      data: { 
        exams, 
        source: health.dataSource,
        stats: dashboardStats
      },
      currentPage: 'overview',
      exams: exams,
      totalExams: dashboardStats.totalExams,
      totalSubjects: dashboardStats.totalSubjects,
      totalPapers: dashboardStats.totalPapers,
      totalQuestions: dashboardStats.totalQuestions,
      dataSource: health.dataSource || 'unknown',
      health: health,
      hasError: health.status === 'error',
      errorMessage: health.error || null
    });
  } catch (error) {
    console.error('❌ Dashboard critical error:', error);
    
    // Render dashboard with error state instead of failing completely
    res.render('dashboard/index', {
      title: 'Dashboard - Error',
      message: 'Dashboard encountered an error',
      data: { exams: [], source: 'error', stats: { totalExams: 0, totalSubjects: 0, totalPapers: 0, totalQuestions: 0 } },
      currentPage: 'overview',
      exams: [],
      totalExams: 0,
      totalSubjects: 0,
      totalPapers: 0,
      totalQuestions: 0,
      dataSource: 'error',
      health: { status: 'error', error: error.message },
      hasError: true,
      errorMessage: error.message
    });
  }
});

// Route for subjects under a specific exam 
router.get('/subjects/:examId', async (req, res) => {
  try {
    const { examId } = req.params;
    
    console.log(`📚 Loading subjects for exam: ${examId} from MongoDB...`);
    
    // Use MongoDB-aware function for better performance
    const examData = await getExamById(examId);
    
    if (!examData) {
      console.error(`Exam not found with ID: ${examId}`);
      return res.status(404).send('Exam not found');
    }
    
    if (!examData.subjects || !Array.isArray(examData.subjects)) {
      console.error(`Invalid subjects data for exam: ${examId}`, examData);
      return res.status(500).send('Invalid subject data structure');
    }

    // Calculate question count for each subject
    const subjectsWithCount = examData.subjects.map(subject => {
      let questionCount = 0;
      if (subject.questionPapers && Array.isArray(subject.questionPapers)) {
        questionCount = subject.questionPapers.reduce((total, paper) => {
          return total + (paper.questions ? paper.questions.length : 0);
        }, 0);
      }
      return {
        ...subject,
        questionCount
      };
    });

    console.log(`✅ Loaded ${subjectsWithCount.length} subjects for ${examData.examName}`);

    res.render('dashboard/subjects', {
      examData,
      subjects: subjectsWithCount,
      currentPage: 'subjects',
      examName: examData.examName,
      examId: examId
    });
  } catch (error) {
    console.error('❌ Error loading subjects:', error);
    res.status(500).send('Error loading subjects: ' + error.message);
  }
});

// Route for questions under a specific subject
router.get('/questions/:examId/:subjectId', async (req, res) => {
  try {
    const { examId, subjectId } = req.params;
    
    console.log(`❓ Loading questions for exam: ${examId}, subject: ${subjectId}`);
    
    // Use MongoDB-aware function for better performance
    const examData = await getExamById(examId);
    
    if (!examData) {
      console.error(`Exam not found with ID: ${examId}`);
      return res.status(404).send('Exam not found');
    }

    // Find the subject
    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    
    if (!subjectData) {
      console.error(`Subject not found with ID: ${subjectId} in exam: ${examId}`);
      return res.status(404).send('Subject not found');
    }

    console.log(`✅ Found subject: ${subjectData.subjectName}`);

    res.render('dashboard/questions', {
      examData,
      subjectData,
      examName: examData.examName,
      currentPage: 'questions'
    });
  } catch (error) {
    console.error('❌ Error loading questions:', error);
    res.status(500).send('Error loading questions: ' + error.message);
  }
});

router.get('/questionPapers/:examId/:subjectId', async (req, res) => {
  try {
    const { examId, subjectId } = req.params;
    
    console.log(`📄 Loading question papers for exam: ${examId}, subject: ${subjectId}`);
    
    // Use MongoDB-aware function for better performance
    const examData = await getExamById(examId);
    
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
    
    console.log(`✅ Found ${questionPapers.length} question papers for ${subjectData.subjectName}`);

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
    console.error('❌ Error loading question papers:', error);
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
    
    console.log(`📝 Loading questions for paper: ${questionPaperId} in ${examId}/${subjectId}`);
    
    // Use MongoDB-aware function to get questions directly
    const questions = await getQuestionsByPaper(examId, subjectId, questionPaperId);
    
    // Also get exam and subject data for context
    const examData = await getExamById(examId);
    
    if (!examData) {
      console.error(`Exam not found with ID: ${examId}`);
      return res.status(404).send('Exam not found');
    }

    // Find the subject
    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      console.error(`Subject not found with ID: ${subjectId} in exam: ${examId}`);
      return res.status(404).send('Subject not found');
    }

    // Format questions
    const formattedQuestions = questions.map(question => {
      return {
        ...question,
        question: formatQuestion(question.question || ''),
        explanation: formatQuestion(question.explanation || '')
      };
    });

    console.log(`✅ Loaded ${formattedQuestions.length} questions for paper ${questionPaperId}`);

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
    console.error('❌ Error loading questions:', error);
    res.status(500).send('Error loading questions: ' + error.message);
  }
});

// Route for creating a new exam
router.post('/exams', async (req, res) => {
  try {
    const { examName, examType } = req.body;
    if (!examName) {
      return res.status(400).json({ error: 'Exam name is required' });
    }

    console.log(`📝 Creating new exam: ${examName} (${examType})`);
    
    const examId = examName.toLowerCase().replace(/\s+/g, '-');
    
    // Check if exam already exists using MongoDB
    const existingExam = await getExamById(examId);
    if (existingExam) {
      return res.status(400).json({ error: 'Exam already exists' });
    }

    const newExam = {
      examId,
      examName,
      isActive: true,
      disabled: false,
      createdAt: new Date(),
      // Set default structure based on exam type
      ...(examType === 'complex' ? {
        subExams: []
      } : {
        subjects: []
      })
    };

    // Save to MongoDB directly
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    await db.collection('exams').insertOne(newExam);
    
    console.log(`✅ Created exam: ${examId}`);
    
    // Redirect back to dashboard with success message
    res.redirect('/dashboard?reload=true');
  } catch (error) {
    console.error('❌ Error creating exam:', error);
    res.status(500).json({ error: 'Failed to create exam: ' + error.message });
  }
});

// Route for deleting an exam
router.post('/exams/delete', async (req, res) => {
  try {
    const { examId } = req.body;
    
    if (!examId) {
      return res.status(400).json({ error: 'Exam ID is required' });
    }
    
    console.log(`🗑️ Deleting exam: ${examId}`);
    
    // Check if exam exists using MongoDB
    const existingExam = await getExamById(examId);
    if (!existingExam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Delete from MongoDB directly
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Delete exam and related data
    await db.collection('exams').deleteOne({ examId });
    await db.collection('subjects').deleteMany({ examId });
    await db.collection('questionPapers').deleteMany({ examId });
    await db.collection('questions').deleteMany({ examId });
    
    console.log(`✅ Deleted exam: ${examId} and all related data`);
    
    // Clear cache to ensure deleted exam doesn't appear anywhere
    const examService = require('../services/examService');
    examService.clearCache();
    console.log(`🧹 Cache cleared after deleting exam: ${examId}`);
    
    res.json({ success: true, message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting exam:', error);
    res.status(500).json({ error: 'Failed to delete exam: ' + error.message });
  }
});

module.exports = router;
