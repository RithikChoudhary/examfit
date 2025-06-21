const { 
    getQuestions, 
    saveQuestions, 
    getAllExams, 
    getExamById, 
    getSubjectsByExam,
    healthCheck 
} = require('../utils/dataHelpers');
const cacheService = require('./cacheService');

class ExamService {
    constructor() {
        // Initialize cache warm-up
        this.initializeCache();
    }

    async initializeCache() {
        try {
            console.log('🔥 Warming up ExamService cache...');
            await cacheService.warmUp(this);
            await cacheService.preloadExamData(this);
            console.log('✅ ExamService cache warmed up');
        } catch (error) {
            console.warn('⚠️ Cache initialization failed:', error.message);
        }
    }

    // Get all exams with optional caching - now uses MongoDB
    async getAllExams(useCache = true) {
        const cacheKey = 'all_exams';
        
        if (useCache) {
            const cached = cacheService.get(cacheKey);
            if (cached) {
                console.log('📋 Returning cached exams');
                return cached;
            }
        }

        try {
            console.log('📚 Loading exams from database...');
            // Use the new MongoDB-aware function from dataHelpers
            const mongoExams = await getAllExams();
            
            // Transform for consistency with existing API
            const transformedExams = mongoExams.map(exam => ({
                examId: exam.examId,
                examName: exam.examName,
                subjectCount: exam.subjects ? exam.subjects.length : 0,
                hasSubExams: !!exam.subExams,
                totalSubjects: exam.totalSubjects || (exam.subjects ? exam.subjects.length : 0)
            }));

            if (useCache) {
                cacheService.set(cacheKey, transformedExams, 30 * 60 * 1000); // Cache for 30 minutes
            }

            console.log(`✅ Loaded ${transformedExams.length} exams`);
            return transformedExams;
        } catch (error) {
            console.error('❌ Error loading exams:', error);
            // Fallback to old method
            const data = await getQuestions();
            const exams = data.exams.map(exam => ({
                examId: exam.examId,
                examName: exam.examName,
                subjectCount: exam.subjects ? exam.subjects.length : 0,
                hasSubExams: !!exam.subExams
            }));

            if (useCache) {
                cacheService.set(cacheKey, exams, 5 * 60 * 1000); // Shorter cache for fallback
            }

            return exams;
        }
    }

    // Get specific exam by ID - now uses MongoDB
    async getExamById(examId) {
        const cacheKey = `exam_${examId}`;
        
        const cached = cacheService.get(cacheKey);
        if (cached) {
            console.log(`📋 Returning cached exam: ${examId}`);
            return cached;
        }

        try {
            console.log(`📚 Loading exam from database: ${examId}`);
            // Use the new MongoDB-aware function
            const exam = await getExamById(examId);
            
            if (!exam) {
                throw new Error('Exam not found');
            }

            cacheService.set(cacheKey, exam, 30 * 60 * 1000); // Cache for 30 minutes
            
            // Update search indexes
            cacheService.updateIndex('examsByName', exam.examName.toLowerCase(), exam);

            console.log(`✅ Loaded exam: ${exam.examName}`);
            return exam;
        } catch (error) {
            console.error(`❌ Error loading exam ${examId}:`, error);
            // Fallback to old method
            const data = await getQuestions();
            const exam = data.exams.find(e => e.examId === examId);
            
            if (!exam) {
                throw new Error('Exam not found');
            }

            cacheService.set(cacheKey, exam, 5 * 60 * 1000); // Shorter cache for fallback
            
            // Update search indexes
            cacheService.updateIndex('examsByName', exam.examName.toLowerCase(), exam);

            return exam;
        }
    }

