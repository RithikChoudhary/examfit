const express = require('express');
const router = express.Router();
const { getQuestions, saveQuestions } = require('../utils/dataHelpers');
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

async function findExamAndSubject(examId, subjectId) {
  const data = await getQuestions();
  const examData = data.exams.find(e => e.examId === examId);
  if (!examData) {
    throw new Error('Exam not found');
  }
  if (subjectId) {
    const subject = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subject) {
      throw new Error('Subject not found');
    }
    return { data, examData, subject };
  }
  return { data, examData };
}

router.post('/subjects', express.json(), async (req, res) => {
  try {
    const { examId, subjectName } = req.body;
    const subjectId = subjectName.toLowerCase().replace(/\s+/g, '-');
    const { data, examData } = await findExamAndSubject(examId);
    
    if (examData.subjects.some(s => s.subjectId === subjectId)) {
      return res.status(400).json({ error: 'Subject already exists' });
    }

    const newSubject = { subjectId, subjectName, questionPapers: [], questions: [] };
    examData.subjects.push(newSubject);
    await saveQuestions(data);
    res.json({ success: true, subject: newSubject });
  } catch (error) {
    console.error('Error adding subject:', error);
    res.status(500).json({ error: 'Failed to add subject: ' + error.message });
  }
});

router.get('/subjects/:examId', async (req, res) => {
  try {
    const { data, examData } = await findExamAndSubject(req.params.examId);
    res.json({ subjects: examData.subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});
router.get('/questions/:examId/:subjectId', async (req, res) => {
  try {
    const { examId, subjectId } = req.params;
    const data = await getQuestions();
    const examData = data.exams.find(e => e.examId === examId);
    if (!examData) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    if (!subjectData) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // Flatten all questions from all papers
    const questions = subjectData.questionPapers.reduce((allQuestions, paper) => {
      return allQuestions.concat(paper.questions || []);
    }, []);

    res.render('dashboard/questions', {
      examData,
      subjectData,
      questions: questions || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading questions');
  }
});
// Add this route to your api.js file (uncomment and update it)
// Backend - Update the PUT route
router.put('/questions/:examId/:subjectId/:questionId', express.json(), async (req, res) => {
  try {
      const { examId, subjectId, questionId } = req.params;
      const { question, options, correctOption, explanation } = req.body;

      const data = await getQuestions();
      const exam = data.exams.find(e => e.examId === examId);
      if (!exam) return res.status(404).json({ error: 'Exam not found' });

      const subject = exam.subjects.find(s => s.subjectId === subjectId);
      if (!subject) return res.status(404).json({ error: 'Subject not found' });

      let questionFound = false;
      for (const paper of subject.questionPapers) {
          const questionIndex = paper.questions.findIndex(q => q.questionId === questionId);
          if (questionIndex !== -1) {
              paper.questions[questionIndex] = {
                  questionId,
                  question,
                  options,
                  correctOption,
                  explanation
              };
              questionFound = true;
              break;
          }
      }

      if (!questionFound) return res.status(404).json({ error: 'Question not found' });

      await saveQuestions(data);
      res.json({ success: true });
  } catch (error) {
      console.error('Error updating question:', error);
      res.status(500).json({ error: 'Failed to update question' });
  }
});
router.delete('/subjects/:examId/:subjectId', async (req, res) => {
  try {
    const { examId, subjectId } = req.params;
    const { data, examData } = await findExamAndSubject(examId);
    
    const subjectIndex = examData.subjects.findIndex(s => s.subjectId === subjectId);
    if (subjectIndex === -1) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    examData.subjects.splice(subjectIndex, 1);
    await saveQuestions(data);
    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: 'Failed to delete subject: ' + error.message });
  }
});

router.post('/questions/:examId/:subjectId/:paperId', express.json(), async (req, res) => {
  try {
      const { examId, subjectId, paperId } = req.params;
      console.log('Adding question to:', { examId, subjectId, paperId }); // Debug log

      const data = await getQuestions();
      const exam = data.exams.find(e => e.examId === examId);
      if (!exam) return res.status(404).json({ error: 'Exam not found' });

      const subject = exam.subjects.find(s => s.subjectId === subjectId);
      if (!subject) return res.status(404).json({ error: 'Subject not found' });

      const questionPaper = subject.questionPapers.find(qp => qp.questionPaperId === paperId);
      if (!questionPaper) return res.status(404).json({ error: 'Question paper not found' });

      // Create and add question
      const newQuestion = {
          questionId: `q${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          question: req.body.question,
          options: req.body.options,
          correctOption: req.body.correctOption,
          explanation: req.body.explanation
      };

      questionPaper.questions.push(newQuestion);
      await saveQuestions(data);
      res.status(201).json({ message: 'Question added successfully', question: newQuestion });
  } catch (error) {
      console.error('Error adding question:', error);
      res.status(500).json({ error: error.message });
  }
});

// router.post('/questionPapers', express.json(), async (req, res) => {
//   try {
//     const { examId, subjectId, paperName } = req.body;
//     const { data, subject } = await findExamAndSubject(examId, subjectId);

//     const newQuestionPaper = {
//       questionPaperId: `qp-${Date.now()}`,
//       questionPaperName: paperName,
//       questions: []
//     };
    
//     subject.questionPapers.push(newQuestionPaper);
//     await saveQuestions(data);
//     res.json({ success: true, questionPaper: newQuestionPaper });
//   } catch (error) {
//     console.error('Error adding question paper:', error);
//     res.status(500).json({ error: 'Failed to add question paper: ' + error.message });
//   }
// });

router.post('/questionPapers', express.json(), async (req, res) => {
  try {
    const { examId, subjectId, paperName, paperSection } = req.body; 
    const data = await getQuestions();

    const examIndex = data.exams.findIndex(e => e.examId === examId);
    if (examIndex === -1) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const subjectIndex = data.exams[examIndex].subjects.findIndex(s => s.subjectId === subjectId);
    if (subjectIndex === -1) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // Construct the question paper name
    const fullPaperName = `${paperSection} - ${paperName}`; 

    const newQuestionPaper = {
      questionPaperId: `qp-${Date.now()}`,
      questionPaperName: paperName, 
      section: paperSection, 
      questions: []
    };

    data.exams[examIndex].subjects[subjectIndex].questionPapers.push(newQuestionPaper);
    await saveQuestions(data);
    res.json({ success: true, questionPaper: newQuestionPaper });
  } catch (error) {
    console.error('Error adding question paper:', error);
    res.status(500).json({ error: 'Failed to add question paper: ' + error.message });
  }
});
// Add the delete route to api.js
router.delete('/questions/:examId/:subjectId/:questionId', express.json(), async (req, res) => {
  try {
    const { examId, subjectId, questionId } = req.params;
    const data = await getQuestions();
    const exam = data.exams.find(e => e.examId === examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
 
    const subject = exam.subjects.find(s => s.subjectId === subjectId);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
 
    let questionDeleted = false;
    for (const paper of subject.questionPapers) {
      const questionIndex = paper.questions.findIndex(q => q.questionId === questionId);
      if (questionIndex !== -1) {
        paper.questions.splice(questionIndex, 1);
        questionDeleted = true;
        break;
      }
    }
 
    if (!questionDeleted) return res.status(404).json({ error: 'Question not found' });
 
    await saveQuestions(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
 });
 
router.get('/questions/:examId/:subjectId/:paperId', async (req, res) => {
  try {
    const { examId, subjectId, paperId } = req.params;
    const data = await getQuestions();
    const examData = data.exams.find(e => e.examId === examId);
    const subjectData = examData.subjects.find(s => s.subjectId === subjectId);
    const questionPaper = subjectData.questionPapers.find(qp => qp.questionPaperId === paperId);

    res.render('dashboard/questions', {
      examData,
      subjectData,
      questions: questionPaper.questions || [],
      paperId,
      currentPage: 'questions'
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading questions');
  }
});

router.post('/questions/:examId/:subjectId/:paperId/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { examId, subjectId, paperId } = req.params;
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawQuestions = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' });

    if (!rawQuestions.length) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    const expectedHeaders = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option'];
    const firstRow = rawQuestions[0];
    const missingHeaders = expectedHeaders.filter(header => !(header in firstRow));
    
    if (missingHeaders.length) {
      return res.status(400).json({ error: `Missing headers: ${missingHeaders.join(', ')}` });
    }

    const data = await getQuestions();
    const exam = data.exams.find(e => e.examId === examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const subject = exam.subjects.find(s => s.subjectId === subjectId);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const paper = subject.questionPapers.find(p => p.questionPaperId === paperId);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const processedQuestions = rawQuestions.map((q, index) => {
      if (!q.Question || !q['Option A'] || !q['Option B'] || !q['Option C'] || !q['Option D'] || !q['Correct Option']) {
        throw new Error(`Row ${index + 1} has missing required fields`);
      }

      if (!['a', 'b', 'c', 'd'].includes(String(q['Correct Option']).toLowerCase())) {
        throw new Error(`Row ${index + 1} has invalid Correct Option. Must be a, b, c, or d`);
      }

      return {
        questionId: `q${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        question: q.Question,
        options: [
          { optionId: 'a', text: q['Option A'] },
          { optionId: 'b', text: q['Option B'] },
          { optionId: 'c', text: q['Option C'] },
          { optionId: 'd', text: q['Option D'] }
        ],
        correctOption: String(q['Correct Option']).toLowerCase(),
        explanation: q.Explanation || ''
      };
    });

    paper.questions.push(...processedQuestions);
    await saveQuestions(data);
    res.json({ success: true, count: processedQuestions.length });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

// /Volumes/Macintosh HD/Users/burnt/Documents/workspace/DevOps/Terraform/eatpl/routes/api.js
// ... your other requires ... 

router.delete('/questionPapers/:examId/:subjectId/:questionPaperId', express.json(), async (req, res) => {
  try {
    const { examId, subjectId, questionPaperId } = req.params;
    const data = await getQuestions();

    const examIndex = data.exams.findIndex(e => e.examId === examId);
    if (examIndex === -1) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const subjectIndex = data.exams[examIndex].subjects.findIndex(s => s.subjectId === subjectId);
    if (subjectIndex === -1) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const paperIndex = data.exams[examIndex].subjects[subjectIndex].questionPapers.findIndex(
      qp => qp.questionPaperId === questionPaperId
    );

    if (paperIndex === -1) {
      return res.status(404).json({ error: 'Question paper not found' });
    }

    data.exams[examIndex].subjects[subjectIndex].questionPapers.splice(paperIndex, 1);
    await saveQuestions(data);
    res.json({ success: true }); 

  } catch (error) {
    console.error('Error deleting question paper:', error);
    res.status(500).json({ error: 'Failed to delete question paper' });
  }
});


module.exports = router;