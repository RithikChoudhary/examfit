// /Volumes/Macintosh HD/Users/burnt/Documents/workspace/DevOps/Terraform/eatpl/app.js
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
require("xtend");

// Import routes
const indexRouter = require('./routes/index');
const dashboardRouter = require('./routes/dashboard');
const apiRouter = require('./routes/api');
const apiV1Router = require('./routes/api/v1');
const practiceRouter = require('./routes/practice');
const currentAffairsRouter = require('./routes/current-affairs');
const blogRouter = require('./routes/blog');
const examHierarchyRoutes = require('./routes/examHierarchy');
const xlsxTemplateRoutes = require('./routes/xlsxTemplate');
const directExamRoutes = require('./routes/directExamRoutes');
const examRouter = require('./routes/exam');

// Import middleware
const { errorHandler, notFound, requestLogger, rateLimit } = require('./middleware/errorHandler');
const examService = require('./services/examService');
const cacheService = require('./services/cacheService');

const app = express();

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Setup daily current affairs automation
const cron = require('node-cron');
const dailyCurrentAffairsService = require('./services/dailyCurrentAffairsService');

// Schedule daily current affairs scraping at 8:00 AM IST
cron.schedule('0 8 * * *', async () => {
  console.log('🕐 Starting daily current affairs scraping...');
  
  try {
    const result = await dailyCurrentAffairsService.scrapeTodaysAffairs();
    console.log('✅ Daily current affairs automation completed:', result);
  } catch (error) {
    console.error('❌ Error in daily current affairs automation:', error);
  }
}, {
  timezone: "Asia/Kolkata"
});

console.log('📅 Daily current affairs automation scheduled for 8:00 AM IST');

// Force HTTPS and non-www redirects in production
app.use((req, res, next) => {
  // Skip redirects for localhost/development
  if (req.hostname === 'localhost' || req.hostname === '127.0.0.1' || process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Force HTTPS redirect
  if (req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.hostname}${req.url}`);
  }

  // Force non-www redirect (www.examfit.in -> examfit.in)
  if (req.hostname.startsWith('www.')) {
    const nonWwwHost = req.hostname.slice(4); // Remove 'www.'
    return res.redirect(301, `https://${nonWwwHost}${req.url}`);
  }

  next();
});

// Set up middleware
app.use(requestLogger); // Request logging
app.use(rateLimit()); // Rate limiting - default 100 requests per 15 minutes
app.use(express.json()); // For parsing JSON payloads
app.use(express.urlencoded({ extended: true })); // For parsing URL-encoded bodies

// Static file serving - specify the full path
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/icons', express.static(path.join(__dirname, 'public/icons')));

app.use((req, res, next) => {
  // Disable caching in development or for current-affairs
  if (process.env.NODE_ENV !== 'production' || req.path.includes('/current-affairs')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  } else if (req.method === 'GET' && req.accepts('html')) {
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  }
  next();
});

// 💥 Place the sitemap route here
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');

