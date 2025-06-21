# 🚀 MongoDB Migration Guide for ExamFit

This guide will help you migrate your data.json to MongoDB and update your application to use the database.

## 📋 Prerequisites

1. **Python 3.x** installed on your system
2. **Node.js** and **npm** (already have this)
3. **MongoDB Atlas account** (free tier works fine)

## 🔧 Step 1: Run the Migration

### Option A: Using the automated script (Recommended)
```bash
cd examfit/scripts
./run_migration.sh
```

### Option B: Manual installation and run
```bash
cd examfit/scripts

# Install Python dependencies
pip3 install -r requirements_mongo.txt

# Run migration
python3 mongo_migration.py
```

## 📊 What the Migration Does

The migration script will:
- ✅ Connect to your MongoDB Atlas cluster
- ✅ Create optimized collections and indexes
- ✅ Stream your large data.json file safely
- ✅ Migrate data in chunks (1000 questions at a time)
- ✅ Validate all data was migrated correctly
- ✅ Provide detailed progress tracking
- ✅ **Never modify your original data.json file**

### Collections Created:
```
📚 exams          - Exam metadata (UPSC, SSC, etc.)
📖 subjects       - Subject information per exam
📄 questionPapers - Question paper metadata
❓ questions      - Individual questions with options
📝 migrationLogs  - Migration history and stats
```

## 🔄 Step 2: Update Your Node.js Application

### 2.1 Install MongoDB Driver
```bash
cd examfit
npm install mongodb
```

### 2.2 Test MongoDB Connection
Add this health check route to test your connection:

```javascript
// Add to your routes/api.js or app.js
const mongoService = require('./services/mongoService');

app.get('/api/health/mongodb', async (req, res) => {
    try {
        const health = await mongoService.healthCheck();
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### 2.3 Gradual Migration Strategy

The system supports **fallback mode** - if MongoDB fails, it automatically uses data.json:

```javascript
// In your existing routes, replace:
const data = require('../data/data.json');

// With:
const mongoService = require('../services/mongoService');
const data = await mongoService.getDataWithFallback();
```

## 🧪 Step 3: Testing

### 3.1 Test MongoDB Health
Visit: `http://localhost:3000/api/health/mongodb`

Expected response:
```json
{
  "status": "healthy",
  "collections": {
    "exams": 2,
    "subjects": 8,
    "questionPapers": 25,
    "questions": 15000
  },
  "timestamp": "2025-06-21T..."
}
```

### 3.2 Test Data Retrieval
```javascript
// Test in Node.js console
const mongoService = require('./services/mongoService');

// Get all exams
mongoService.getExams().then(console.log);

// Get specific exam
mongoService.getExamById('upsc').then(console.log);

// Get random questions
mongoService.getRandomQuestions('upsc', 'general-studies', 5).then(console.log);
```

## 🔧 Step 4: Update Your Routes (Gradual)

### Before (JSON-based):
```javascript
// routes/index.js
app.get('/', (req, res) => {
    const data = require('../data/data.json');
    res.render('index', { exams: data.exams });
});
```

### After (MongoDB with fallback):
```javascript
// routes/index.js
const mongoService = require('../services/mongoService');

app.get('/', async (req, res) => {
    try {
        const data = await mongoService.getDataWithFallback();
        res.render('index', { 
            exams: data.exams,
            dataSource: data.source 
        });
    } catch (error) {
        console.error('Error loading data:', error);
        res.status(500).render('error');
    }
});
```

## 🚀 Step 5: Performance Benefits

After migration, you'll get:

### Fast Queries:
```javascript
// Get random practice questions (instant)
await mongoService.getRandomQuestions('upsc', 'general-studies', 10);

// Search questions by text (indexed)
await mongoService.searchQuestions('constitution', 'upsc');

// Get question statistics (aggregated)
await mongoService.getQuestionStats('upsc');
```

### Scalable Operations:
```javascript
// Add new questions (for automation)
await mongoService.addQuestion(questionData);

// Batch insert (for scraped data)
await mongoService.addQuestions(questionsArray);
```

## 🛡️ Step 6: Environment Variables (Optional)

For production, set environment variable:
```bash
# .env file
MONGODB_URI=mongodb+srv://examfit:snpN01ULMUC2cdI5@examfit.hzuwfkl.mongodb.net/?retryWrites=true&w=majority&appName=examfit
```

## 📈 Migration Results

You should see something like:
```
🎉 MIGRATION COMPLETED!
⏱️  Duration: 0:02:45
📚 Exams: 2
📖 Subjects: 8
📄 Papers: 25
❓ Questions: 15,000

✅ Migration successful! Data is ready in MongoDB.
```

## 🔄 Rollback Plan

If anything goes wrong:
1. **Your data.json is untouched** - always works as backup
2. **Use fallback mode** - automatically switches to JSON if MongoDB fails
3. **Re-run migration** - safe to run multiple times

## 🎯 Next Steps

1. **Run the migration**: `./scripts/run_migration.sh`
2. **Test MongoDB connection**: Visit health check endpoint
3. **Gradually update routes**: Replace JSON reads with MongoDB calls
4. **Keep data.json**: As backup until you're confident
5. **Monitor performance**: Should be much faster than JSON

## 🆘 Troubleshooting

### MongoDB Connection Issues:
- Check your internet connection
- Verify MongoDB Atlas cluster is running
- Check connection string format

### Migration Errors:
- Ensure Python 3 and pip are installed
- Check data.json file exists and is readable
- Try running with `python3 mongo_migration.py` directly for detailed errors

### Application Issues:
- Test with health check endpoint first
- Use `getDataWithFallback()` for safety
- Check Node.js logs for detailed error messages

---

**🎉 Ready to migrate? Run: `./scripts/run_migration.sh`**
