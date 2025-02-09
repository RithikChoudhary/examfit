// /Volumes/Macintosh HD/Users/burnt/Documents/workspace/DevOps/Terraform/eatpl/routes/subExamRoutes.js
const express = require('express');
const router = express.Router();
const { getQuestions } = require('../utils/dataHelpers');


router.get('/:exam/:subExam/subjects', async (req, res) => {
    try {
        const data = await getQuestions();
        const { exam, subExam } = req.params;

        const examData = data.exams.find(e => e.examId === exam);
        if (!examData) {
            return res.status(404).send('Exam not found');
        }

        const subExamData = examData.subExams?.find(se => se.subExamId === subExam);
        if (!subExamData) {
            return res.status(404).send('Sub-exam not found');
        }

        res.render('subjects', {
            exam,
            subExam,
            examName: `${examData.examName} - ${subExamData.subExamName}`,
            subjects: subExamData.subjects.map(subject => ({
                id: subject.subjectId,
                name: subject.subjectName,
                questionCount: subject.questions.length
            })),
            isSubExamView: true 
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error loading.. subjects');
    }
});

// Route for displaying questions for a sub-exam subject (e.g., /upsc/ips/questions/history)
router.get('/:exam/:subExam/questions/:subject', async (req, res) => {
    try {
      const data = await getQuestions();
      const { exam, subExam, subject } = req.params;
  
      // Find exam (UPSC)
      const examData = data.exams.find(e => e.examId === exam);
      if (!examData) {
        return res.status(404).send('Exam not found');
      }
  
      // Find sub-exam (IPS, IRS, IFS)
      const subExamData = examData.subExams.find(se => se.subExamId === subExam);
      if (!subExamData) {
        return res.status(404).send('Sub-exam not found');
      }
  
      // Find subject (History, Geography, etc.) - Correctly access from subExamData
      const subjectData = subExamData.subjects.find(s => s.subjectId === subject); 
      if (!subjectData) {
        return res.status(404).send('Subject not found');
      }
      res.render('questions', {
        exam,
        examName: examData.examName,
        subExam,
        subExamName: subExamData.subExamName,
        subject,
        subjectName: subjectData.subjectName,
        questions: subjectData.questions || [],
        subjects: subExamData.subjects // Pass all subjects of the sub-exam
      });
  
    } catch (error) {
      console.error('Error loading sub-exam questions:', error);
      res.status(500).send('Error loading. sub-exam .questions');
    }
  });
  router.get('/:exam/:subExam', (req, res) => {
    res.redirect(`/${req.params.exam}/${req.params.subExam}/subjects`); 
});
// Redirect from /exam/subExam to /exam/subExam/subjects
module.exports = router;