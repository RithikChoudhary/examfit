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
            
            try {
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
            } catch (fallbackError) {
                console.error('❌ Fallback method also failed:', fallbackError.message);
                throw fallbackError;
            }
        }
    }

    // Get specific exam by ID - now uses MongoDB with better error handling
    async getExamById(examId) {
        const cacheKey = `exam_${examId}`;
        
        const cached = cacheService.get(cacheKey);
        if (cached) {
            console.log(`📋 Returning cached exam: ${examId}`);
            return cached;
        }

        try {
            console.log(`📚 DEBUG: Loading exam from database: ${examId}`);
            // Use the new MongoDB-aware function
            const exam = await getExamById(examId);
            
            console.log(`📚 DEBUG: MongoDB result for exam ${examId}:`, exam ? 'Found' : 'Not found');
            
            if (!exam) {
                console.log(`📚 DEBUG: Exam ${examId} not found in MongoDB, trying fallback...`);
                throw new Error('Exam not found in MongoDB');
            }

            cacheService.set(cacheKey, exam, 30 * 60 * 1000); // Cache for 30 minutes
            
            // Update search indexes
            cacheService.updateIndex('examsByName', exam.examName.toLowerCase(), exam);

            console.log(`✅ DEBUG: Loaded exam from MongoDB: ${exam.examName}`);
            return exam;
        } catch (error) {
            console.error(`❌ DEBUG: MongoDB error for exam ${examId}:`, error.message);
            
            try {
                console.log(`📚 DEBUG: Trying fallback method for exam ${examId}...`);
                // Fallback to old method
                const data = await getQuestions();
                console.log(`📚 DEBUG: Fallback data loaded, ${data.exams?.length || 0} exams available`);
                
                if (data.exams?.length > 0) {
                    console.log(`📚 DEBUG: Available exam IDs:`, data.exams.map(e => e.examId));
                }
                
                const exam = data.exams.find(e => e.examId === examId);
                
                if (!exam) {
                    console.log(`❌ DEBUG: Exam ${examId} not found in fallback data either`);
                    console.log(`📚 DEBUG: All available exams:`, data.exams?.map(e => ({id: e.examId, name: e.examName})) || []);
                    throw new Error(`Exam not found: ${examId}. Available exams: ${data.exams?.map(e => e.examId).join(', ') || 'none'}`);
                }

                cacheService.set(cacheKey, exam, 5 * 60 * 1000); // Shorter cache for fallback
                
                // Update search indexes
                cacheService.updateIndex('examsByName', exam.examName.toLowerCase(), exam);

                console.log(`✅ DEBUG: Loaded exam from fallback: ${exam.examName}`);
                return exam;
            } catch (fallbackError) {
                console.error(`❌ DEBUG: Fallback also failed for exam ${examId}:`, fallbackError.message);
                throw new Error(`Exam not found: ${examId}. All fallback methods failed.`);
            }
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

    // Subject ID mapping for common variations
    mapSubjectId(subjectId, examId, availableSubjects) {
        // Common subject name mappings
        const subjectMappings = {
            // Geography variations
            'geography': ['geography', 'indian-geography', 'world-geography', 'physical-geography', 'human-geography'],
            'indian-geography': ['geography', 'indian-geography'],
            'world-geography': ['geography', 'world-geography'],
            
            // History variations  
            'history': ['history', 'indian-history', 'world-history', 'ancient-history', 'modern-history'],
            'indian-history': ['history', 'indian-history'],
            'ancient-history': ['history', 'ancient-history'],
            'modern-history': ['history', 'modern-history'],
            
            // Economy variations
            'economy': ['economy', 'economics', 'indian-economy', 'economic-survey'],
            'economics': ['economy', 'economics'],
            'indian-economy': ['economy', 'indian-economy'],
            
            // Polity variations
            'polity': ['polity', 'indian-polity', 'constitution', 'governance'],
            'indian-polity': ['polity', 'indian-polity'],
            'constitution': ['polity', 'constitution'],
            
            // Science variations
            'science': ['science', 'general-science', 'science-technology'],
            'general-science': ['science', 'general-science'],
            'science-technology': ['science', 'science-technology'],
            
            // Environment variations
            'environment': ['environment', 'environment-ecology', 'ecology'],
            'environment-ecology': ['environment', 'environment-ecology'],
            'ecology': ['environment', 'ecology']
        };
        
        // First try exact match
        let foundSubject = availableSubjects.find(s => s.subjectId === subjectId);
        if (foundSubject) {
            console.log(`✅ DEBUG: Exact match found for subject ${subjectId}`);
            return foundSubject;
        }
        
        // Try mapping variations
        const possibleIds = subjectMappings[subjectId] || [subjectId];
        console.log(`🔍 DEBUG: Trying subject variations for ${subjectId}:`, possibleIds);
        
        for (const possibleId of possibleIds) {
            foundSubject = availableSubjects.find(s => s.subjectId === possibleId);
            if (foundSubject) {
                console.log(`✅ DEBUG: Found subject via mapping: ${subjectId} → ${possibleId}`);
                return foundSubject;
            }
        }
        
        // Try partial matching
        foundSubject = availableSubjects.find(s => 
            s.subjectId.includes(subjectId) || 
            subjectId.includes(s.subjectId) ||
            s.subjectName.toLowerCase().includes(subjectId.toLowerCase())
        );
        
        if (foundSubject) {
            console.log(`✅ DEBUG: Found subject via partial match: ${subjectId} → ${foundSubject.subjectId}`);
            return foundSubject;
        }
        
        console.log(`❌ DEBUG: No mapping found for subject ${subjectId}`);
        return null;
    }

    // Get question papers for a subject - PERFORMANCE OPTIMIZED with subject mapping
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
        
        // Try to find subject with mapping
        const subject = this.mapSubjectId(subjectId, examId, exam.subjects || []);
        
        if (!subject) {
            console.log(`❌ DEBUG: Subject ${subjectId} not found in exam ${examId} even with mappings`);
            console.log(`🔍 DEBUG: Available subjects:`, exam.subjects?.map(s => ({
                id: s.subjectId, 
                name: s.subjectName
            })) || []);
            throw new Error(`Subject not found: ${subjectId}. Available subjects: ${exam.subjects?.map(s => s.subjectId).join(', ') || 'none'}`);
        }
        
        console.log(`✅ DEBUG: Subject found: ${subject.subjectName} (ID: ${subject.subjectId})`);
        console.log(`🔍 DEBUG: Subject has ${subject.questionPapers?.length || 0} question papers`);
        
        // PERFORMANCE FIX: Don't load all questions at this stage
        // Only load questions when specifically requested for individual papers
        const result = subject.questionPapers ? subject.questionPapers.map(paper => ({
            questionPaperId: paper.questionPaperId || paper.paperId, // Handle both field names
            questionPaperName: paper.questionPaperName || paper.paperName, // Handle both field names
            section: paper.section,
            questionCount: paper.questionCount || 0, // Use pre-calculated count
            questions: [] // Don't load questions here - load on demand
        })) : [];
        
        // Cache the result for 15 minutes
        cacheService.set(cacheKey, result, 15 * 60 * 1000);
        
        console.log(`✅ DEBUG: Returning ${result.length} question papers (optimized - no questions loaded)`);
        return result;
    }

    // PERFORMANCE OPTIMIZED: Get questions for a specific paper with aggressive caching
    async getQuestionsForPaper(examId, subjectId, paperId) {
        const startTime = Date.now();
        console.log(`🚀 OPTIMIZED: Loading questions for paper: ${examId}/${subjectId}/${paperId}`);
        
        // PERFORMANCE FIX: Add aggressive caching for questions
        const cacheKey = `questions_${examId}_${subjectId}_${paperId}`;
        const cached = cacheService.get(cacheKey);
        if (cached) {
            const cacheTime = Date.now() - startTime;
            console.log(`⚡ CACHE HIT: Questions loaded from cache in ${cacheTime}ms`);
            return cached;
        }
        
        const mongoService = require('../services/mongoService');
        const questions = await mongoService.getQuestionsByPaper(examId, subjectId, paperId);
        
        // Cache questions for 1 hour (longer than exam/subject data)
        if (questions.length > 0) {
            cacheService.set(cacheKey, questions, 60 * 60 * 1000); // 1 hour cache
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`⚡ PERFORMANCE: Loaded ${questions.length} questions in ${totalTime}ms (cached for future requests)`);
        return questions;
    }

    // Add new subject to exam
    async addSubject(examId, subjectData) {
        console.log(`📚 Adding subject: ${subjectData.subjectName} to exam: ${examId}`);
        
        // Use MongoDB directly
        const mongoService = require('./mongoService');
        const db = await mongoService.connect();
        
        // Verify exam exists
        const exam = await db.collection('exams').findOne({ examId, isActive: true });
        if (!exam) {
            throw new Error('Exam not found');
        }

        const subjectId = subjectData.subjectName.toLowerCase().replace(/\s+/g, '-');
        
        // Check if subject already exists
        const existingSubject = await db.collection('subjects').findOne({ examId, subjectId });
        if (existingSubject) {
            throw new Error('Subject already exists');
        }

        const newSubject = {
            examId,
            subjectId,
            subjectName: subjectData.subjectName,
            totalPapers: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Insert into MongoDB
        await db.collection('subjects').insertOne(newSubject);
        
        console.log(`✅ Created subject: ${subjectId}`);
        
        // Invalidate cache
        this.invalidateCache(examId);
        
        return {
            subjectId,
            subjectName: subjectData.subjectName,
            questionPapers: []
        };
    }

    // Delete subject
    async deleteSubject(examId, subjectId) {
        console.log(`🗑️ Deleting subject: ${subjectId} from exam: ${examId}`);
        
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

        // Delete all related data in order: questions -> question papers -> subject
        const questionsDeleteResult = await db.collection('questions').deleteMany({ examId, subjectId });
        const papersDeleteResult = await db.collection('questionPapers').deleteMany({ examId, subjectId });
        const subjectDeleteResult = await db.collection('subjects').deleteOne({ examId, subjectId });

        if (subjectDeleteResult.deletedCount === 1) {
            console.log(`✅ Deleted subject: ${subjectId}, ${papersDeleteResult.deletedCount} papers, ${questionsDeleteResult.deletedCount} questions`);
            
            // Invalidate cache
            this.invalidateCache(examId);
            
            return true;
        } else {
            throw new Error('Failed to delete subject');
        }
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
