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

// Save questions - MongoDB only
async function saveQuestions(data) {
    if (!data || !data.exams) {
        throw new Error('Invalid data structure - missing exams array');
    }

    console.log('💾 Saving data to MongoDB...');
    
    const db = await mongoService.connect();
    
    // Add any new questions from the data
    let totalAdded = 0;
    for (const exam of data.exams) {
        for (const subject of exam.subjects || []) {
            for (const paper of subject.questionPapers || []) {
                if (paper.questions && paper.questions.length > 0) {
                    const result = await mongoService.addQuestions(paper.questions);
                    totalAdded += result.insertedCount || 0;
                }
            }
        }
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
