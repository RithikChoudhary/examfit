const cacheService = require('./cacheService');

class ProgressService {
    constructor() {
        // No longer need file path - using MongoDB
    }

    // Get or create progress data from MongoDB
    async getProgressData() {
        const cacheKey = 'progress_data';
        
        const cached = cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            console.log('📊 Loading progress data from MongoDB...');
            
            // Use MongoDB instead of file system
            const mongoService = require('./mongoService');
            const db = await mongoService.connect();
            
            // Get sessions from MongoDB
            const sessions = await db.collection('progressSessions').find({}).sort({ date: -1 }).toArray();
            
            // Get user stats from MongoDB
            const userStats = await db.collection('userStats').find({}).toArray();
            const userStatsObj = {};
            userStats.forEach(stat => {
                if (!userStatsObj[stat.examId]) {
                    userStatsObj[stat.examId] = {};
                }
                userStatsObj[stat.examId][stat.subjectId] = stat.stats;
            });
            
            // Get global stats from MongoDB
            const globalStats = await db.collection('globalStats').findOne({}) || {
                totalSessions: 0,
                totalQuestions: 0,
                totalCorrect: 0,
                averageScore: 0,
                createdAt: new Date().toISOString()
            };
            
            const progressData = {
                sessions,
                userStats: userStatsObj,
                globalStats
            };
            
            console.log(`✅ Loaded ${sessions.length} progress sessions from MongoDB`);
            
            cacheService.set(cacheKey, progressData);
            
            return progressData;
        } catch (error) {
            console.error('❌ Error loading progress data from MongoDB:', error);
            
            // Return default data structure
            const defaultData = { 
                sessions: [], 
                userStats: {},
                globalStats: {
                    totalSessions: 0,
                    totalQuestions: 0,
                    totalCorrect: 0,
                    averageScore: 0,
                    createdAt: new Date().toISOString()
                }
            };
            
            return defaultData;
        }
    }

    // Save progress data to MongoDB
    async saveProgressData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid progress data structure');
        }
        
        try {
            console.log('💾 Saving progress data to MongoDB...');
            
            // Use MongoDB instead of file system
            const mongoService = require('./mongoService');
            const db = await mongoService.connect();
            
            // Save sessions (only new ones)
            if (data.sessions && data.sessions.length > 0) {
                // Get existing session IDs to avoid duplicates
                const existingSessions = await db.collection('progressSessions').find({}, { projection: { id: 1 } }).toArray();
                const existingIds = new Set(existingSessions.map(s => s.id));
                
                const newSessions = data.sessions.filter(session => !existingIds.has(session.id));
                
                if (newSessions.length > 0) {
                    await db.collection('progressSessions').insertMany(newSessions);
                    console.log(`✅ Saved ${newSessions.length} new progress sessions`);
                }
            }
            
            // Save user stats
            if (data.userStats) {
                for (const examId in data.userStats) {
                    for (const subjectId in data.userStats[examId]) {
                        await db.collection('userStats').updateOne(
                            { examId, subjectId },
                            { 
                                $set: { 
                                    examId, 
                                    subjectId, 
                                    stats: data.userStats[examId][subjectId],
                                    updatedAt: new Date()
                                }
                            },
                            { upsert: true }
                        );
                    }
                }
            }
            
            // Save global stats
            if (data.globalStats) {
                await db.collection('globalStats').updateOne(
                    {},
                    { 
                        $set: { 
                            ...data.globalStats,
                            updatedAt: new Date()
                        }
                    },
                    { upsert: true }
                );
            }
            
            console.log('✅ Progress data saved to MongoDB');
            
            // Update cache
            cacheService.set('progress_data', data);
        } catch (error) {
            console.error('❌ Error saving progress data to MongoDB:', error);
            throw error;
        }
    }

    // Save practice session
    async saveSession(sessionData) {
        const progressData = await this.getProgressData();
        
        // Validate session data
        this.validateSessionData(sessionData);
        
        const session = {
            id: sessionData.id || Date.now().toString(),
            examId: sessionData.examId,
            examName: sessionData.examName,
            subjectId: sessionData.subjectId,
            subjectName: sessionData.subjectName,
            paperId: sessionData.paperId,
            paperName: sessionData.paperName,
            date: sessionData.date || new Date().toISOString(),
            score: sessionData.score,
            correct: sessionData.correct,
            total: sessionData.total,
            timeSpent: sessionData.timeSpent || 0,
            results: sessionData.results || []
        };

        progressData.sessions.push(session);
        
        // Update user stats
        await this.updateUserStats(progressData, session);
        
        // Update global stats
        await this.updateGlobalStats(progressData, session);
        
        await this.saveProgressData(progressData);
        
        return session;
    }

    // Get session by ID
    async getSession(sessionId) {
        const progressData = await this.getProgressData();
        const session = progressData.sessions.find(s => s.id === sessionId);
        
        if (!session) {
            throw new Error('Session not found');
        }
        
        return session;
    }

    // Get user sessions with filtering and pagination
    async getUserSessions(options = {}) {
        const progressData = await this.getProgressData();
        let sessions = [...progressData.sessions];
        
        // Apply filters
        if (options.examId) {
            sessions = sessions.filter(s => s.examId === options.examId);
        }
        
        if (options.subjectId) {
            sessions = sessions.filter(s => s.subjectId === options.subjectId);
        }
        
        if (options.dateFrom) {
            sessions = sessions.filter(s => new Date(s.date) >= new Date(options.dateFrom));
        }
        
        if (options.dateTo) {
            sessions = sessions.filter(s => new Date(s.date) <= new Date(options.dateTo));
        }
        
        // Sort by date (newest first)
        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Pagination
        const page = options.page || 1;
        const limit = options.limit || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        const paginatedSessions = sessions.slice(startIndex, endIndex);
        
        return {
            sessions: paginatedSessions,
            pagination: {
                page,
                limit,
                total: sessions.length,
                totalPages: Math.ceil(sessions.length / limit),
                hasNext: endIndex < sessions.length,
                hasPrev: page > 1
            }
        };
    }

    // Get user statistics
    async getUserStats(examId = null, subjectId = null) {
        const progressData = await this.getProgressData();
        
        if (examId && subjectId) {
            return progressData.userStats[examId]?.[subjectId] || this.getDefaultSubjectStats();
        }
        
        if (examId) {
            return progressData.userStats[examId] || {};
        }
        
        return progressData.userStats;
    }

    // Get performance analytics
    async getPerformanceAnalytics(options = {}) {
        const progressData = await this.getProgressData();
        let sessions = [...progressData.sessions];
        
        // Apply date filter
        if (options.dateFrom) {
            sessions = sessions.filter(s => new Date(s.date) >= new Date(options.dateFrom));
        }
        
        if (options.dateTo) {
            sessions = sessions.filter(s => new Date(s.date) <= new Date(options.dateTo));
        }
        
        // Overall performance
        const totalSessions = sessions.length;
        const totalQuestions = sessions.reduce((sum, s) => sum + s.total, 0);
        const totalCorrect = sessions.reduce((sum, s) => sum + s.correct, 0);
        const averageScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
        const totalTimeSpent = sessions.reduce((sum, s) => sum + (s.timeSpent || 0), 0);
        
        // Subject-wise performance
        const subjectPerformance = {};
        sessions.forEach(session => {
            const key = `${session.examName}-${session.subjectName}`;
            if (!subjectPerformance[key]) {
                subjectPerformance[key] = {
                    examId: session.examId,
                    examName: session.examName,
                    subjectId: session.subjectId,
                    subjectName: session.subjectName,
                    sessions: 0,
                    totalQuestions: 0,
                    totalCorrect: 0,
                    totalTime: 0,
                    averageScore: 0,
                    bestScore: 0,
                    lastSessionDate: null
                };
            }
            
            const perf = subjectPerformance[key];
            perf.sessions++;
            perf.totalQuestions += session.total;
            perf.totalCorrect += session.correct;
            perf.totalTime += session.timeSpent || 0;
            perf.bestScore = Math.max(perf.bestScore, session.score);
            perf.averageScore = Math.round((perf.totalCorrect / perf.totalQuestions) * 100);
            
            if (!perf.lastSessionDate || new Date(session.date) > new Date(perf.lastSessionDate)) {
                perf.lastSessionDate = session.date;
            }
        });
        
        // Daily performance trend (last 30 days)
        const dailyTrend = this.getDailyTrend(sessions, 30);
        
        // Score distribution
        const scoreRanges = {
            '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0
        };
        
        sessions.forEach(session => {
            const score = session.score;
            if (score <= 20) scoreRanges['0-20']++;
            else if (score <= 40) scoreRanges['21-40']++;
            else if (score <= 60) scoreRanges['41-60']++;
            else if (score <= 80) scoreRanges['61-80']++;
            else scoreRanges['81-100']++;
        });
        
        return {
            overview: {
                totalSessions,
                totalQuestions,
                totalCorrect,
                averageScore,
                totalTimeSpent,
                averageTimePerSession: totalSessions > 0 ? Math.round(totalTimeSpent / totalSessions) : 0
            },
            subjectPerformance: Object.values(subjectPerformance),
            dailyTrend,
            scoreDistribution: scoreRanges,
            recentSessions: sessions.slice(0, 5)
        };
    }

    // Get strength and weakness analysis
    async getStrengthWeaknessAnalysis(examId, subjectId) {
        const progressData = await this.getProgressData();
        const sessions = progressData.sessions.filter(s => 
            s.examId === examId && s.subjectId === subjectId
        );
        
        if (sessions.length === 0) {
            return {
                strengths: [],
                weaknesses: [],
                recommendations: []
            };
        }
        
        // Analyze performance by section/topic if available
        const sectionPerformance = {};
        
        sessions.forEach(session => {
            if (session.results) {
                session.results.forEach(result => {
                    // Assuming we can extract section info from question or paper data
                    const section = result.section || 'General';
                    
                    if (!sectionPerformance[section]) {
                        sectionPerformance[section] = {
                            total: 0,
                            correct: 0,
                            attempts: 0
                        };
                    }
                    
                    sectionPerformance[section].total++;
                    sectionPerformance[section].attempts++;
                    if (result.isCorrect) {
                        sectionPerformance[section].correct++;
                    }
                });
            }
        });
        
        // Calculate section scores
        const sections = Object.keys(sectionPerformance).map(section => ({
            section,
            accuracy: Math.round((sectionPerformance[section].correct / sectionPerformance[section].total) * 100),
            attempts: sectionPerformance[section].attempts
        }));
        
        // Sort by accuracy
        sections.sort((a, b) => b.accuracy - a.accuracy);
        
        const strengths = sections.filter(s => s.accuracy >= 70).slice(0, 3);
        const weaknesses = sections.filter(s => s.accuracy < 70).slice(0, 3);
        
        // Generate recommendations
        const recommendations = this.generateRecommendations(sections, sessions);
        
        return {
            strengths,
            weaknesses,
            recommendations
        };
    }

    // Delete session
    async deleteSession(sessionId) {
        const progressData = await this.getProgressData();
        const sessionIndex = progressData.sessions.findIndex(s => s.id === sessionId);
        
        if (sessionIndex === -1) {
            throw new Error('Session not found');
        }
        
        const deletedSession = progressData.sessions[sessionIndex];
        progressData.sessions.splice(sessionIndex, 1);
        
        // Recalculate stats
        await this.recalculateStats(progressData);
        
        await this.saveProgressData(progressData);
        
        return deletedSession;
    }

    // Update user stats
    async updateUserStats(progressData, session) {
        if (!progressData.userStats[session.examId]) {
            progressData.userStats[session.examId] = {};
        }
        
        if (!progressData.userStats[session.examId][session.subjectId]) {
            progressData.userStats[session.examId][session.subjectId] = this.getDefaultSubjectStats();
        }
        
        const stats = progressData.userStats[session.examId][session.subjectId];
        stats.totalSessions++;
        stats.totalQuestions += session.total;
        stats.totalCorrect += session.correct;
        stats.totalTime += session.timeSpent || 0;
        stats.bestScore = Math.max(stats.bestScore, session.score);
        stats.averageScore = Math.round((stats.totalCorrect / stats.totalQuestions) * 100);
        stats.lastSessionDate = session.date;
    }

    // Update global stats
    async updateGlobalStats(progressData, session) {
        if (!progressData.globalStats) {
            progressData.globalStats = {
                totalSessions: 0,
                totalQuestions: 0,
                totalCorrect: 0,
                averageScore: 0,
                createdAt: new Date().toISOString()
            };
        }
        
        const global = progressData.globalStats;
        global.totalSessions++;
        global.totalQuestions += session.total;
        global.totalCorrect += session.correct;
        global.averageScore = Math.round((global.totalCorrect / global.totalQuestions) * 100);
        global.updatedAt = new Date().toISOString();
    }

    // Get daily trend
    getDailyTrend(sessions, days) {
        const trend = [];
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const daySessions = sessions.filter(s => 
                s.date.split('T')[0] === dateStr
            );
            
            const totalQuestions = daySessions.reduce((sum, s) => sum + s.total, 0);
            const totalCorrect = daySessions.reduce((sum, s) => sum + s.correct, 0);
            const averageScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
            
            trend.push({
                date: dateStr,
                sessions: daySessions.length,
                averageScore,
                totalQuestions
            });
        }
        
        return trend;
    }

    // Generate recommendations
    generateRecommendations(sections, sessions) {
        const recommendations = [];
        
        // Based on weak areas
        const weakSections = sections.filter(s => s.accuracy < 50);
        if (weakSections.length > 0) {
            recommendations.push(`Focus more on ${weakSections[0].section} - current accuracy is ${weakSections[0].accuracy}%`);
        }
        
        // Based on practice frequency
        const recentSessions = sessions.filter(s => 
            new Date(s.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        );
        
        if (recentSessions.length < 3) {
            recommendations.push('Try to practice more regularly - aim for at least 3 sessions per week');
        }
        
        // Based on overall performance
        const overallScore = sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length;
        if (overallScore < 60) {
            recommendations.push('Consider reviewing fundamental concepts before attempting more practice questions');
        }
        
        return recommendations;
    }

    // Default subject stats
    getDefaultSubjectStats() {
        return {
            totalSessions: 0,
            totalQuestions: 0,
            totalCorrect: 0,
            totalTime: 0,
            bestScore: 0,
            averageScore: 0,
            lastSessionDate: null
        };
    }

    // Validate session data
    validateSessionData(sessionData) {
        const required = ['examId', 'examName', 'subjectId', 'subjectName', 'paperId', 'paperName', 'score', 'correct', 'total'];
        
        for (const field of required) {
            if (sessionData[field] === undefined || sessionData[field] === null) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        if (typeof sessionData.score !== 'number' || sessionData.score < 0 || sessionData.score > 100) {
            throw new Error('Score must be a number between 0 and 100');
        }
        
        if (typeof sessionData.correct !== 'number' || sessionData.correct < 0) {
            throw new Error('Correct answers must be a non-negative number');
        }
        
        if (typeof sessionData.total !== 'number' || sessionData.total < 1) {
            throw new Error('Total questions must be a positive number');
        }
        
        if (sessionData.correct > sessionData.total) {
            throw new Error('Correct answers cannot exceed total questions');
        }
        
        return true;
    }

    // Recalculate all stats
    async recalculateStats(progressData) {
        // Reset stats
        progressData.userStats = {};
        progressData.globalStats = {
            totalSessions: 0,
            totalQuestions: 0,
            totalCorrect: 0,
            averageScore: 0,
            createdAt: progressData.globalStats?.createdAt || new Date().toISOString()
        };
        
        // Recalculate from sessions
        for (const session of progressData.sessions) {
            await this.updateUserStats(progressData, session);
            await this.updateGlobalStats(progressData, session);
        }
    }

    // Clear cache
    clearCache() {
        cacheService.invalidatePattern('progress_.*');
    }
}

module.exports = new ProgressService();
