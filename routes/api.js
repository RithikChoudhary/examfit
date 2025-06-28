const express = require('express');
const router = express.Router();
const { 
    getQuestions, 
    saveQuestions, 
    getExamById, 
    getSubjectsByExam, 
    getQuestionsByPaper,
    healthCheck 
} = require('../utils/dataHelpers');
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

async function findExamAndSubject(examId, subjectId) {
  try {
    console.log(`🔍 Finding exam: ${examId}, subject: ${subjectId || 'none'}`);
    
    // Use MongoDB directly
    const examData = await getExamById(examId);
    if (!examData) {
      throw new Error('Exam not found');
    }
    
    if (subjectId) {
      const subject = examData.subjects?.find(s => s.subjectId === subjectId);
      if (!subject) {
        throw new Error('Subject not found');
      }
      return { examData, subject };
    }
    
    console.log(`✅ Found exam: ${examData.examName} from MongoDB`);
    return { examData };
  } catch (error) {
    console.error(`❌ Error finding exam/subject:`, error);
    throw error;
  }
}

router.post('/subjects', express.json(), async (req, res) => {
  try {
    const { examId, subjectName } = req.body;
    
    console.log(`📚 Creating subject: ${subjectName} for exam: ${examId}`);
    
    if (!examId || !subjectName) {
      return res.status(400).json({ error: 'Missing required fields: examId, subjectName' });
    }
    
    const subjectId = subjectName.toLowerCase().replace(/\s+/g, '-');
    
    // Use MongoDB directly
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Verify exam exists
    const exam = await db.collection('exams').findOne({ examId, isActive: true });
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    // Check if subject already exists
    const existingSubject = await db.collection('subjects').findOne({ examId, subjectId });
    if (existingSubject) {
      return res.status(400).json({ error: 'Subject already exists' });
    }

    const newSubject = {
      examId,
      subjectId,
      subjectName,
      totalPapers: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert into MongoDB
    await db.collection('subjects').insertOne(newSubject);
    
    console.log(`✅ Created subject: ${subjectId}`);
    
    res.json({ 
      success: true, 
      subject: {
        subjectId,
        subjectName,
        questionPapers: [],
        questionCount: 0
      }
    });
  } catch (error) {
    console.error('❌ Error adding subject:', error);
    res.status(500).json({ error: 'Failed to add subject: ' + error.message });
  }
});

router.get('/subjects/:examId', async (req, res) => {
  try {
    const { examData } = await findExamAndSubject(req.params.examId);
    res.json({ subjects: examData.subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});
router.get('/questions/:examId/:subjectId', async (req, res) => {
  try {
    const { examId, subjectId } = req.params;
    
    console.log(`📋 Getting questions for: ${examId}/${subjectId}`);
    
    // Use MongoDB directly
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Verify exam exists
    const exam = await db.collection('exams').findOne({ examId, isActive: true });
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Verify subject exists
    const subject = await db.collection('subjects').findOne({ examId, subjectId });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // Get all questions for this subject
    const questions = await db.collection('questions').find({ examId, subjectId }).toArray();
    
    console.log(`✅ Found ${questions.length} questions for ${examId}/${subjectId}`);

    res.json({
      examData: exam,
      subjectData: subject,
      questions: questions || []
    });
  } catch (error) {
    console.error('❌ Error loading questions:', error);
    res.status(500).json({ error: 'Error loading questions: ' + error.message });
  }
});
// Add this route to your api.js file (uncomment and update it)
// Backend - Update the PUT route
router.put('/questions/:examId/:subjectId/:questionId', express.json(), async (req, res) => {
  try {
      const { examId, subjectId, questionId } = req.params;
      const { question, options, correctOption, explanation } = req.body;
      
      console.log(`✏️ Updating question: ${questionId} in ${examId}/${subjectId}`);
      
      if (!question || !options || !correctOption) {
        return res.status(400).json({ error: 'Missing required fields: question, options, correctOption' });
      }

      // Use MongoDB directly
      const mongoService = require('../services/mongoService');
      const db = await mongoService.connect();
      
      // Verify exam exists
      const exam = await db.collection('exams').findOne({ examId, isActive: true });
      if (!exam) return res.status(404).json({ error: 'Exam not found' });

      // Verify subject exists
      const subject = await db.collection('subjects').findOne({ examId, subjectId });
      if (!subject) return res.status(404).json({ error: 'Subject not found' });

      // Update the question
      const updateResult = await db.collection('questions').updateOne(
        { examId, subjectId, questionId },
        { 
          $set: {
            question,
            options,
            correctOption,
            explanation: explanation || '',
            updatedAt: new Date()
          }
        }
      );

      if (updateResult.matchedCount === 1) {
        console.log(`✅ Updated question: ${questionId}`);
        res.json({ success: true, message: 'Question updated successfully' });
      } else {
        console.log(`❌ Question not found: ${questionId}`);
        res.status(404).json({ error: 'Question not found' });
      }
  } catch (error) {
      console.error('❌ Error updating question:', error);
      res.status(500).json({ error: 'Failed to update question: ' + error.message });
  }
});
router.delete('/subjects/:examId/:subjectId', async (req, res) => {
  try {
    const { examId, subjectId } = req.params;
    
    console.log(`🗑️ Deleting subject: ${subjectId} from exam: ${examId}`);
    
    if (!examId || !subjectId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Use MongoDB directly
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Verify exam exists
    const exam = await db.collection('exams').findOne({ examId, isActive: true });
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    // Verify subject exists
    const subject = await db.collection('subjects').findOne({ examId, subjectId });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // Delete all related data in order: questions -> question papers -> subject
    const questionsDeleteResult = await db.collection('questions').deleteMany({ examId, subjectId });
    const papersDeleteResult = await db.collection('questionPapers').deleteMany({ examId, subjectId });
    const subjectDeleteResult = await db.collection('subjects').deleteOne({ examId, subjectId });

    if (subjectDeleteResult.deletedCount === 1) {
      console.log(`✅ Deleted subject: ${subjectId}, ${papersDeleteResult.deletedCount} papers, ${questionsDeleteResult.deletedCount} questions`);
      res.json({ 
        success: true, 
        message: 'Subject deleted successfully',
        deletedQuestions: questionsDeleteResult.deletedCount,
        deletedPapers: papersDeleteResult.deletedCount
      });
    } else {
      console.log(`❌ Failed to delete subject: ${subjectId}`);
      res.status(500).json({ error: 'Failed to delete subject' });
    }
  } catch (error) {
    console.error('❌ Error deleting subject:', error);
    res.status(500).json({ error: 'Failed to delete subject: ' + error.message });
  }
});

router.post('/questions/:examId/:subjectId/:paperId', express.json(), async (req, res) => {
  try {
      const { examId, subjectId, paperId } = req.params;
      const { question, options, correctOption, explanation } = req.body;
      
      console.log(`❓ Adding question to: ${examId}/${subjectId}/${paperId}`);
      
      if (!question || !options || !correctOption) {
        return res.status(400).json({ error: 'Missing required fields: question, options, correctOption' });
      }

      // Use MongoDB directly
      const mongoService = require('../services/mongoService');
      const db = await mongoService.connect();
      
      // Verify exam exists
      const exam = await db.collection('exams').findOne({ examId, isActive: true });
      if (!exam) return res.status(404).json({ error: 'Exam not found' });

      // Verify subject exists
      const subject = await db.collection('subjects').findOne({ examId, subjectId });
      if (!subject) return res.status(404).json({ error: 'Subject not found' });

      // Verify question paper exists
      const questionPaper = await db.collection('questionPapers').findOne({ 
        examId, 
        subjectId, 
        $or: [{ paperId: paperId }, { questionPaperId: paperId }]
      });
      if (!questionPaper) return res.status(404).json({ error: 'Question paper not found' });

      // Create new question
      const questionId = `q${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newQuestion = {
          questionId,
          question,
          options,
          correctOption,
          explanation: explanation || '',
          examId,
          subjectId,
          paperId: questionPaper.paperId || questionPaper.questionPaperId,
          createdAt: new Date(),
          updatedAt: new Date()
      };

      // Insert into MongoDB
      await db.collection('questions').insertOne(newQuestion);
      
      console.log(`✅ Created question: ${questionId}`);
      
      res.status(201).json({ 
        success: true,
        message: 'Question added successfully', 
        question: {
          questionId,
          question,
          options,
          correctOption,
          explanation: explanation || ''
        }
      });
  } catch (error) {
      console.error('❌ Error adding question:', error);
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
    
    console.log(`📝 Creating question paper: ${paperName} for ${examId}/${subjectId}`);
    
    if (!examId || !subjectId || !paperName) {
      return res.status(400).json({ error: 'Missing required fields: examId, subjectId, paperName' });
    }

    // Use MongoDB directly for better performance
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Verify exam exists
    const exam = await db.collection('exams').findOne({ examId, isActive: true });
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    // Verify subject exists
    const subject = await db.collection('subjects').findOne({ examId, subjectId });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const paperId = `qp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newQuestionPaper = {
      paperId,
      questionPaperId: paperId, // For compatibility
      paperName,
      questionPaperName: paperName, // For compatibility
      section: paperSection || '',
      examId,
      subjectId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert into MongoDB
    await db.collection('questionPapers').insertOne(newQuestionPaper);
    
    console.log(`✅ Created question paper: ${paperId}`);
    
    res.json({ 
      success: true, 
      questionPaper: {
        questionPaperId: paperId,
        questionPaperName: paperName,
        section: paperSection || '',
        questions: []
      }
    });
  } catch (error) {
    console.error('❌ Error adding question paper:', error);
    res.status(500).json({ error: 'Failed to add question paper: ' + error.message });
  }
});
// Add the delete route to api.js
router.delete('/questions/:examId/:subjectId/:questionId', express.json(), async (req, res) => {
  try {
    const { examId, subjectId, questionId } = req.params;
    
    console.log(`🗑️ Deleting question: ${questionId} from ${examId}/${subjectId}`);
    
    if (!examId || !subjectId || !questionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Use MongoDB directly
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Verify exam exists
    const exam = await db.collection('exams').findOne({ examId, isActive: true });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
 
    // Verify subject exists
    const subject = await db.collection('subjects').findOne({ examId, subjectId });
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
 
    // Find and delete the question
    const deleteResult = await db.collection('questions').deleteOne({ 
      examId, 
      subjectId, 
      questionId 
    });
 
    if (deleteResult.deletedCount === 1) {
      console.log(`✅ Deleted question: ${questionId}`);
      res.json({ success: true, message: 'Question deleted successfully' });
    } else {
      console.log(`❌ Question not found: ${questionId}`);
      res.status(404).json({ error: 'Question not found' });
    }
  } catch (error) {
    console.error('❌ Error deleting question:', error);
    res.status(500).json({ error: 'Failed to delete question: ' + error.message });
  }
 });
 
router.get('/questions/:examId/:subjectId/:paperId', async (req, res) => {
  try {
    const { examId, subjectId, paperId } = req.params;
    
    console.log(`📋 Getting questions for paper: ${paperId} in ${examId}/${subjectId}`);
    
    // Use MongoDB directly
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Verify exam exists
    const exam = await db.collection('exams').findOne({ examId, isActive: true });
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Verify subject exists
    const subject = await db.collection('subjects').findOne({ examId, subjectId });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // Verify question paper exists
    const questionPaper = await db.collection('questionPapers').findOne({ 
      examId, 
      subjectId, 
      $or: [{ paperId: paperId }, { questionPaperId: paperId }]
    });
    if (!questionPaper) {
      return res.status(404).json({ error: 'Question paper not found' });
    }

    // Get questions for this paper
    const questions = await db.collection('questions').find({ 
      examId, 
      subjectId, 
      paperId: questionPaper.paperId || questionPaper.questionPaperId 
    }).toArray();
    
    console.log(`✅ Found ${questions.length} questions for paper ${paperId}`);

    res.json({
      examData: exam,
      subjectData: subject,
      questionPaper: questionPaper,
      questions: questions || [],
      paperId,
      currentPage: 'questions'
    });
  } catch (error) {
    console.error('❌ Error loading questions for paper:', error);
    res.status(500).json({ error: 'Error loading questions: ' + error.message });
  }
});

router.post('/questions/:examId/:subjectId/:paperId/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { examId, subjectId, paperId } = req.params;
    
    console.log(`📤 Uploading questions to: ${examId}/${subjectId}/${paperId}`);
    
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

    // Use MongoDB directly
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Verify exam exists
    const exam = await db.collection('exams').findOne({ examId, isActive: true });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    // Verify subject exists
    const subject = await db.collection('subjects').findOne({ examId, subjectId });
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    // Verify question paper exists
    const questionPaper = await db.collection('questionPapers').findOne({ 
      examId, 
      subjectId, 
      $or: [{ paperId: paperId }, { questionPaperId: paperId }]
    });
    if (!questionPaper) return res.status(404).json({ error: 'Question paper not found' });

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
        explanation: (q.Explanation || ''),
        examId,
        subjectId,
        paperId: questionPaper.paperId || questionPaper.questionPaperId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    // Insert all questions into MongoDB
    const insertResult = await db.collection('questions').insertMany(processedQuestions);
    
    console.log(`✅ Uploaded ${insertResult.insertedCount} questions to MongoDB`);
    
    res.json({ 
      success: true, 
      count: insertResult.insertedCount,
      message: `Successfully uploaded ${insertResult.insertedCount} questions`
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

// /Volumes/Macintosh HD/Users/burnt/Documents/workspace/DevOps/Terraform/eatpl/routes/api.js
// ... your other requires ... 

router.delete('/questionPapers/:examId/:subjectId/:questionPaperId', express.json(), async (req, res) => {
  try {
    const { examId, subjectId, questionPaperId } = req.params;
    
    console.log(`🗑️ Deleting question paper: ${questionPaperId} from ${examId}/${subjectId}`);
    
    if (!examId || !subjectId || !questionPaperId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Use MongoDB directly
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Verify exam exists
    const exam = await db.collection('exams').findOne({ examId, isActive: true });
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    // Verify subject exists
    const subject = await db.collection('subjects').findOne({ examId, subjectId });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // Find and delete the question paper
    const questionPaper = await db.collection('questionPapers').findOne({ 
      examId, 
      subjectId, 
      $or: [{ paperId: questionPaperId }, { questionPaperId: questionPaperId }]
    });

    if (!questionPaper) {
      console.log(`❌ Question paper not found: ${questionPaperId}`);
      return res.status(404).json({ error: 'Question paper not found' });
    }

    // Delete the question paper and all its questions
    const paperIdToDelete = questionPaper.paperId || questionPaper.questionPaperId;
    
    // Delete questions first
    const questionsDeleteResult = await db.collection('questions').deleteMany({ 
      examId, 
      subjectId, 
      paperId: paperIdToDelete 
    });
    
    // Delete the question paper
    const paperDeleteResult = await db.collection('questionPapers').deleteOne({ 
      _id: questionPaper._id 
    });

    if (paperDeleteResult.deletedCount === 1) {
      console.log(`✅ Deleted question paper: ${questionPaperId} and ${questionsDeleteResult.deletedCount} questions`);
      res.json({ 
        success: true, 
        message: 'Question paper deleted successfully',
        deletedQuestions: questionsDeleteResult.deletedCount
      });
    } else {
      console.log(`❌ Failed to delete question paper: ${questionPaperId}`);
      res.status(500).json({ error: 'Failed to delete question paper' });
    }

  } catch (error) {
    console.error('❌ Error deleting question paper:', error);
    res.status(500).json({ error: 'Failed to delete question paper: ' + error.message });
  }
});


module.exports = router;
