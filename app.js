const express = require('express');
const path = require('path');

// Import routes
const indexRouter = require('./routes/index');
const apiRouter = require('./routes/api');
const examHierarchyRoutes = require('./routes/examHierarchy');
const xlsxTemplateRoutes = require('./routes/xlsxTemplate');
const directExamRoutes = require('./routes/directExamRoutes');
const examRouter = require('./routes/exam');

const app = express();

// Set up middleware
app.use(express.json()); // For parsing JSON payloads
app.use(express.urlencoded({ extended: true })); // For parsing URL-encoded bodies
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Route handlers
app.use('/api', apiRouter);
app.use('/', examHierarchyRoutes); 
app.use('/', xlsxTemplateRoutes);
app.use('/', examRouter); 
app.use('/', indexRouter); 
app.use('/', directExamRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Something broke!');
});



// const PORT = process.env.PORT || 4;
// app.listen(PORT, () => {
//   console.log(`Server rasunning.,../ on http://localhost:${PORT}`); 
// });

module.exports = app;
