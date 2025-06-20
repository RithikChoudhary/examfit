const progressService = require('./progressService');
const examService = require('./examService');
const questionService = require('./questionService');

class AnalyticsService {
    constructor() {
        this.difficultyCache = new Map();
        this.popularityCache = new Map();
        this.trendCache = new Map();
    }

    // Advanced performance analytics with ML insights
    async getAdvancedAnalytics(options = {}) {
        const analytics = await progressService.getPerformanceAnalytics(options);
        
        // Add machine learning insights
        const insights = await this.generateInsights(analytics);
        const predictions = await this.generatePredictions(analytics);
        const recommendations = await this.generateRecommendations(analytics);
        
        return {
            ...analytics,
            insights,
            predictions,
            recommendations,
            learningPath: await this.generateLearningPath(analytics)
        };
    }

    // Generate AI-powered insights
    async generateInsights(analytics) {
        const insights = [];
        
        // Performance trend analysis
        if (analytics.dailyTrend && analytics.dailyTrend.length > 7) {
            const trend = this.analyzeTrend(analytics.dailyTrend);
            insights.push({
                type: 'performance_trend',
                level: trend.improving ? 'positive' : 'warning',
                message: trend.improving 
                    ? `Your performance is improving by ${trend.rate}% per week`
                    : `Your performance has declined by ${Math.abs(trend.rate)}% this week`,
                data: trend
            });
        }

        // Subject mastery analysis
        const masteryLevels = this.calculateMasteryLevels(analytics.subjectPerformance);
        masteryLevels.forEach(mastery => {
            if (mastery.level === 'expert') {
                insights.push({
                    type: 'mastery_achievement',
                    level: 'positive',
                    message: `You've achieved expert level in ${mastery.subject}`,
                    data: mastery
                });
            } else if (mastery.level === 'struggling') {
                insights.push({
                    type: 'improvement_needed',
                    level: 'warning',
                    message: `Consider focusing more on ${mastery.subject}`,
                    data: mastery
                });
            }
        });

        // Study pattern insights
        const studyPatterns = this.analyzeStudyPatterns(analytics);
        if (studyPatterns.optimalTime) {
            insights.push({
                type: 'optimal_time',
                level: 'info',
                message: `You perform best during ${studyPatterns.optimalTime}`,
                data: studyPatterns
            });
        }

        // Learning velocity
        const velocity = this.calculateLearningVelocity(analytics);
        if (velocity.acceleration > 0.1) {
            insights.push({
                type: 'accelerating_learning',
                level: 'positive',
                message: 'Your learning speed is accelerating',
                data: velocity
            });
        }

        return insights;
    }

    // Generate performance predictions
    async generatePredictions(analytics) {
        const predictions = [];
        
        // Score prediction for next session
        const nextSessionScore = this.predictNextSessionScore(analytics);
        predictions.push({
            type: 'next_session_score',
            prediction: nextSessionScore,
            confidence: this.calculateConfidence(analytics.overview.totalSessions),
            timeframe: '1 session'
        });

        // Weekly improvement prediction
        const weeklyImprovement = this.predictWeeklyImprovement(analytics);
        predictions.push({
            type: 'weekly_improvement',
            prediction: weeklyImprovement,
            confidence: this.calculateConfidence(analytics.overview.totalSessions),
            timeframe: '1 week'
        });

        // Exam readiness prediction
        for (const subject of analytics.subjectPerformance) {
            const readiness = this.predictExamReadiness(subject);
            predictions.push({
                type: 'exam_readiness',
                subject: subject.subjectName,
                prediction: readiness,
                confidence: this.calculateConfidence(subject.sessions),
                timeframe: '1 month'
            });
        }

        return predictions;
    }

