// /Volumes/Macintosh HD/Users/burnt/Documents/workspace/DevOps/Terraform/eatpl/app.js
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
require("xtend");

// Import routes
const indexRouter = require('./routes/index');
const dashboardRouter = require('./routes/dashboard');
const apiRouter = require('./routes/api');
const examHierarchyRoutes = require('./routes/examHierarchy');
const xlsxTemplateRoutes = require('./routes/xlsxTemplate');
const directExamRoutes = require('./routes/directExamRoutes');
const examRouter = require('./routes/exam');
const data = require('./data/data.json');

const app = express();

// Set up middleware
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
    console.log('Generating sitemap...');
    const links = [
      { url: '/', changefreq: 'daily', priority: 1.0 },
      { url: '/dashboard', changefreq: 'weekly', priority: 0.8 }
    ];

    data.exams.forEach(exam => {
      // Exam page
      links.push({
        url: `/${exam.examId}`,
        changefreq: 'weekly',
        priority: 0.9
      });

      exam.subjects?.forEach(subject => {
        // Subject's question paper list
        links.push({
          url: `/${exam.examId}/${subject.subjectId}/questionPapers`,
          changefreq: 'weekly',
          priority: 0.8
        });

        subject.questionPapers?.forEach(paper => {
          // Specific paper page
          links.push({
            url: `/${exam.examId}/${subject.subjectId}/questionPapers/${paper.questionPaperId}`,
            changefreq: 'monthly',
            priority: 0.7
          });

          paper.questions?.forEach(question => {
            // Individual question URL
            links.push({
              url: `/${exam.examId}/${subject.subjectId}/questionPapers/${paper.questionPaperId}/${question.questionId}`,
              changefreq: 'yearly',
              priority: 0.5
            });
          });
        });
      });
    });

    const stream = new SitemapStream({ hostname: 'https://examfit.in' });
    res.writeHead(200, { 'Content-Type': 'application/xml' });

    const xml = await streamToPromise(Readable.from(links).pipe(stream)).then(data => data.toString());
    res.end(xml);
  } catch (err) {
    console.error('Sitemap generation error:', err);
    res.status(500).end();
  }
});


// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Important: Route order matters
app.use('/dashboard', dashboardRouter); // Dashboard route enabled
app.use('/api', apiRouter);
app.use('/', indexRouter);       // move this UP
app.use('/', examHierarchyRoutes); 
app.use('/', xlsxTemplateRoutes);
app.use('/', examRouter);       // move this DOWN
app.use('/', directExamRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong. Please try again later.'
    
  });
});




// 404 handling for routes not found
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource could not be found.'
  });
});

// const PORT = process.env.PORT || 16;
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

module.exports = app;

