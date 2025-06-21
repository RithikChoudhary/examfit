const { MongoClient } = require('mongodb');

class MongoService {
    constructor() {
        this.client = null;
        this.db = null;
        this.connectionString = process.env.MONGODB_URI || "mongodb+srv://examfit:snpN01ULMUC2cdI5@examfit.hzuwfkl.mongodb.net/?retryWrites=true&w=majority&appName=examfit";
        this.dbName = 'examfit';
        this.isConnected = false;
    }

    async connect() {
        try {
            if (this.isConnected) {
                return this.db;
            }

            console.log('📡 Connecting to MongoDB...');
            this.client = new MongoClient(this.connectionString);
            await this.client.connect();
            this.db = this.client.db(this.dbName);
            this.isConnected = true;
            
            console.log('✅ MongoDB connected successfully');
            return this.db;
        } catch (error) {
            console.error('❌ MongoDB connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.close();
                this.isConnected = false;
                console.log('📴 MongoDB disconnected');
            }
        } catch (error) {
            console.error('Error disconnecting from MongoDB:', error);
        }
    }

    // Get all exams
    async getExams() {
        try {
            const db = await this.connect();
            const exams = await db.collection('exams').find({ isActive: true }).toArray();
            
            // For each exam, get its subjects
            for (let exam of exams) {
                exam.subjects = await this.getSubjectsByExam(exam.examId);
            }
            
            return exams;
        } catch (error) {
            console.error('Error fetching exams:', error);
            throw error;
        }
    }

    // Get exam by ID
    async getExamById(examId) {
        try {
            const db = await this.connect();
            const exam = await db.collection('exams').findOne({ examId, isActive: true });
            
            if (exam) {
                exam.subjects = await this.getSubjectsByExam(examId);
            }
            
            return exam;
        } catch (error) {
            console.error('Error fetching exam:', error);
            throw error;
        }
    }

    // Get subjects by exam ID
    async getSubjectsByExam(examId) {
        try {
            const db = await this.connect();
            const subjects = await db.collection('subjects').find({ examId }).toArray();
            
            // For each subject, get its question papers
            for (let subject of subjects) {
                subject.questionPapers = await this.getQuestionPapersBySubject(examId, subject.subjectId);
            }
            
            return subjects;
        } catch (error) {
            console.error('Error fetching subjects:', error);
            throw error;
        }
    }

    // Get question papers by subject
    async getQuestionPapersBySubject(examId, subjectId) {
        try {
            const db = await this.connect();
            const papers = await db.collection('questionPapers').find({ examId, subjectId }).toArray();
            
            // For each paper, get question count and sample questions
            for (let paper of papers) {
                paper.questions = await this.getQuestionsByPaper(examId, subjectId, paper.paperId);
            }
            
            return papers;
        } catch (error) {
            console.error('Error fetching question papers:', error);
            throw error;
        }
    }

    // Get questions by paper
    async getQuestionsByPaper(examId, subjectId, paperId, limit = null) {
        try {
            const db = await this.connect();
            let query = { examId, subjectId, paperId };
            
            let cursor = db.collection('questions').find(query);
            
            if (limit) {
                cursor = cursor.limit(limit);
            }
            
            return await cursor.toArray();
        } catch (error) {
            console.error('Error fetching questions:', error);
            throw error;
        }
    }

    // Get random questions for practice
    async getRandomQuestions(examId, subjectId, count = 10) {
        try {
            const db = await this.connect();
            const questions = await db.collection('questions').aggregate([
                { $match: { examId, subjectId } },
                { $sample: { size: count } }
            ]).toArray();
            
            return questions;
        } catch (error) {
            console.error('Error fetching random questions:', error);
            throw error;
        }
    }

    // Search questions
    async searchQuestions(searchTerm, examId = null, subjectId = null, limit = 50) {
        try {
            const db = await this.connect();
            let query = {
                $text: { $search: searchTerm }
            };
            
            if (examId) query.examId = examId;
            if (subjectId) query.subjectId = subjectId;
            
            const questions = await db.collection('questions')
                .find(query)
                .limit(limit)
                .toArray();
                
            return questions;
        } catch (error) {
            console.error('Error searching questions:', error);
            throw error;
        }
    }

    // Get question statistics
    async getQuestionStats(examId = null, subjectId = null) {
        try {
            const db = await this.connect();
            let matchQuery = {};
            
            if (examId) matchQuery.examId = examId;
            if (subjectId) matchQuery.subjectId = subjectId;
            
            const stats = await db.collection('questions').aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: null,
                        totalQuestions: { $sum: 1 },
                        byDifficulty: {
                            $push: "$difficulty"
                        },
                        byExam: {
                            $addToSet: "$examId"
                        },
                        bySubject: {
                            $addToSet: "$subjectId"
                        }
                    }
                }
            ]).toArray();
            
            return stats[0] || { totalQuestions: 0 };
        } catch (error) {
            console.error('Error fetching stats:', error);
            throw error;
        }
    }

    // Add new question (for future automation)
    async addQuestion(questionData) {
        try {
            const db = await this.connect();
            
            // Add timestamps
            questionData.createdAt = new Date();
            questionData.updatedAt = new Date();
            
            const result = await db.collection('questions').insertOne(questionData);
            return result;
        } catch (error) {
            console.error('Error adding question:', error);
            throw error;
        }
    }

    // Add multiple questions (for batch operations)
    async addQuestions(questionsArray) {
        try {
            const db = await this.connect();
            
            // Add timestamps to all questions
            const now = new Date();
            questionsArray.forEach(q => {
                q.createdAt = now;
                q.updatedAt = now;
            });
            
            const result = await db.collection('questions').insertMany(questionsArray);
            return result;
        } catch (error) {
            console.error('Error adding questions:', error);
            throw error;
        }
    }

    // Health check
    async healthCheck() {
        try {
            const db = await this.connect();
            await db.admin().ping();
            
            const stats = await Promise.all([
                db.collection('exams').countDocuments(),
                db.collection('subjects').countDocuments(),
                db.collection('questionPapers').countDocuments(),
                db.collection('questions').countDocuments()
            ]);
            
            return {
                status: 'healthy',
                collections: {
                    exams: stats[0],
                    subjects: stats[1],
                    questionPapers: stats[2],
                    questions: stats[3]
                },
                timestamp: new Date()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    // Fallback to JSON (for gradual migration)
    async getDataWithFallback() {
        try {
            // Try MongoDB first
            const exams = await this.getExams();
            return {
                exams,
                source: 'mongodb',
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.warn('MongoDB failed, falling back to JSON:', error.message);
            
            // Fallback to JSON file
            const fs = require('fs').promises;
            const path = require('path');
            const dataPath = path.join(__dirname, '../data/data.json');
            
            try {
                const jsonData = await fs.readFile(dataPath, 'utf8');
                const data = JSON.parse(jsonData);
                return {
                    ...data,
                    source: 'json_fallback'
                };
            } catch (jsonError) {
                throw new Error(`Both MongoDB and JSON fallback failed: ${error.message}, ${jsonError.message}`);
            }
        }
    }
}

// Singleton instance
const mongoService = new MongoService();

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoService.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await mongoService.disconnect();
    process.exit(0);
});

module.exports = mongoService;