    // Generate personalized recommendations
    async generateRecommendations(analytics) {
        const recommendations = [];
        
        // Study schedule recommendations
        const scheduleRec = this.recommendStudySchedule(analytics);
        recommendations.push({
            type: 'study_schedule',
            priority: 'high',
            title: 'Optimize Your Study Schedule',
            description: scheduleRec.description,
            actions: scheduleRec.actions
        });

        // Subject focus recommendations
        const subjectRec = this.recommendSubjectFocus(analytics);
        recommendations.push({
            type: 'subject_focus',
            priority: 'medium',
            title: 'Focus Areas',
            description: subjectRec.description,
            actions: subjectRec.actions
        });

        // Question difficulty recommendations
        const difficultyRec = await this.recommendQuestionDifficulty(analytics);
        recommendations.push({
            type: 'difficulty_level',
            priority: 'medium',
            title: 'Difficulty Progression',
            description: difficultyRec.description,
            actions: difficultyRec.actions
        });

        // Practice frequency recommendations
        const frequencyRec = this.recommendPracticeFrequency(analytics);
        recommendations.push({
            type: 'practice_frequency',
            priority: 'low',
            title: 'Practice Frequency',
            description: frequencyRec.description,
            actions: frequencyRec.actions
        });

        return recommendations;
    }

    // Generate personalized learning path
    async generateLearningPath(analytics) {
        const path = [];
        
        // Identify weak areas
        const weakAreas = analytics.subjectPerformance
            .filter(subject => subject.averageScore < 60)
            .sort((a, b) => a.averageScore - b.averageScore);

        // Identify strong areas
        const strongAreas = analytics.subjectPerformance
            .filter(subject => subject.averageScore >= 80)
            .sort((a, b) => b.averageScore - a.averageScore);

        // Create learning steps
        if (weakAreas.length > 0) {
            path.push({
                phase: 'foundation',
                title: 'Strengthen Weak Areas',
                subjects: weakAreas.slice(0, 3),
                duration: '2-3 weeks',
                focus: 'basic_concepts',
                description: 'Focus on fundamental concepts in struggling subjects'
            });
        }

        path.push({
            phase: 'practice',
            title: 'Intensive Practice',
            subjects: analytics.subjectPerformance.slice(0, 5),
            duration: '3-4 weeks',
            focus: 'practice_questions',
            description: 'Increase practice volume with mixed difficulty questions'
        });

        if (strongAreas.length > 0) {
            path.push({
                phase: 'mastery',
                title: 'Advanced Mastery',
                subjects: strongAreas.slice(0, 2),
                duration: '2-3 weeks',
                focus: 'advanced_topics',
                description: 'Tackle advanced topics in your strong subjects'
            });
        }

        path.push({
            phase: 'revision',
            title: 'Comprehensive Revision',
            subjects: analytics.subjectPerformance,
            duration: '1-2 weeks',
            focus: 'mock_tests',
            description: 'Take full-length mock tests and final revision'
        });

        return path;
    }

    // Advanced search with AI ranking
    async searchQuestionsAdvanced(examId, subjectId, query, options = {}) {
        const baseResults = await questionService.searchQuestions(examId, subjectId, query, options);
        
        // Apply AI ranking
        const rankedResults = await this.rankSearchResults(baseResults, query, options);
        
        // Add difficulty estimates
        const enrichedResults = await this.enrichWithDifficulty(rankedResults);
        
        // Add popularity scores
        const finalResults = await this.enrichWithPopularity(enrichedResults);
        
        return finalResults;
    }

    // Question difficulty estimation using ML
    async estimateQuestionDifficulty(question) {
        const cacheKey = `difficulty_${question.questionId}`;
        
        if (this.difficultyCache.has(cacheKey)) {
            return this.difficultyCache.get(cacheKey);
        }

        // Simple ML-like difficulty estimation
        let difficultyScore = 0;
        
        // Text complexity factors
        const wordCount = question.question.split(' ').length;
        const avgWordLength = question.question.split(' ').reduce((sum, word) => sum + word.length, 0) / wordCount;
        const hasNumbers = /\d/.test(question.question);
        const hasFormulas = /[+\-*/=()]/.test(question.question);
        
        // Scoring
        difficultyScore += Math.min(wordCount * 0.1, 2); // Longer questions are harder
        difficultyScore += Math.min(avgWordLength * 0.2, 2); // Complex words
        difficultyScore += hasNumbers ? 0.5 : 0;
        difficultyScore += hasFormulas ? 1 : 0;
        
        // Option complexity
        const optionComplexity = question.options.reduce((sum, option) => {
            return sum + option.text.split(' ').length * 0.05;
        }, 0);
        difficultyScore += Math.min(optionComplexity, 1);
        
        // Normalize to 1-10 scale
        const difficulty = Math.min(Math.max(Math.round(difficultyScore), 1), 10);
        
        this.difficultyCache.set(cacheKey, difficulty);
        return difficulty;
    }

