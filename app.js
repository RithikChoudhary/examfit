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
  if (req.method === 'GET' && req.accepts('html')) {
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
      { url: '/current-affairs', changefreq: 'daily', priority: 0.8 },
      { url: '/blog', changefreq: 'daily', priority: 0.8 },
      { url: '/blog/upsc-preparation-strategy-2025', changefreq: 'weekly', priority: 0.7 },
      { url: '/blog/ssc-cgl-preparation-tips', changefreq: 'weekly', priority: 0.7 },
      { url: '/blog/current-affairs-june-2025', changefreq: 'weekly', priority: 0.7 },
      { url: '/contact', changefreq: 'monthly', priority: 0.6 }
    ];

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
        const { getQuestions } = require('./utils/dataHelpers');
        const data = await getQuestions();
        
        res.json({
            timestamp: new Date().toISOString(),
            dataSource: data.source || 'unknown',
            examCount: data.exams?.length || 0,
            lastUpdated: data.lastUpdated || null,
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
app.use('/dashboard', dashboardRouter); // Dashboard route enabled with MongoDB support

// View routes - ORDER MATTERS! Static and specific routes first
app.use('/', indexRouter);       // handles / and /contact
app.use('/', xlsxTemplateRoutes);

// Static file exclusions - prevent these from being caught by exam routes
app.use('/templates/*', (req, res, next) => {
  if (req.path.match(/\.(webp|png|jpg|jpeg|gif|ico|svg)$/)) {
    return res.status(404).send('File not found');
  }
  next();
});

app.use('/public/*', (req, res, next) => {
  return res.status(404).send('File not found');
});

// Dynamic exam routes - these must come after static exclusions
app.use('/', directExamRoutes);
app.use('/', examRouter);       
app.use('/', examHierarchyRoutes); // move this LAST because it has /:exam wildcard

// Error handling middleware
app.use(notFound); // Handle 404s
app.use(errorHandler); // Handle all errors

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
