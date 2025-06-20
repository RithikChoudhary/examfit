const { getQuestions, saveQuestions } = require('../utils/dataHelpers');
const cacheService = require('./cacheService');

class ExamService {
    constructor() {
        // Initialize cache warm-up
        this.initializeCache();
    }

    async initializeCache() {
        try {
            await cacheService.warmUp(this);
            await cacheService.preloadExamData(this);
        } catch (error) {
            console.warn('Cache initialization failed:', error.message);
        }
    }

    // Get all exams with optional caching
    async getAllExams(useCache = true) {
        const cacheKey = 'all_exams';
        
        if (useCache) {
            const cached = cacheService.get(cacheKey);
            if (cached) {
                return cached;
            }
        }

        const data = await getQuestions();
        const exams = data.exams.map(exam => ({
            examId: exam.examId,
            examName: exam.examName,
            subjectCount: exam.subjects ? exam.subjects.length : 0,
            hasSubExams: !!exam.subExams
        }));

        if (useCache) {
            cacheService.set(cacheKey, exams);
        }

        return exams;
    }

    // Get specific exam by ID
    async getExamById(examId) {
        const cacheKey = `exam_${examId}`;
        
        const cached = cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        const data = await getQuestions();
        const exam = data.exams.find(e => e.examId === examId);
        
        if (!exam) {
            throw new Error('Exam not found');
        }

        cacheService.set(cacheKey, exam);
        
        // Update search indexes
        cacheService.updateIndex('examsByName', exam.examName.toLowerCase(), exam);

        return exam;
    }

    // Get subjects for an exam
    async getExamSubjects(examId) {
        const exam = await this.getExamById(examId);
        
        if (exam.subExams) {
            return exam.subExams;
        }

        return exam.subjects ? exam.subjects.map(subject => ({
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            questionPaperCount: subject.questionPapers ? subject.questionPapers.length : 0,
            totalQuestions: subject.questionPapers ? 
                subject.questionPapers.reduce((total, paper) => 
                    total + (paper.questions ? paper.questions.length : 0), 0) : 0
        })) : [];
    }

    // Get question papers for a subject
    async getQuestionPapers(examId, subjectId) {
        const exam = await this.getExamById(examId);
        const subject = exam.subjects?.find(s => s.subjectId === subjectId);
        
        if (!subject) {
            throw new Error('Subject not found');
        }

        return subject.questionPapers ? subject.questionPapers.map(paper => ({
            questionPaperId: paper.questionPaperId,
            questionPaperName: paper.questionPaperName,
            section: paper.section,
            questionCount: paper.questions ? paper.questions.length : 0
        })) : [];
    }

    // Add new subject to exam
    async addSubject(examId, subjectData) {
        const data = await getQuestions();
        const examIndex = data.exams.findIndex(e => e.examId === examId);
        
        if (examIndex === -1) {
            throw new Error('Exam not found');
        }

        const subjectId = subjectData.subjectName.toLowerCase().replace(/\s+/g, '-');
        
        // Check if subject already exists
        if (data.exams[examIndex].subjects?.some(s => s.subjectId === subjectId)) {
            throw new Error('Subject already exists');
        }

        const newSubject = {
            subjectId,
            subjectName: subjectData.subjectName,
            questionPapers: []
        };

        if (!data.exams[examIndex].subjects) {
            data.exams[examIndex].subjects = [];
        }

        data.exams[examIndex].subjects.push(newSubject);
        await saveQuestions(data);
        
        // Invalidate cache
        this.invalidateCache(examId);
        
        return newSubject;
    }

    // Delete subject
    async deleteSubject(examId, subjectId) {
        const data = await getQuestions();
        const examIndex = data.exams.findIndex(e => e.examId === examId);
        
        if (examIndex === -1) {
            throw new Error('Exam not found');
        }

        const subjectIndex = data.exams[examIndex].subjects?.findIndex(s => s.subjectId === subjectId);
        
        if (subjectIndex === -1) {
            throw new Error('Subject not found');
        }

        data.exams[examIndex].subjects.splice(subjectIndex, 1);
        await saveQuestions(data);
        
        // Invalidate cache
        this.invalidateCache(examId);
        
        return true;
    }

    // Search exams by name or ID
    async searchExams(query) {
        const exams = await this.getAllExams();
        const searchTerm = query.toLowerCase();
        
        return exams.filter(exam => 
            exam.examName.toLowerCase().includes(searchTerm) ||
            exam.examId.toLowerCase().includes(searchTerm)
        );
    }

    // Get exam statistics
    async getExamStats(examId) {
        const exam = await this.getExamById(examId);
        
        let totalQuestions = 0;
        let totalPapers = 0;
        const subjects = exam.subjects || [];

        subjects.forEach(subject => {
            if (subject.questionPapers) {
                totalPapers += subject.questionPapers.length;
                subject.questionPapers.forEach(paper => {
                    if (paper.questions) {
                        totalQuestions += paper.questions.length;
                    }
                });
            }
        });

        return {
            examId: exam.examId,
            examName: exam.examName,
            subjectCount: subjects.length,
            totalPapers,
            totalQuestions,
            averageQuestionsPerPaper: totalPapers > 0 ? Math.round(totalQuestions / totalPapers) : 0
        };
    }

    // Invalidate cache for specific exam or all
    invalidateCache(examId = null) {
        if (examId) {
            cacheService.invalidatePattern(`exam_${examId}`);
            cacheService.invalidatePattern(`subjects_${examId}`);
        } else {
            cacheService.clear();
        }
    }

    // Clear all cache
    clearCache() {
        cacheService.clear();
    }
}

module.exports = new ExamService();