app.get('/sitemap.xml', async (req, res) => {
  try {
    console.log('Generating optimized sitemap...');
    
    // Check for cached sitemap first (cache for 24 hours)
    const cachedSitemap = cacheService.get('sitemap_xml');
    if (cachedSitemap) {
      console.log('Serving cached sitemap');
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      return res.end(cachedSitemap);
    }

    const links = [
      { url: '/', changefreq: 'daily', priority: 1.0 },
      { url: '/practice', changefreq: 'daily', priority: 0.9 },
      { url: '/practice/progress', changefreq: 'weekly', priority: 0.7 },
      { url: '/current-affairs', changefreq: 'daily', priority: 0.9 },
      { url: '/blog', changefreq: 'daily', priority: 0.8 },
      { url: '/blog/upsc-preparation-strategy-2025', changefreq: 'weekly', priority: 0.7 },
      { url: '/blog/ssc-cgl-preparation-tips', changefreq: 'weekly', priority: 0.7 },
      { url: '/blog/current-affairs-june-2025', changefreq: 'weekly', priority: 0.7 },
      { url: '/contact', changefreq: 'monthly', priority: 0.6 }
    ];

    // Add current affairs URLs for the last 30 days
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i - 2); // Start from 2 days ago
      const dateStr = date.toISOString().split('T')[0];
      
      const priority = i < 7 ? 0.8 : 0.7; // Higher priority for recent dates
      const changefreq = i < 7 ? 'daily' : 'weekly';
      
      links.push({
        url: `/current-affairs?date=${dateStr}`,
        changefreq,
        priority
      });
    }

    // Get exam data using cached service (faster)
    const exams = await examService.getAllExams(true); // Use cache for better performance
    
    // Process exams in batches to prevent timeout
    const batchSize = 10;
    for (let i = 0; i < exams.length; i += batchSize) {
      const examBatch = exams.slice(i, i + batchSize);
      
      await Promise.allSettled(examBatch.map(async (examSummary) => {
        try {
          const exam = await examService.getExamById(examSummary.examId);
          
          // Exam page
          links.push({
            url: `/${exam.examId}`,
            changefreq: 'weekly',
            priority: 0.9
          });

          // Add subject and paper URLs (limit to most important ones)
          exam.subjects?.slice(0, 20)?.forEach(subject => { // Limit to 20 subjects per exam
            // Subject's question paper list
            links.push({
              url: `/${exam.examId}/${subject.subjectId}/questionPapers`,
              changefreq: 'weekly',
              priority: 0.8
            });

            // Add only first 10 papers per subject to keep sitemap manageable
            subject.questionPapers?.slice(0, 10)?.forEach(paper => {
              links.push({
                url: `/${exam.examId}/${subject.subjectId}/questionPapers/${paper.questionPaperId}`,
                changefreq: 'monthly',
                priority: 0.7
              });

              // Skip individual questions in sitemap to keep it lightweight
              // Individual questions can be discovered through paper pages
            });
          });
        } catch (error) {
          console.warn(`Failed to process exam ${examSummary.examId} for sitemap:`, error.message);
        }
      }));
    }

    // Limit total URLs to prevent sitemap from becoming too large
    const maxUrls = 50000; // Google's limit is 50,000 URLs per sitemap
    if (links.length > maxUrls) {
      console.warn(`Sitemap has ${links.length} URLs, truncating to ${maxUrls}`);
      links.splice(maxUrls);
    }

    const stream = new SitemapStream({ hostname: 'https://examfit.in' });
    const xml = await streamToPromise(Readable.from(links).pipe(stream)).then(data => data.toString());
    
    // Cache the generated sitemap for 24 hours
    cacheService.set('sitemap_xml', xml, 24 * 60 * 60 * 1000);
    
    console.log(`Sitemap generated with ${links.length} URLs`);
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(xml);
  } catch (err) {
    console.error('Sitemap generation error:', err);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Sitemap generation failed</error>');
  }
});


// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB health check route
const { healthCheck } = require('./utils/dataHelpers');
app.get('/api/health/mongodb', async (req, res) => {
    try {
        const health = await healthCheck();
        res.json({
            timestamp: new Date().toISOString(),
            status: 'success',
            ...health
        });
    } catch (error) {
        res.status(500).json({
            timestamp: new Date().toISOString(),
            status: 'error',
            error: error.message
        });
    }
});

// Data source info route
app.get('/api/health/data', async (req, res) => {
    try {
        // Use MongoDB directly instead of getQuestions()
        const mongoService = require('./services/mongoService');
        const db = await mongoService.connect();
        
        // Get data directly from MongoDB
        const exams = await db.collection('exams').find({ isActive: true }).toArray();
        const subjects = await db.collection('subjects').find({}).toArray();
        const papers = await db.collection('questionPapers').find({}).toArray();
        const questions = await db.collection('questions').find({}).toArray();
        
        res.json({
            timestamp: new Date().toISOString(),
            dataSource: 'mongodb',
            examCount: exams.length,
            subjectCount: subjects.length,
            paperCount: papers.length,
            questionCount: questions.length,
            lastUpdated: new Date().toISOString(),
            status: 'healthy'
        });
    } catch (error) {
        res.status(500).json({
            timestamp: new Date().toISOString(),
            status: 'error',
            error: error.message
        });
    }
});