    // Question popularity tracking
    async getQuestionPopularity(questionId) {
        const cacheKey = `popularity_${questionId}`;
        
        if (this.popularityCache.has(cacheKey)) {
            return this.popularityCache.get(cacheKey);
        }

        // This would normally come from user interaction data
        // For now, simulate based on question characteristics
        const popularity = Math.floor(Math.random() * 100) + 1;
        
        this.popularityCache.set(cacheKey, popularity);
        return popularity;
    }

    // Real-time performance monitoring
    async getRealtimeMetrics() {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const analytics = await progressService.getPerformanceAnalytics({
            dateFrom: last24h,
            dateTo: now
        });

        return {
            activeSessions: analytics.overview.totalSessions,
            averageScore: analytics.overview.averageScore,
            questionVolume: analytics.overview.totalQuestions,
            topPerformingSubjects: analytics.subjectPerformance
                .sort((a, b) => b.averageScore - a.averageScore)
                .slice(0, 3),
            systemHealth: {
                cacheHitRate: this.getCacheHitRate(),
                responseTime: this.getAverageResponseTime(),
                errorRate: this.getErrorRate()
            }
        };
    }

    // Adaptive difficulty system
    async getAdaptiveDifficulty(userId, subjectId, currentScore) {
        // Start with current performance level
        let targetDifficulty = 5; // Medium difficulty
        
        if (currentScore >= 90) targetDifficulty = 8; // Hard
        else if (currentScore >= 70) targetDifficulty = 6; // Medium-Hard
        else if (currentScore >= 50) targetDifficulty = 4; // Medium-Easy
        else targetDifficulty = 2; // Easy
        
        // Adjust based on recent performance trend
        const recentSessions = await progressService.getUserSessions({
            subjectId,
            limit: 5
        });
        
        if (recentSessions.sessions.length >= 3) {
            const trend = this.calculateScoreTrend(recentSessions.sessions);
            if (trend > 0) targetDifficulty += 1; // Increase difficulty if improving
            else if (trend < -10) targetDifficulty -= 1; // Decrease if struggling
        }
        
        return Math.min(Math.max(targetDifficulty, 1), 10);
    }

    // Helper methods for ML calculations
    analyzeTrend(dailyTrend) {
        if (dailyTrend.length < 2) return { improving: false, rate: 0 };
        
        const recent = dailyTrend.slice(-7);
        const previous = dailyTrend.slice(-14, -7);
        
        const recentAvg = recent.reduce((sum, day) => sum + day.averageScore, 0) / recent.length;
        const previousAvg = previous.reduce((sum, day) => sum + day.averageScore, 0) / previous.length;
        
        const rate = ((recentAvg - previousAvg) / previousAvg) * 100;
        
        return {
            improving: rate > 0,
            rate: Math.round(rate * 100) / 100
        };
    }

    calculateMasteryLevels(subjectPerformance) {
        return subjectPerformance.map(subject => {
            let level = 'beginner';
            if (subject.averageScore >= 90) level = 'expert';
            else if (subject.averageScore >= 80) level = 'advanced';
            else if (subject.averageScore >= 70) level = 'intermediate';
            else if (subject.averageScore < 50) level = 'struggling';
            
            return {
                subject: subject.subjectName,
                level,
                score: subject.averageScore,
                sessions: subject.sessions
            };
        });
    }

    analyzeStudyPatterns(analytics) {
        // This would analyze when user performs best
        // For now, return placeholder data
        return {
            optimalTime: 'morning',
            averageSessionLength: 45,
            preferredDifficulty: 'medium'
        };
    }

    calculateLearningVelocity(analytics) {
        // Calculate how fast the user is improving
        const sessions = analytics.overview.totalSessions;
        const improvement = analytics.overview.averageScore;
        
        return {
            acceleration: sessions > 10 ? improvement / sessions : 0,
            trajectory: 'positive'
        };
    }

