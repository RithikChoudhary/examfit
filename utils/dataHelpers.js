const mongoService = require('../services/mongoService');

// Main data access function - MongoDB only
async function getQuestions() {
    console.log('📂 Loading data from MongoDB...');
    const exams = await mongoService.getExams();
    console.log(`✅ Data loaded from MongoDB: ${exams.length} exams`);
    return {
        exams,
        source: 'mongodb',
        lastUpdated: new Date().toISOString()
    };
}

// Save questions - MongoDB only (deprecated - use direct MongoDB operations instead)
async function saveQuestions(data) {
    console.warn('⚠️ saveQuestions() is deprecated. Use direct MongoDB operations instead.');
    
    // For backward compatibility, handle both old and new data structures
    if (!data) {
        throw new Error('Invalid data structure - no data provided');
    }

    console.log('💾 Saving data to MongoDB...');
    
    const db = await mongoService.connect();
    
    let totalAdded = 0;
    
    // Handle old structure (data.exams)
    if (data.exams && Array.isArray(data.exams)) {
        for (const exam of data.exams) {
            for (const subject of exam.subjects || []) {
                for (const paper of subject.questionPapers || []) {
                    if (paper.questions && paper.questions.length > 0) {
                        // Add exam/subject/paper context to each question
                        const questionsWithContext = paper.questions.map(q => ({
                            ...q,
                            examId: exam.examId,
                            subjectId: subject.subjectId,
                            paperId: paper.questionPaperId || paper.paperId,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }));
                        
                        try {
                            const result = await db.collection('questions').insertMany(questionsWithContext, { ordered: false });
                            totalAdded += result.insertedCount || 0;
                        } catch (error) {
                            if (error.code === 11000) {
                                // Duplicate key error - some questions already exist
                                console.log('Some questions already exist, skipping duplicates');
                            } else {
                                throw error;
                            }
                        }
                    }
                }
            }
        }
    }
    // Handle new structure (direct questions array)
    else if (Array.isArray(data)) {
        try {
            const result = await db.collection('questions').insertMany(data, { ordered: false });
            totalAdded += result.insertedCount || 0;
        } catch (error) {
            if (error.code === 11000) {
                console.log('Some questions already exist, skipping duplicates');
            } else {
                throw error;
            }
        }
    }
    else {
        console.log('No questions to save or unrecognized data structure');
    }
    
    console.log(`✅ Saved ${totalAdded} new questions to MongoDB`);
    return { success: true, added: totalAdded };
}

// Get exam by ID - MongoDB only
async function getExamById(examId) {
    return await mongoService.getExamById(examId);
}

// Get subjects for an exam - MongoDB only
async function getSubjectsByExam(examId) {
    console.log(`🔍 Getting subjects for exam: ${examId} from MongoDB`);
    const subjects = await mongoService.getSubjectsByExam(examId);
    console.log(`✅ Found ${subjects.length} subjects from MongoDB`);
    return subjects;
}

// Get questions for a specific paper - MongoDB only
async function getQuestionsByPaper(examId, subjectId, paperId, limit = null) {
    return await mongoService.getQuestionsByPaper(examId, subjectId, paperId, limit);
}

// Get random questions for practice - MongoDB only
async function getRandomQuestions(examId, subjectId, count = 10) {
    return await mongoService.getRandomQuestions(examId, subjectId, count);
}

// Search questions - MongoDB only
async function searchQuestions(searchTerm, examId = null, subjectId = null, limit = 50) {
    return await mongoService.searchQuestions(searchTerm, examId, subjectId, limit);
}

// Get all exams - MongoDB only
async function getAllExams() {
    return await mongoService.getExams();
}

// Health check for data system - MongoDB only
async function healthCheck() {
    const mongoHealth = await mongoService.healthCheck();
    return {
        status: 'healthy',
        dataSource: 'mongodb',
        mongoHealth
    };
}

module.exports = {
    // Main functions (backward compatible)
    getQuestions,
    saveQuestions,
    
    // New MongoDB-specific functions
    getExamById,
    getSubjectsByExam,
    getQuestionsByPaper,
    getRandomQuestions,
    searchQuestions,
    getAllExams,
    healthCheck
};
