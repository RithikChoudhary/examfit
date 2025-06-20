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
        const data = await getQuestions();
        const examIndex = data.exams.findIndex(e => e.examId === examId);
        
        if (examIndex === -1) {
            throw new Error('Exam not found');
        }

        const subjectIndex = data.exams[examIndex].subjects?.findIndex(s => s.subjectId === subjectId);
        
        if (subjectIndex === -1) {
            throw new Error('Subject not found');
        }

        const newPaper = {
            questionPaperId: `qp-${Date.now()}`,
            questionPaperName: paperData.paperName,
            section: paperData.paperSection || 'General',
            questions: []
        };

        if (!data.exams[examIndex].subjects[subjectIndex].questionPapers) {
            data.exams[examIndex].subjects[subjectIndex].questionPapers = [];
        }

        data.exams[examIndex].subjects[subjectIndex].questionPapers.push(newPaper);
        await saveQuestions(data);
        
        // Invalidate cache
        this.invalidateCache(examId, subjectId);
        examService.invalidateCache(examId);
        
        return newPaper;
    }

    // Delete question paper
    async deleteQuestionPaper(examId, subjectId, paperId) {
        const data = await getQuestions();
        const examIndex = data.exams.findIndex(e => e.examId === examId);
        
        if (examIndex === -1) {
            throw new Error('Exam not found');
        }

        const subjectIndex = data.exams[examIndex].subjects?.findIndex(s => s.subjectId === subjectId);
        
        if (subjectIndex === -1) {
            throw new Error('Subject not found');
        }

        const paperIndex = data.exams[examIndex].subjects[subjectIndex].questionPapers?.findIndex(p => p.questionPaperId === paperId);
        
        if (paperIndex === -1) {
            throw new Error('Question paper not found');
        }

        data.exams[examIndex].subjects[subjectIndex].questionPapers.splice(paperIndex, 1);
        await saveQuestions(data);
        
        // Invalidate cache
        this.invalidateCache(examId, subjectId);
        examService.invalidateCache(examId);
        
        return true;
    }

    // Add question to paper
    async addQuestion(examId, subjectId, paperId, questionData) {
        const data = await getQuestions();
        const exam = data.exams.find(e => e.examId === examId);
        
        if (!exam) {
            throw new Error('Exam not found');
        }

        const subject = exam.subjects?.find(s => s.subjectId === subjectId);
        
        if (!subject) {
            throw new Error('Subject not found');
        }

        const paper = subject.questionPapers?.find(p => p.questionPaperId === paperId);
        
        if (!paper) {
            throw new Error('Question paper not found');
        }

        // Validate question data
        this.validateQuestionData(questionData);

        const newQuestion = {
            questionId: `q${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            question: questionData.question,
            options: questionData.options,
            correctOption: questionData.correctOption,
            explanation: questionData.explanation || ''
        };

        if (!paper.questions) {
            paper.questions = [];
        }

        paper.questions.push(newQuestion);
        await saveQuestions(data);
        
        // Invalidate cache
        this.invalidateCache(examId, subjectId, paperId);
        examService.invalidateCache(examId);
        
        return newQuestion;
    }

    // Update question
    async updateQuestion(examId, subjectId, questionId, questionData) {
        const data = await getQuestions();
        const exam = data.exams.find(e => e.examId === examId);
        
        if (!exam) {
            throw new Error('Exam not found');
        }

        const subject = exam.subjects?.find(s => s.subjectId === subjectId);
        
        if (!subject) {
            throw new Error('Subject not found');
        }

        let questionFound = false;
        let updatedQuestion = null;

        if (subject.questionPapers) {
            for (const paper of subject.questionPapers) {
                const questionIndex = paper.questions?.findIndex(q => q.questionId === questionId);
                if (questionIndex !== -1) {
                    // Validate question data
                    this.validateQuestionData(questionData);

                    updatedQuestion = {
                        questionId,
                        question: questionData.question,
                        options: questionData.options,
                        correctOption: questionData.correctOption,
                        explanation: questionData.explanation || ''
                    };

                    paper.questions[questionIndex] = updatedQuestion;
                    questionFound = true;
                    break;
                }
            }
        }

        if (!questionFound) {
            throw new Error('Question not found');
        }

        await saveQuestions(data);
        
        // Invalidate cache
        this.invalidateCache(examId, subjectId);
        examService.invalidateCache(examId);
        
        return updatedQuestion;
    }

    // Delete question
    async deleteQuestion(examId, subjectId, questionId) {
        const data = await getQuestions();
        const exam = data.exams.find(e => e.examId === examId);
        
        if (!exam) {
            throw new Error('Exam not found');
        }

        const subject = exam.subjects?.find(s => s.subjectId === subjectId);
        
        if (!subject) {
            throw new Error('Subject not found');
        }

        let questionDeleted = false;

        if (subject.questionPapers) {
            for (const paper of subject.questionPapers) {
                const questionIndex = paper.questions?.findIndex(q => q.questionId === questionId);
                if (questionIndex !== -1) {
                    paper.questions.splice(questionIndex, 1);
                    questionDeleted = true;
                    break;
                }
            }
        }

        if (!questionDeleted) {
            throw new Error('Question not found');
        }

        await saveQuestions(data);
        
        // Invalidate cache
        this.invalidateCache(examId, subjectId);
        examService.invalidateCache(examId);
        
        return true;
    }

    // Bulk add questions from array
    async bulkAddQuestions(examId, subjectId, paperId, questionsArray) {
        const data = await getQuestions();
        const exam = data.exams.find(e => e.examId === examId);
        
        if (!exam) {
            throw new Error('Exam not found');
        }

        const subject = exam.subjects?.find(s => s.subjectId === subjectId);
        
        if (!subject) {
            throw new Error('Subject not found');
        }

        const paper = subject.questionPapers?.find(p => p.questionPaperId === paperId);
        
        if (!paper) {
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
                    explanation: questionsArray[i].explanation || ''
                };

                processedQuestions.push(newQuestion);
            } catch (error) {
                throw new Error(`Question ${i + 1}: ${error.message}`);
            }
        }

        if (!paper.questions) {
            paper.questions = [];
        }

        paper.questions.push(...processedQuestions);
        await saveQuestions(data);
        
        // Invalidate cache
        this.invalidateCache(examId, subjectId, paperId);
        examService.invalidateCache(examId);
        
        return processedQuestions;
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