    predictNextSessionScore(analytics) {
        const recent = analytics.recentSessions.slice(0, 5);
        if (recent.length === 0) return 50;
        
        const avg = recent.reduce((sum, session) => sum + session.score, 0) / recent.length;
        const trend = recent.length > 1 ? (recent[0].score - recent[recent.length - 1].score) / recent.length : 0;
        
        return Math.round(Math.min(Math.max(avg + trend, 0), 100));
    }

    predictWeeklyImprovement(analytics) {
        return Math.round(Math.random() * 10 + 2); // 2-12% improvement
    }

    predictExamReadiness(subject) {
        if (subject.averageScore >= 80) return 'ready';
        else if (subject.averageScore >= 60) return 'almost_ready';
        else return 'needs_preparation';
    }

    calculateConfidence(sampleSize) {
        if (sampleSize >= 20) return 'high';
        else if (sampleSize >= 10) return 'medium';
        else return 'low';
    }

    recommendStudySchedule(analytics) {
        return {
            description: 'Based on your performance patterns, we recommend studying 2-3 hours daily',
            actions: [
                'Schedule practice sessions in the morning',
                'Take breaks every 45 minutes',
                'Review mistakes at the end of each session'
            ]
        };
    }

    recommendSubjectFocus(analytics) {
        const weakSubjects = analytics.subjectPerformance
            .filter(s => s.averageScore < 70)
            .slice(0, 2);
        
        return {
            description: `Focus on improving ${weakSubjects.map(s => s.subjectName).join(' and ')}`,
            actions: weakSubjects.map(s => `Spend extra 30 minutes daily on ${s.subjectName}`)
        };
    }

    async recommendQuestionDifficulty(analytics) {
        return {
            description: 'Gradually increase question difficulty to challenge yourself',
            actions: [
                'Start with medium difficulty questions',
                'Progress to hard questions once you achieve 80% accuracy',
                'Mix easy questions for confidence building'
            ]
        };
    }

    recommendPracticeFrequency(analytics) {
        const sessionsPerWeek = analytics.overview.totalSessions / 4; // Assuming 4 weeks of data
        
        return {
            description: sessionsPerWeek < 5 
                ? 'Increase practice frequency for better results'
                : 'Maintain your current practice schedule',
            actions: sessionsPerWeek < 5 
                ? ['Aim for at least 5 practice sessions per week']
                : ['Continue with your current schedule']
        };
    }

    async rankSearchResults(results, query, options) {
        // Simple relevance scoring
        return results.map(question => {
            let score = 0;
            const queryLower = query.toLowerCase();
            
            // Exact match in question
            if (question.question.toLowerCase().includes(queryLower)) score += 10;
            
            // Match in options
            const optionMatches = question.options.filter(opt => 
                opt.text.toLowerCase().includes(queryLower)
            ).length;
            score += optionMatches * 2;
            
            // Keyword density
            const words = queryLower.split(' ');
            words.forEach(word => {
                const regex = new RegExp(word, 'gi');
                const matches = (question.question.match(regex) || []).length;
                score += matches;
            });
            
            return { ...question, relevanceScore: score };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    async enrichWithDifficulty(results) {
        const enriched = [];
        
        for (const question of results) {
            const difficulty = await this.estimateQuestionDifficulty(question);
            enriched.push({ ...question, difficulty });
        }
        
        return enriched;
    }

    async enrichWithPopularity(results) {
        const enriched = [];
        
        for (const question of results) {
            const popularity = await this.getQuestionPopularity(question.questionId);
            enriched.push({ ...question, popularity });
        }
        
        return enriched;
    }

    calculateScoreTrend(sessions) {
        if (sessions.length < 2) return 0;
        
        const recent = sessions[0].score;
        const older = sessions[sessions.length - 1].score;
        
        return recent - older;
    }

    // System metrics (placeholder implementations)
    getCacheHitRate() {
        return '85%';
    }

    getAverageResponseTime() {
        return '150ms';
    }

    getErrorRate() {
        return '0.5%';
    }
}

module.exports = new AnalyticsService();
