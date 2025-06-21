const mongoService = require('../services/mongoService');

// Main data access function - MongoDB only
async function getQuestions() {
    try {
        console.log('📂 Loading data from MongoDB...');
        const exams = await mongoService.getExams();
        console.log(`✅ Data loaded from MongoDB: ${exams.length} exams`);
        return {
            exams,
            source: 'mongodb',
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ Error loading data from MongoDB:', error);
        throw error;
    }
}

// Save questions - now saves to MongoDB
async function saveQuestions(data) {
    try {
        if (!data || !data.exams) {
            throw new Error('Invalid data structure - missing exams array');
        }

        console.log('💾 Saving data to MongoDB...');
        
        // For now, we'll add the questions using the MongoDB service
        // This is a simplified approach - in a full implementation, 
        // you'd want more sophisticated merging logic
        
        const db = await mongoService.connect();
        
        // Add any new questions from the data
        let totalAdded = 0;
        for (const exam of data.exams) {
            for (const subject of exam.subjects || []) {
                for (const paper of subject.questionPapers || []) {
                    if (paper.questions && paper.questions.length > 0) {
                        try {
                            const result = await mongoService.addQuestions(paper.questions);
                            totalAdded += result.insertedCount || 0;
                        } catch (error) {
                            console.warn(`Warning: Could not save questions for ${exam.examId}/${subject.subjectId}:`, error.message);
                        }
                    }
                }
            }
        }
        
        console.log(`✅ Saved ${totalAdded} new questions to MongoDB`);
        return { success: true, added: totalAdded };
        
    } catch (error) {
        console.error('❌ Error saving data to MongoDB:', error);
        
        // Fallback: save to JSON file if MongoDB fails
        console.log('📄 Falling back to JSON file save...');
        const fs = require('fs').promises;
        const path = require('path');
        const dataPath = path.join(__dirname, '..', 'data', 'data.json');
        
        await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
        console.log('✅ Data saved to JSON file as fallback');
        
        return { success: true, fallback: true };
    }
}

// Get exam by ID
async function getExamById(examId) {
    try {
        return await mongoService.getExamById(examId);
    } catch (error) {
        console.error(`Error getting exam ${examId}:`, error);
        // Fallback to full data load and filter
        const data = await getQuestions();
        return data.exams?.find(exam => exam.examId === examId) || null;
    }
}

// Get subjects for an exam - MongoDB only
async function getSubjectsByExam(examId) {
    console.log(`🔍 Getting subjects for exam: ${examId} from MongoDB`);
    const subjects = await mongoService.getSubjectsByExam(examId);
    console.log(`✅ Found ${subjects.length} subjects from MongoDB`);
    return subjects;
}

// Get questions for a specific paper
async function getQuestionsByPaper(examId, subjectId, paperId, limit = null) {
    try {
        return await mongoService.getQuestionsByPaper(examId, subjectId, paperId, limit);
    } catch (error) {
        console.error(`Error getting questions for ${examId}/${subjectId}/${paperId}:`, error);
        // Fallback to full data load and filter
        const data = await getQuestions();
        const exam = data.exams?.find(e => e.examId === examId);
        const subject = exam?.subjects?.find(s => s.subjectId === subjectId);
        const paper = subject?.questionPapers?.find(p => p.questionPaperId === paperId);
        let questions = paper?.questions || [];
        
        if (limit && questions.length > limit) {
            questions = questions.slice(0, limit);
        }
        
        return questions;
    }
}

// Get random questions for practice
async function getRandomQuestions(examId, subjectId, count = 10) {
    try {
        return await mongoService.getRandomQuestions(examId, subjectId, count);
    } catch (error) {
        console.error(`Error getting random questions:`, error);
        // Fallback: get all questions and randomize
        const data = await getQuestions();
        const exam = data.exams?.find(e => e.examId === examId);
        const subject = exam?.subjects?.find(s => s.subjectId === subjectId);
        
        let allQuestions = [];
        if (subject?.questionPapers) {
            subject.questionPapers.forEach(paper => {
                if (paper.questions) {
                    allQuestions = allQuestions.concat(paper.questions);
                }
            });
        }
        
        // Shuffle and return requested count
        for (let i = allQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
        }
        
        return allQuestions.slice(0, count);
    }
}

// Search questions
async function searchQuestions(searchTerm, examId = null, subjectId = null, limit = 50) {
    try {
        return await mongoService.searchQuestions(searchTerm, examId, subjectId, limit);
    } catch (error) {
        console.error(`Error searching questions:`, error);
        // Fallback: search in loaded data
        const data = await getQuestions();
        let allQuestions = [];
        
        data.exams?.forEach(exam => {
            if (!examId || exam.examId === examId) {
                exam.subjects?.forEach(subject => {
                    if (!subjectId || subject.subjectId === subjectId) {
                        subject.questionPapers?.forEach(paper => {
                            if (paper.questions) {
                                allQuestions = allQuestions.concat(
                                    paper.questions.map(q => ({
                                        ...q,
                                        examId: exam.examId,
                                        subjectId: subject.subjectId,
                                        paperId: paper.questionPaperId
                                    }))
                                );
                            }
                        });
                    }
                });
            }
        });
        
        // Simple text search
        const searchResults = allQuestions.filter(q => 
            q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.options?.some(opt => opt.text.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        return searchResults.slice(0, limit);
    }
}

// Get all exams (for backward compatibility)
async function getAllExams() {
    try {
        return await mongoService.getExams();
    } catch (error) {
        console.error('Error getting all exams:', error);
        const data = await getQuestions();
        return data.exams || [];
    }
}

// Health check for data system
async function healthCheck() {
    try {
        const mongoHealth = await mongoService.healthCheck();
        return {
            status: 'healthy',
            dataSource: 'mongodb',
            mongoHealth
        };
    } catch (error) {
        console.warn('MongoDB health check failed, checking JSON fallback...');
        try {
            const data = await getQuestions();
            return {
                status: 'healthy',
                dataSource: data.source || 'json_fallback',
                examCount: data.exams?.length || 0
            };
        } catch (fallbackError) {
            return {
                status: 'unhealthy',
                error: fallbackError.message
            };
        }
    }
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
