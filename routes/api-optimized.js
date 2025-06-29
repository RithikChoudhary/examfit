const express = require('express');
const router = express.Router();
const examService = require('../services/examService');
const cacheService = require('../services/cacheService');

// Performance monitoring middleware
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Optimized subjects endpoint with aggressive caching
router.get('/subjects/:examId', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { examId } = req.params;
    
    console.log(`🚀 OPTIMIZED API: Getting subjects for exam: ${examId}`);
    
    // Check cache first for ultra-fast response
    const cacheKey = `api_subjects_${examId}`;
    const cached = cacheService.get(cacheKey);
    
    if (cached) {
      const responseTime = Date.now() - startTime;
      console.log(`⚡ CACHE HIT: Subjects API responded in ${responseTime}ms for ${examId}`);
      
      res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
      res.set('X-Response-Time', `${responseTime}ms`);
      res.set('X-Cache-Status', 'hit');
      
      return res.json({
        subjects: cached,
        meta: {
          examId,
          count: cached.length,
          responseTime: `${responseTime}ms`,
          cached: true
        }
      });
    }
    
    // Use MongoDB directly for better performance
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Single optimized query with projection
    const subjects = await db.collection('subjects')
      .find(
        { examId }, 
        { 
          projection: { 
            _id: 0, 
            subjectId: 1, 
            subjectName: 1, 
            totalPapers: 1,
            examId: 1
          } 
        }
      )
      .toArray();
    
    // Cache the result for 10 minutes
    cacheService.set(cacheKey, subjects, 10 * 60 * 1000);
    
    const responseTime = Date.now() - startTime;
    console.log(`⚡ PERFORMANCE: Subjects API responded in ${responseTime}ms for ${examId} (${subjects.length} subjects)`);
    
    // Set performance headers
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.set('X-Response-Time', `${responseTime}ms`);
    res.set('X-Cache-Status', 'miss');
    res.set('ETag', `"subjects-${examId}-${subjects.length}"`);
    
    res.json({ 
      subjects: subjects || [],
      meta: {
        examId,
        count: subjects.length,
        responseTime: `${responseTime}ms`,
        cached: false
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ OPTIMIZED API: Error fetching subjects for ${req.params.examId} (${responseTime}ms):`, error);
    
    res.status(500).json({ 
      error: 'Failed to fetch subjects',
      examId: req.params.examId,
      responseTime: `${responseTime}ms`,
      details: error.message
    });
  }
});

// Optimized question papers endpoint
router.get('/questionPapers/:examId/:subjectId', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { examId, subjectId } = req.params;
    
    console.log(`🚀 OPTIMIZED API: Getting question papers for: ${examId}/${subjectId}`);
    
    // Check cache first
    const cacheKey = `api_papers_${examId}_${subjectId}`;
    const cached = cacheService.get(cacheKey);
    
    if (cached) {
      const responseTime = Date.now() - startTime;
      console.log(`⚡ CACHE HIT: Question papers API responded in ${responseTime}ms`);
      
      res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
      res.set('X-Response-Time', `${responseTime}ms`);
      res.set('X-Cache-Status', 'hit');
      
      return res.json({
        questionPapers: cached,
        meta: {
          examId,
          subjectId,
          count: cached.length,
          responseTime: `${responseTime}ms`,
          cached: true
        }
      });
    }
    
    // Use MongoDB directly
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Verify subject exists
    const subject = await db.collection('subjects').findOne({ examId, subjectId });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    // Get question papers with question count
    const questionPapers = await db.collection('questionPapers')
      .find(
        { examId, subjectId },
        { 
          projection: { 
            _id: 0,
            questionPaperId: 1,
            paperId: 1,
            questionPaperName: 1,
            paperName: 1,
            section: 1
          }
        }
      )
      .toArray();
    
    // Get question counts for each paper (optimized aggregation)
    const paperCounts = await db.collection('questions').aggregate([
      { $match: { examId, subjectId } },
      { $group: { _id: '$paperId', count: { $sum: 1 } } }
    ]).toArray();
    
    // Merge counts with papers
    const papersWithCounts = questionPapers.map(paper => {
      const paperId = paper.paperId || paper.questionPaperId;
      const countData = paperCounts.find(c => c._id === paperId);
      
      return {
        questionPaperId: paper.questionPaperId || paper.paperId,
        questionPaperName: paper.questionPaperName || paper.paperName,
        section: paper.section || '',
        questionCount: countData ? countData.count : 0
      };
    });
    
    // Cache for 15 minutes
    cacheService.set(cacheKey, papersWithCounts, 15 * 60 * 1000);
    
    const responseTime = Date.now() - startTime;
    console.log(`⚡ PERFORMANCE: Question papers API responded in ${responseTime}ms (${papersWithCounts.length} papers)`);
    
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.set('X-Response-Time', `${responseTime}ms`);
    res.set('X-Cache-Status', 'miss');
    
    res.json({
      questionPapers: papersWithCounts,
      meta: {
        examId,
        subjectId,
        count: papersWithCounts.length,
        responseTime: `${responseTime}ms`,
        cached: false
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ OPTIMIZED API: Error fetching question papers (${responseTime}ms):`, error);
    
    res.status(500).json({ 
      error: 'Failed to fetch question papers',
      responseTime: `${responseTime}ms`,
      details: error.message
    });
  }
});

// Health check endpoint for performance monitoring
router.get('/health/performance', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Test database connection speed
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    const dbTime = Date.now() - startTime;
    
    // Test cache performance
    const cacheStartTime = Date.now();
    cacheService.set('health_test', 'test', 1000);
    const cached = cacheService.get('health_test');
    const cacheTime = Date.now() - cacheStartTime;
    
    // Get cache stats
    const cacheStats = cacheService.getStats();
    
    const totalTime = Date.now() - startTime;
    
    res.json({
      status: 'healthy',
      performance: {
        totalResponseTime: `${totalTime}ms`,
        databaseConnectionTime: `${dbTime}ms`,
        cacheOperationTime: `${cacheTime}ms`,
        cacheWorking: cached === 'test'
      },
      cache: cacheStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      responseTime: `${totalTime}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
