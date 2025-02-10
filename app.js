// /Volumes/Macintosh HD/Users/burnt/Documents/workspace/DevOps/Terraform/eatpl/app.js
const express = require('express');
const path = require('path');
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');

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
app.use(express.static(path.join(__dirname, 'public')));
// If you have CSS in a specific folder, you can also add:
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/icons', express.static(path.join(__dirname, 'public/icons')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// app.use('/dashboard', dashboardRouter);
app.use('/api', apiRouter);
 // This should probably be your main rout.e
app.use('/', examHierarchyRoutes); 
app.use('/', xlsxTemplateRoutes);
app.use('/', examRouter); 
app.use('/', indexRouter); 
app.use('/', directExamRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Something. broke!');
});

// const PORT = process.env.PORT || 4;
// app.listen(PORT, () => {
//   console.log(`Server rasunning.,../ on http://localhost:${PORT}`); 
// });

module.exports = app;