// Important: Route order matters - specific routes before wildcard routes
// New API v1 routes with improved structure
app.use('/api/v1', apiV1Router);

// Legacy routes (maintained for backward compatibility)
app.use('/practice', practiceRouter); // Practice routes
app.use('/current-affairs', currentAffairsRouter); // Current affairs routes
app.use('/blog', blogRouter); // Blog routes
app.use('/api', apiRouter); // Legacy API routes

// CRITICAL: Dashboard routes MUST come before any wildcard routes to prevent conflicts
// Add debugging middleware to track dashboard route registration
app.use('/dashboard', (req, res, next) => {
  console.log(`🔍 Dashboard route accessed: ${req.method} ${req.originalUrl} from ${req.ip}`);
  next();
});

app.use('/dashboard', dashboardRouter); // Dashboard route enabled with MongoDB support

// Add specific health check for dashboard delete route
app.get('/api/health/dashboard', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    status: 'healthy',
    message: 'Dashboard routes are properly mounted',
    expectedRoutes: [
      'GET /dashboard',
      'POST /dashboard/exams',
      'POST /dashboard/exams/delete',
      'GET /dashboard/subjects/:examId',
      'GET /dashboard/questions/:examId/:subjectId',
      'GET /dashboard/questionPapers/:examId/:subjectId'
    ],
    environment: process.env.NODE_ENV || 'development'
  });
});

// Add route debugging endpoint for production troubleshooting
app.get('/api/debug/routes', (req, res) => {
  // Only enable in development or with specific auth
  if (process.env.NODE_ENV === 'production' && !req.query.debug_key) {
    return res.status(404).send('Not found');
  }
  
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods),
            baseUrl: middleware.regexp.source
          });
        }
      });
    }
  });
  
  res.json({
    timestamp: new Date().toISOString(),
    totalRoutes: routes.length,
    routes: routes.slice(0, 50), // Limit output
    dashboardRoutes: routes.filter(r => r.path && r.path.includes('dashboard'))
  });
});

// View routes - ORDER MATTERS! Static and specific routes first
app.use('/', indexRouter);       // handles / and /contact
app.use('/', xlsxTemplateRoutes);

// Enhanced static file serving - BEFORE exclusions
app.use('/templates', express.static(path.join(__dirname, 'public/templates')));

// Static file exclusions - prevent these from being caught by exam routes  
app.use('/templates/*', (req, res, next) => {
  // Stop ALL /templates/* requests here - don't let any pass to exam routes
  return res.status(404).send('Template file not found');
});

app.use('/public/*', (req, res, next) => {
  // Stop ALL /public/* requests here - don't let any pass to exam routes
  return res.status(404).send('Public file not found');
});

// Additional protection for common static file patterns
app.use('*.webp', (req, res, next) => {
  return res.status(404).send('Image file not found');
});

app.use('*.png', (req, res, next) => {
  return res.status(404).send('Image file not found');
});

app.use('*.jpg', (req, res, next) => {
  return res.status(404).send('Image file not found');
});

app.use('*.ico', (req, res, next) => {
  return res.status(404).send('Icon file not found');
});

// Add protection middleware to prevent wildcard routes from catching dashboard paths
app.use('/', (req, res, next) => {
  // If the request is for dashboard, it should have been handled already
  // If we reach here, it means dashboard routes didn't catch it
  if (req.path.startsWith('/dashboard')) {
    console.warn(`⚠️ Dashboard path ${req.path} reached wildcard routes - this should not happen`);
    return res.status(404).json({ 
      error: 'Dashboard route not found',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// Dynamic exam routes - these must come after static exclusions
app.use('/', directExamRoutes);
app.use('/', examRouter);       
app.use('/', examHierarchyRoutes); // move this LAST because it has /:exam wildcard

// Error handling middleware
app.use(notFound); // Handle 404s
app.use(errorHandler); // Handle all errors

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
//   console.log(`📊 Dashboard available at http://localhost:${PORT}/dashboard`);
// });

module.exports = app;