    // Get subjects for an exam - optimized for MongoDB
    async getExamSubjects(examId) {
        const cacheKey = `subjects_${examId}`;
        
        // Check cache first
        const cached = cacheService.get(cacheKey);
        if (cached) {
            console.log(`📋 Returning cached subjects for ${examId}`);
            return cached;
        }

        try {
            console.log(`📚 Loading subjects for exam: ${examId} from MongoDB...`);
            
            // Try MongoDB-optimized approach first
            const subjects = await getSubjectsByExam(examId);
            
            if (subjects && subjects.length > 0) {
                // Transform for consistent API
                const transformedSubjects = subjects.map(subject => ({
                    subjectId: subject.subjectId,
                    subjectName: subject.subjectName,
                    questionPaperCount: subject.questionPapers ? subject.questionPapers.length : 0,
                    totalQuestions: subject.questionPapers ? 
                        subject.questionPapers.reduce((total, paper) => 
                            total + (paper.questions ? paper.questions.length : 0), 0) : 0
                }));

                // Cache the results for 30 minutes
                cacheService.set(cacheKey, transformedSubjects, 30 * 60 * 1000);
                console.log(`✅ Loaded ${transformedSubjects.length} subjects for ${examId}`);
                return transformedSubjects;
            }
        } catch (error) {
            console.warn(`⚠️ MongoDB failed for subjects ${examId}:`, error.message);
        }

        // Fallback to full exam load
        console.log(`📄 Falling back to full exam load for ${examId}...`);
        const exam = await this.getExamById(examId);
        
        if (exam.subExams) {
            const result = exam.subExams;
            cacheService.set(cacheKey, result, 5 * 60 * 1000); // Shorter cache for fallback
            return result;
        }

        const result = exam.subjects ? exam.subjects.map(subject => ({
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            questionPaperCount: subject.questionPapers ? subject.questionPapers.length : 0,
            totalQuestions: subject.questionPapers ? 
                subject.questionPapers.reduce((total, paper) => 
                    total + (paper.questions ? paper.questions.length : 0), 0) : 0
        })) : [];

        cacheService.set(cacheKey, result, 5 * 60 * 1000); // Shorter cache for fallback
        return result;
    }

    // Get question papers for a subject - PERFORMANCE OPTIMIZED
    async getQuestionPapers(examId, subjectId) {
        console.log(`🔍 DEBUG: ExamService.getQuestionPapers called for ${examId}/${subjectId}`);
        
        // Check cache first for better performance
        const cacheKey = `question_papers_${examId}_${subjectId}`;
        const cached = cacheService.get(cacheKey);
        if (cached) {
            console.log(`⚡ DEBUG: Returning cached question papers for ${examId}/${subjectId}`);
            return cached;
        }
        
        const exam = await this.getExamById(examId);
        console.log(`🔍 DEBUG: Exam loaded: ${exam.examName}, subjects: ${exam.subjects?.length || 0}`);
        
        const subject = exam.subjects?.find(s => s.subjectId === subjectId);
        
        if (!subject) {
            console.log(`❌ DEBUG: Subject ${subjectId} not found in exam ${examId}`);
            console.log(`🔍 DEBUG: Available subjects:`, exam.subjects?.map(s => s.subjectId) || []);
            throw new Error('Subject not found');
        }
        
        console.log(`✅ DEBUG: Subject found: ${subject.subjectName}`);
        console.log(`🔍 DEBUG: Subject has ${subject.questionPapers?.length || 0} question papers`);
        
        // PERFORMANCE FIX: Don't load all questions at this stage
        // Only load questions when specifically requested for individual papers
        const result = subject.questionPapers ? subject.questionPapers.map(paper => ({
            questionPaperId: paper.questionPaperId,
            questionPaperName: paper.questionPaperName,
            section: paper.section,
            questionCount: paper.questionCount || 0, // Use pre-calculated count
            questions: [] // Don't load questions here - load on demand
        })) : [];
        
        // Cache the result for 15 minutes
        cacheService.set(cacheKey, result, 15 * 60 * 1000);
        
        console.log(`✅ DEBUG: Returning ${result.length} question papers (optimized - no questions loaded)`);
        return result;
    }

    // NEW METHOD: Get questions for a specific paper only when needed
    async getQuestionsForPaper(examId, subjectId, paperId) {
        console.log(`🔍 DEBUG: Loading questions for specific paper: ${examId}/${subjectId}/${paperId}`);
        
        const mongoService = require('../services/mongoService');
        const questions = await mongoService.getQuestionsByPaper(examId, subjectId, paperId);
        
        console.log(`✅ DEBUG: Loaded ${questions.length} questions for paper ${paperId}`);
        return questions;
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
