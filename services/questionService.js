const { getQuestions, saveQuestions } = require('../utils/dataHelpers');
const examService = require('./examService');
const cacheService = require('./cacheService');

class QuestionService {
    constructor() {
        // Using centralized cache service
    }

    // Get questions for a specific paper
    async getQuestionsByPaper(examId, subjectId, paperId) {
        const cacheKey = `questions_${examId}_${subjectId}_${paperId}`;
        
        const cached = cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        const exam = await examService.getExamById(examId);
        const subject = exam.subjects?.find(s => s.subjectId === subjectId);
        
        if (!subject) {
            throw new Error('Subject not found');
        }

        const paper = subject.questionPapers?.find(p => p.questionPaperId === paperId);
        
        if (!paper) {
            throw new Error('Question paper not found');
        }

        const questions = paper.questions || [];

        cacheService.set(cacheKey, questions);

        return questions;
    }

    // Get all questions for a subject (from all papers)
    async getQuestionsBySubject(examId, subjectId) {
        const exam = await examService.getExamById(examId);
        const subject = exam.subjects?.find(s => s.subjectId === subjectId);
        
        if (!subject) {
            throw new Error('Subject not found');
        }

        const allQuestions = [];
        
        if (subject.questionPapers) {
            subject.questionPapers.forEach(paper => {
                if (paper.questions) {
                    paper.questions.forEach(question => {
                        allQuestions.push({
                            ...question,
                            paperInfo: {
                                paperId: paper.questionPaperId,
                                paperName: paper.questionPaperName,
                                section: paper.section
                            }
                        });
                    });
                }
            });
        }

        return allQuestions;
    }

