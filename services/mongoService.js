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
            
            // Detect if running on Vercel
            const isVercel = process.env.VERCEL || process.env.NOW_REGION;
            
            // PERFORMANCE OPTIMIZED: Better connection pooling
            const options = {
                maxPoolSize: isVercel ? 3 : 15,    // Increased pool size for better concurrency
                minPoolSize: isVercel ? 1 : 2,     // Keep some connections alive
                serverSelectionTimeoutMS: isVercel ? 3000 : 8000,
                socketTimeoutMS: 45000,            // Longer timeout for large queries
                connectTimeoutMS: 10000,
                retryWrites: true,
                w: 'majority',
                maxIdleTimeMS: 60000,              // Keep connections alive longer
                compressors: ['zlib'],             // Enable compression for better performance
                readPreference: 'secondaryPreferred' // Use secondary for reads when possible
            };
            
            // Add environment-specific TLS options
            if (isVercel) {
                console.log('🔧 Applying Vercel-specific MongoDB options...');
                options.tls = true;
                options.tlsAllowInvalidCertificates = true;
            } else {
                options.tls = true;
            }
            
            console.log('📡 Attempting MongoDB connection...');
            
            this.client = new MongoClient(this.connectionString, options);
            await this.client.connect();
            
            // Test the connection
            await this.client.db('admin').admin().ping();
            
            this.db = this.client.db(this.dbName);
            this.isConnected = true;
            
            // PERFORMANCE BOOST: Ensure critical indexes exist
            await this.ensureIndexes();
            
            console.log('✅ MongoDB connected successfully with performance optimizations');
            return this.db;
            
        } catch (error) {
            console.error('❌ MongoDB connection failed after all retries:', error.message);
            this.isConnected = false;
            this.client = null;
            this.db = null;
            throw error;
        }
    }

    // PERFORMANCE BOOST: Ensure critical indexes exist for fast queries
    async ensureIndexes() {
        try {
            const db = this.db;
            
            // Critical compound index for question queries
            await db.collection('questions').createIndex(
                { examId: 1, subjectId: 1, paperId: 1 },
                { background: true, name: 'questions_lookup_idx' }
            );
            
            // Index for exam queries
            await db.collection('exams').createIndex(
                { examId: 1, isActive: 1 },
                { background: true, name: 'exams_lookup_idx' }
            );
            
            // Index for subject queries
            await db.collection('subjects').createIndex(
                { examId: 1 },
                { background: true, name: 'subjects_lookup_idx' }
            );
            
            // Index for question papers
            await db.collection('questionPapers').createIndex(
                { examId: 1, subjectId: 1 },
                { background: true, name: 'papers_lookup_idx' }
            );
            
            console.log('⚡ Performance indexes ensured');
        } catch (error) {
            console.warn('⚠️ Index creation warning (may already exist):', error.message);
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

    // Get all exams - lightweight version (no subjects loaded by default)
    async getExams() {
        try {
            const db = await this.connect();
            const exams = await db.collection('exams').find({ isActive: true }).toArray();
            
            // Don't load subjects by default - they'll be loaded on demand
            // This prevents the 10+ second delay when loading all exams
            for (let exam of exams) {
                exam.subjects = []; // Empty array, load on demand
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

    // Get subjects by exam ID - Optimized for performance
    async getSubjectsByExam(examId) {
        try {
            const db = await this.connect();
            console.log(`🔍 MongoDB: Querying subjects for examId: ${examId}`);
            
            const subjects = await db.collection('subjects').find({ examId }).toArray();
            console.log(`📊 Found ${subjects.length} subjects in MongoDB for ${examId}`);
            
            if (!subjects || subjects.length === 0) {
                console.log(`⚠️ No subjects found in MongoDB for exam: ${examId}`);
                return [];
            }
            
            // Get all question papers for this exam in one query
            const allPapers = await db.collection('questionPapers').find({ examId }).toArray();
            console.log(`📄 Found ${allPapers.length} total papers for ${examId}`);
            
            // Get question counts for all papers in one aggregation query
            const questionCounts = await db.collection('questions').aggregate([
                { $match: { examId } },
                { 
                    $group: {
                        _id: { subjectId: "$subjectId", paperId: "$paperId" },
                        count: { $sum: 1 }
                    }
                }
            ]).toArray();
            
            // Create a lookup map for question counts
            const countMap = {};
            questionCounts.forEach(item => {
                const key = `${item._id.subjectId}:${item._id.paperId}`;
                countMap[key] = item.count;
            });
            
            // Process each subject
            for (let subject of subjects) {
                // Get papers for this subject
                const subjectPapers = allPapers.filter(paper => paper.subjectId === subject.subjectId);
                
                // Transform papers with question counts
                const transformedPapers = subjectPapers.map(paper => {
                    const countKey = `${subject.subjectId}:${paper.paperId}`;
                    const questionCount = countMap[countKey] || 0;
                    
                    return {
                        questionPaperId: paper.paperId,
                        questionPaperName: paper.paperName,
                        section: paper.section || '',
                        questionCount: questionCount,
                        questions: []
                    };
                });
                
                subject.questionPapers = transformedPapers;
                subject.questionPaperCount = transformedPapers.length;
                subject.totalQuestions = transformedPapers.reduce((total, paper) => total + paper.questionCount, 0);
            }
            
            console.log(`✅ MongoDB: Successfully loaded ${subjects.length} subjects for ${examId} in optimized query`);
            return subjects;
            
        } catch (error) {
            console.error(`❌ MongoDB subjects query failed for ${examId}:`, error.message);
            throw error;
        }
    }

    // Get question papers by subject
    async getQuestionPapersBySubject(examId, subjectId) {
        try {
            const db = await this.connect();
            const papers = await db.collection('questionPapers').find({ examId, subjectId }).toArray();
            
            // Transform to match expected structure and get question count
            for (let paper of papers) {
                // Fix field names to match what the app expects
                paper.questionPaperId = paper.paperId;
                paper.questionPaperName = paper.paperName;
                
                paper.questions = await this.getQuestionsByPaper(examId, subjectId, paper.paperId);
            }
            
            return papers;
        } catch (error) {
            console.error('Error fetching question papers:', error);
            throw error;
        }
    }

    // PERFORMANCE OPTIMIZED: Get questions by paper - Single query with caching
    async getQuestionsByPaper(examId, subjectId, paperId, limit = null) {
        try {
            const db = await this.connect();
            
            // PERFORMANCE FIX: Use single optimized query instead of multiple attempts
            console.log(`🚀 OPTIMIZED: Single query for questions: ${examId}/${subjectId}/${paperId}`);
            
            // Build optimized query with projection for better performance
            const query = { examId, subjectId, paperId };
            const projection = {
                questionId: 1,
                question: 1,
                options: 1,
                correctOption: 1,
                explanation: 1,
                difficulty: 1,
                tags: 1
            };
            
            // Single optimized query with proper indexing hints
            const startTime = Date.now();
            let cursor = db.collection('questions')
                .find(query, { projection })
                .hint({ examId: 1, subjectId: 1, paperId: 1 }); // Use index hint for better performance
            
            if (limit) {
                cursor = cursor.limit(limit);
            }
            
            const questions = await cursor.toArray();
            const queryTime = Date.now() - startTime;
            
            console.log(`⚡ PERFORMANCE: Loaded ${questions.length} questions in ${queryTime}ms`);
            
            // If no questions found, try fallback without extensive debugging
            if (questions.length === 0) {
                console.log(`⚠️ No questions found for paper ${paperId}, trying without subject constraint...`);
                const fallbackQuestions = await db.collection('questions')
                    .find({ examId, paperId }, { projection })
                    .limit(limit || 50)
                    .toArray();
                
                if (fallbackQuestions.length > 0) {
                    console.log(`✅ Found ${fallbackQuestions.length} questions via fallback query`);
                    return fallbackQuestions;
                }
            }
            
            return questions;
            
        } catch (error) {
            console.error('❌ Error fetching questions:', error.message);
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
