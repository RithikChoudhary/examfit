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

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Important: Route order matters
// app.use('/dashboard', dashboardRouter); // Dashboard route enabled
app.use('/api', apiRouter);
app.use('/', examHierarchyRoutes); 
app.use('/', xlsxTemplateRoutes);
app.use('/', examRouter); 
app.use('/', indexRouter); 
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