    // Add question paper
    async addQuestionPaper(examId, subjectId, paperData) {
        console.log(`📝 Adding question paper: ${paperData.paperName} to ${examId}/${subjectId}`);
        
        // Use MongoDB directly
        const mongoService = require('./mongoService');
        const db = await mongoService.connect();
        
        // Verify exam exists
        const exam = await db.collection('exams').findOne({ examId, isActive: true });
        if (!exam) {
            throw new Error('Exam not found');
        }
        
        // Verify subject exists
        const subject = await db.collection('subjects').findOne({ examId, subjectId });
        if (!subject) {
            throw new Error('Subject not found');
        }

        const paperId = `qp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const newPaper = {
            paperId,
            questionPaperId: paperId, // For compatibility
            paperName: paperData.paperName,
            questionPaperName: paperData.paperName, // For compatibility
            section: paperData.paperSection || 'General',
            examId,
            subjectId,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Insert into MongoDB
        await db.collection('questionPapers').insertOne(newPaper);
        
        console.log(`✅ Created question paper: ${paperId}`);
        
        // Invalidate cache
        this.invalidateCache(examId, subjectId);
        examService.invalidateCache(examId);
        
        return {
            questionPaperId: paperId,
            questionPaperName: paperData.paperName,
            section: paperData.paperSection || 'General',
            questions: []
        };
    }

    // Delete question paper
    async deleteQuestionPaper(examId, subjectId, paperId) {
        console.log(`🗑️ Deleting question paper: ${paperId} from ${examId}/${subjectId}`);
        
        // Use MongoDB directly
        const mongoService = require('./mongoService');
        const db = await mongoService.connect();
        
        // Verify exam exists
        const exam = await db.collection('exams').findOne({ examId, isActive: true });
        if (!exam) {
            throw new Error('Exam not found');
        }
        
        // Verify subject exists
        const subject = await db.collection('subjects').findOne({ examId, subjectId });
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Find and delete the question paper
        const questionPaper = await db.collection('questionPapers').findOne({ 
            examId, 
            subjectId, 
            $or: [{ paperId: paperId }, { questionPaperId: paperId }]
        });

        if (!questionPaper) {
            throw new Error('Question paper not found');
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
            console.log(`✅ Deleted question paper: ${paperId} and ${questionsDeleteResult.deletedCount} questions`);
            
            // Invalidate cache
            this.invalidateCache(examId, subjectId);
            examService.invalidateCache(examId);
            
            return true;
        } else {
            throw new Error('Failed to delete question paper');
        }
    }

    // Add question to paper
    async addQuestion(examId, subjectId, paperId, questionData) {
        console.log(`❓ Adding question to: ${examId}/${subjectId}/${paperId}`);
        
        // Validate question data first
        this.validateQuestionData(questionData);

        // Use MongoDB directly
        const mongoService = require('./mongoService');
        const db = await mongoService.connect();
        
        // Verify exam exists
        const exam = await db.collection('exams').findOne({ examId, isActive: true });
        if (!exam) {
            throw new Error('Exam not found');
        }

        // Verify subject exists
        const subject = await db.collection('subjects').findOne({ examId, subjectId });
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Verify question paper exists
        const questionPaper = await db.collection('questionPapers').findOne({ 
            examId, 
            subjectId, 
            $or: [{ paperId: paperId }, { questionPaperId: paperId }]
        });
        if (!questionPaper) {
            throw new Error('Question paper not found');
        }

        // Create new question
        const questionId = `q${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newQuestion = {
            questionId,
            question: questionData.question,
            options: questionData.options,
            correctOption: questionData.correctOption,
            explanation: questionData.explanation || '',
            examId,
            subjectId,
            paperId: questionPaper.paperId || questionPaper.questionPaperId,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Insert into MongoDB
        await db.collection('questions').insertOne(newQuestion);
        
        console.log(`✅ Created question: ${questionId}`);
        
        // Invalidate cache
        this.invalidateCache(examId, subjectId, paperId);
        examService.invalidateCache(examId);
        
        return {
            questionId,
            question: questionData.question,
            options: questionData.options,
            correctOption: questionData.correctOption,
            explanation: questionData.explanation || ''
        };
    }

    // Update question
    async updateQuestion(examId, subjectId, questionId, questionData) {
        console.log(`✏️ Updating question: ${questionId} in ${examId}/${subjectId}`);
        
        // Validate question data first
        this.validateQuestionData(questionData);

        // Use MongoDB directly
        const mongoService = require('./mongoService');
        const db = await mongoService.connect();
        
        // Verify exam exists
        const exam = await db.collection('exams').findOne({ examId, isActive: true });
        if (!exam) {
            throw new Error('Exam not found');
        }

        // Verify subject exists
        const subject = await db.collection('subjects').findOne({ examId, subjectId });
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Update the question
        const updateResult = await db.collection('questions').updateOne(
            { examId, subjectId, questionId },
            { 
                $set: {
                    question: questionData.question,
                    options: questionData.options,
                    correctOption: questionData.correctOption,
                    explanation: questionData.explanation || '',
                    updatedAt: new Date()
                }
            }
        );

        if (updateResult.matchedCount === 1) {
            console.log(`✅ Updated question: ${questionId}`);
            
            // Invalidate cache
            this.invalidateCache(examId, subjectId);
            examService.invalidateCache(examId);
            
            return {
                questionId,
                question: questionData.question,
                options: questionData.options,
                correctOption: questionData.correctOption,
                explanation: questionData.explanation || ''
            };
        } else {
            throw new Error('Question not found');
        }
    }

    // Delete question
    async deleteQuestion(examId, subjectId, questionId) {
        console.log(`🗑️ Deleting question: ${questionId} from ${examId}/${subjectId}`);
        
        // Use MongoDB directly
        const mongoService = require('./mongoService');
        const db = await mongoService.connect();
        
        // Verify exam exists
        const exam = await db.collection('exams').findOne({ examId, isActive: true });
        if (!exam) {
            throw new Error('Exam not found');
        }

        // Verify subject exists
        const subject = await db.collection('subjects').findOne({ examId, subjectId });
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Find and delete the question
        const deleteResult = await db.collection('questions').deleteOne({ 
            examId, 
            subjectId, 
            questionId 
        });

        if (deleteResult.deletedCount === 1) {
            console.log(`✅ Deleted question: ${questionId}`);
            
            // Invalidate cache
            this.invalidateCache(examId, subjectId);
            examService.invalidateCache(examId);
            
            return true;
        } else {
            throw new Error('Question not found');
        }
    }

    // Bulk add questions from array
    async bulkAddQuestions(examId, subjectId, paperId, questionsArray) {
        console.log(`📤 Bulk adding ${questionsArray.length} questions to: ${examId}/${subjectId}/${paperId}`);
        
        // Use MongoDB directly
        const mongoService = require('./mongoService');
        const db = await mongoService.connect();
        
        // Verify exam exists
        const exam = await db.collection('exams').findOne({ examId, isActive: true });
        if (!exam) {
            throw new Error('Exam not found');
        }

        // Verify subject exists
        const subject = await db.collection('subjects').findOne({ examId, subjectId });
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Verify question paper exists
        const questionPaper = await db.collection('questionPapers').findOne({ 
            examId, 
            subjectId, 
            $or: [{ paperId: paperId }, { questionPaperId: paperId }]
        });
        if (!questionPaper) {
            throw new Error('Question paper not found');
        }

        const processedQuestions = [];

        for (let i = 0; i < questionsArray.length; i++) {
            try {
                this.validateQuestionData(questionsArray[i]);
                
                const newQuestion = {
                    questionId: `q${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    question: questionsArray[i].question,
                    options: questionsArray[i].options,
                    correctOption: questionsArray[i].correctOption,
                    explanation: questionsArray[i].explanation || '',
                    examId,
                    subjectId,
                    paperId: questionPaper.paperId || questionPaper.questionPaperId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                processedQuestions.push(newQuestion);
            } catch (error) {
                throw new Error(`Question ${i + 1}: ${error.message}`);
            }
        }

        // Insert all questions into MongoDB
        const insertResult = await db.collection('questions').insertMany(processedQuestions);
        
        console.log(`✅ Bulk added ${insertResult.insertedCount} questions to MongoDB`);
        
        // Invalidate cache
        this.invalidateCache(examId, subjectId, paperId);
        examService.invalidateCache(examId);
        
        return processedQuestions.map(q => ({
            questionId: q.questionId,
            question: q.question,
            options: q.options,
            correctOption: q.correctOption,
            explanation: q.explanation
        }));
    }

    // Search questions
    async searchQuestions(examId, subjectId, searchTerm, options = {}) {
        const questions = await this.getQuestionsBySubject(examId, subjectId);
        const searchLower = searchTerm.toLowerCase();
        
        let filteredQuestions = questions.filter(question => 
            question.question.toLowerCase().includes(searchLower) ||
            question.explanation.toLowerCase().includes(searchLower) ||
            question.options.some(option => option.text.toLowerCase().includes(searchLower))
        );

        // Apply additional filters
        if (options.section) {
            filteredQuestions = filteredQuestions.filter(question => 
                question.paperInfo?.section === options.section
            );
        }

        // Pagination
        if (options.page && options.limit) {
            const startIndex = (options.page - 1) * options.limit;
            const endIndex = startIndex + options.limit;
            filteredQuestions = filteredQuestions.slice(startIndex, endIndex);
        }

        return filteredQuestions;
    }

    // Get question statistics
    async getQuestionStats(examId, subjectId) {
        const questions = await this.getQuestionsBySubject(examId, subjectId);
        
        const sectionStats = {};
        let totalQuestions = questions.length;

        questions.forEach(question => {
            const section = question.paperInfo?.section || 'Unknown';
            if (!sectionStats[section]) {
                sectionStats[section] = {
                    count: 0,
                    papers: new Set()
                };
            }
            sectionStats[section].count++;
            sectionStats[section].papers.add(question.paperInfo?.paperId);
        });

        // Convert Sets to counts
        Object.keys(sectionStats).forEach(section => {
            sectionStats[section].paperCount = sectionStats[section].papers.size;
            delete sectionStats[section].papers;
        });

        return {
            totalQuestions,
            sectionStats,
            averageQuestionsPerSection: Object.keys(sectionStats).length > 0 ? 
                Math.round(totalQuestions / Object.keys(sectionStats).length) : 0
        };
    }

    // Validate question data
    validateQuestionData(questionData) {
        if (!questionData.question || questionData.question.trim() === '') {
            throw new Error('Question text is required');
        }

        if (!questionData.options || !Array.isArray(questionData.options)) {
            throw new Error('Options array is required');
        }

        if (questionData.options.length < 2) {
            throw new Error('At least 2 options are required');
        }

        // Validate options structure
        questionData.options.forEach((option, index) => {
            if (!option.optionId || !option.text) {
                throw new Error(`Option ${index + 1} must have optionId and text`);
            }
            if (option.text.trim() === '') {
                throw new Error(`Option ${index + 1} text cannot be empty`);
            }
        });

        if (!questionData.correctOption) {
            throw new Error('Correct option is required');
        }

        // Verify correct option exists in options
        const correctOptionExists = questionData.options.some(option => 
            option.optionId === questionData.correctOption
        );

        if (!correctOptionExists) {
            throw new Error('Correct option must match one of the provided option IDs');
        }

        return true;
    }

    // Invalidate cache
    invalidateCache(examId = null, subjectId = null, paperId = null) {
        if (paperId) {
            cacheService.invalidatePattern(`questions_${examId}_${subjectId}_${paperId}`);
        } else if (subjectId) {
            cacheService.invalidatePattern(`questions_${examId}_${subjectId}_.*`);
        } else if (examId) {
            cacheService.invalidatePattern(`questions_${examId}_.*`);
        } else {
            cacheService.invalidatePattern('questions_.*');
        }
    }

    // Clear all cache
    clearCache() {
        cacheService.invalidatePattern('questions_.*');
    }
}

module.exports = new QuestionService();
