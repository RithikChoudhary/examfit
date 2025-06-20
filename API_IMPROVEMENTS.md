# ExamFit API Improvements & Documentation

## Overview

This document outlines the comprehensive improvements made to the ExamFit application to enhance performance, maintainability, and API structure. The improvements include:

1. **Service Layer Architecture**
2. **New REST API v1 with Validation**
3. **Caching Implementation**
4. **Error Handling & Logging**
5. **Performance Optimizations**

## 🏗️ Architecture Changes

### Before vs After

**Before:**
- Direct data.json file reading in routes
- No caching
- Inconsistent error handling
- Mixed responsibilities in routes
- No validation middleware

**After:**
- Service layer for business logic
- In-memory caching with TTL
- Standardized error handling
- Separation of concerns
- Comprehensive validation
- Performance monitoring

## 📁 New File Structure

```
examfit/
├── services/
│   ├── examService.js       # Exam-related operations
│   ├── questionService.js   # Question/paper operations
│   └── progressService.js   # User progress tracking
├── middleware/
│   ├── validation.js        # Request validation
│   └── errorHandler.js      # Error handling & utilities
└── routes/
    └── api/
        └── v1.js           # New structured API endpoints
```

## 🚀 New API v1 Endpoints

### Base URL: `/api/v1`

### Exam Management

#### Get All Exams
```http
GET /api/v1/exams
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "examId": "upsc",
      "examName": "UPSC Civil Services",
      "subjectCount": 15,
      "hasSubExams": false
    }
  ]
}
```

#### Get Specific Exam
```http
GET /api/v1/exams/{examId}
```

#### Get Exam Statistics
```http
GET /api/v1/exams/{examId}/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "examId": "upsc",
    "examName": "UPSC Civil Services",
    "subjectCount": 15,
    "totalPapers": 45,
    "totalQuestions": 1250,
    "averageQuestionsPerPaper": 28
  }
}
```

#### Search Exams
```http
GET /api/v1/exams/search?q={searchTerm}
```

### Subject Management

#### Get Subjects for Exam
```http
GET /api/v1/exams/{examId}/subjects
```

#### Create New Subject
```http
POST /api/v1/exams/{examId}/subjects
```

**Request Body:**
```json
{
  "subjectName": "General Studies"
}
```

#### Delete Subject
```http
DELETE /api/v1/exams/{examId}/subjects/{subjectId}
```

### Question Paper Management

#### Get Question Papers
```http
GET /api/v1/exams/{examId}/subjects/{subjectId}/papers
```

#### Create Question Paper
```http
POST /api/v1/exams/{examId}/subjects/{subjectId}/papers
```

**Request Body:**
```json
{
  "paperName": "Mock Test 1",
  "paperSection": "Previous Year"
}
```

#### Delete Question Paper
```http
DELETE /api/v1/exams/{examId}/subjects/{subjectId}/papers/{paperId}
```

### Question Management

#### Get Questions for Paper (with pagination)
```http
GET /api/v1/exams/{examId}/subjects/{subjectId}/papers/{paperId}/questions?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "questionId": "q123",
      "question": "What is the capital of India?",
      "options": [
        {"optionId": "a", "text": "Mumbai"},
        {"optionId": "b", "text": "Delhi"},
        {"optionId": "c", "text": "Kolkata"},
        {"optionId": "d", "text": "Chennai"}
      ],
      "correctOption": "b",
      "explanation": "Delhi is the national capital of India."
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### Add Question
```http
POST /api/v1/exams/{examId}/subjects/{subjectId}/papers/{paperId}/questions
```

**Request Body:**
```json
{
  "question": "What is the capital of India?",
  "options": [
    {"optionId": "a", "text": "Mumbai"},
    {"optionId": "b", "text": "Delhi"},
    {"optionId": "c", "text": "Kolkata"},
    {"optionId": "d", "text": "Chennai"}
  ],
  "correctOption": "b",
  "explanation": "Delhi is the national capital of India."
}
```

#### Update Question
```http
PUT /api/v1/exams/{examId}/subjects/{subjectId}/questions/{questionId}
```

#### Delete Question
```http
DELETE /api/v1/exams/{examId}/subjects/{subjectId}/questions/{questionId}
```

#### Bulk Upload Questions
```http
POST /api/v1/exams/{examId}/subjects/{subjectId}/papers/{paperId}/questions/bulk
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Excel file with columns: Question, Option A, Option B, Option C, Option D, Correct Option, Explanation

#### Search Questions
```http
GET /api/v1/exams/{examId}/subjects/{subjectId}/questions/search?q={searchTerm}&section={section}&page=1&limit=10
```

#### Get Question Statistics
```http
GET /api/v1/exams/{examId}/subjects/{subjectId}/questions/stats
```

### Practice Session Management

#### Submit Practice Session
```http
POST /api/v1/sessions
```

**Request Body:**
```json
{
  "examId": "upsc",
  "examName": "UPSC Civil Services",
  "subjectId": "general-studies",
  "subjectName": "General Studies",
  "paperId": "mock-1",
  "paperName": "Mock Test 1",
  "score": 85,
  "correct": 17,
  "total": 20,
  "timeSpent": 1800,
  "results": [
    {
      "questionId": "q1",
      "userAnswer": "b",
      "correctAnswer": "b",
      "isCorrect": true
    }
  ]
}
```

#### Get Session Details
```http
GET /api/v1/sessions/{sessionId}
```

#### Get User Sessions (with filtering)
```http
GET /api/v1/sessions?examId={examId}&subjectId={subjectId}&dateFrom=2024-01-01&dateTo=2024-12-31&page=1&limit=10
```

#### Delete Session
```http
DELETE /api/v1/sessions/{sessionId}
```

### Analytics & Statistics

#### Get Performance Analytics
```http
GET /api/v1/analytics/performance?dateFrom=2024-01-01&dateTo=2024-12-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalSessions": 25,
      "totalQuestions": 500,
      "totalCorrect": 425,
      "averageScore": 85,
      "totalTimeSpent": 45000,
      "averageTimePerSession": 1800
    },
    "subjectPerformance": [
      {
        "examName": "UPSC Civil Services",
        "subjectName": "General Studies",
        "sessions": 10,
        "averageScore": 87,
        "bestScore": 95,
        "lastSessionDate": "2024-06-20T10:30:00.000Z"
      }
    ],
    "dailyTrend": [
      {
        "date": "2024-06-19",
        "sessions": 2,
        "averageScore": 85,
        "totalQuestions": 40
      }
    ],
    "scoreDistribution": {
      "0-20": 0,
      "21-40": 1,
      "41-60": 2,
      "61-80": 8,
      "81-100": 14
    }
  }
}
```

#### Get Strength/Weakness Analysis
```http
GET /api/v1/analytics/strength-weakness/{examId}/{subjectId}
```

#### Get User Statistics
```http
GET /api/v1/stats/user?examId={examId}&subjectId={subjectId}
```

### Utility Endpoints

#### Health Check
```http
GET /api/v1/health
```

#### Clear Caches (Admin)
```http
POST /api/v1/cache/clear
```

## 🔧 Service Layer

### ExamService

**Key Methods:**
- `getAllExams(useCache = true)` - Get all exams with caching
- `getExamById(examId)` - Get specific exam
- `getExamSubjects(examId)` - Get subjects for exam
- `addSubject(examId, subjectData)` - Add new subject
- `deleteSubject(examId, subjectId)` - Delete subject
- `getExamStats(examId)` - Get exam statistics
- `searchExams(query)` - Search exams
- `invalidateCache(examId)` - Clear cache

### QuestionService

**Key Methods:**
- `getQuestionsByPaper(examId, subjectId, paperId)` - Get questions for paper
- `getQuestionsBySubject(examId, subjectId)` - Get all questions for subject
- `addQuestion(examId, subjectId, paperId, questionData)` - Add question
- `updateQuestion(examId, subjectId, questionId, questionData)` - Update question
- `deleteQuestion(examId, subjectId, questionId)` - Delete question
- `bulkAddQuestions(examId, subjectId, paperId, questionsArray)` - Bulk add
- `searchQuestions(examId, subjectId, searchTerm, options)` - Search questions
- `validateQuestionData(questionData)` - Validate question format

### ProgressService

**Key Methods:**
- `saveSession(sessionData)` - Save practice session
- `getSession(sessionId)` - Get session details
- `getUserSessions(options)` - Get user sessions with filtering
- `getPerformanceAnalytics(options)` - Get performance analytics
- `getStrengthWeaknessAnalysis(examId, subjectId)` - Analyze performance
- `deleteSession(sessionId)` - Delete session

## 🛡️ Validation & Error Handling

### Request Validation

All API endpoints include comprehensive validation:

- **Parameter validation** (IDs, formats)
- **Body validation** (required fields, data types)
- **Query validation** (pagination, filters)
- **File validation** (Excel uploads)

### Error Responses

Standardized error format:
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "details": [
      {
        "field": "subjectName",
        "message": "Subject name must be between 1 and 100 characters",
        "value": ""
      }
    ]
  }
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## ⚡ Performance Features

### Caching

**In-Memory Cache:**
- 5-minute TTL for most data
- Automatic invalidation on updates
- Separate cache keys for different data types

**Cache Keys:**
- `all_exams` - All exams list
- `exam_{examId}` - Specific exam data
- `questions_{examId}_{subjectId}_{paperId}` - Questions for paper
- `progress_data` - User progress data

### Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Configurable limits
- Automatic cleanup of expired entries

### Request Logging

All requests are logged with:
- Method and URL
- Response status
- Response time
- Timestamp

## 🔄 Migration from Legacy API

### Backward Compatibility

The legacy `/api` routes are maintained for backward compatibility. New development should use `/api/v1` endpoints.

### Key Differences

| Legacy API | New API v1 | Improvements |
|------------|------------|--------------|
| `/api/subjects` | `/api/v1/exams/{examId}/subjects` | RESTful, hierarchical |
| No validation | Full validation | Data integrity |
| Mixed responses | Standardized format | Consistency |
| No caching | Intelligent caching | Performance |
| Basic errors | Detailed errors | Better debugging |

## 📊 Monitoring & Debugging

### Health Check

Monitor application health:
```http
GET /api/v1/health
```

### Cache Management

Clear all caches:
```http
POST /api/v1/cache/clear
```

### Logging

All errors and requests are logged with structured data for easy monitoring and debugging.

## 🔮 Future Enhancements

### Planned Features

1. **Database Integration** - Replace JSON files with proper database
2. **Authentication & Authorization** - User management and role-based access
3. **Real-time Features** - WebSocket support for live sessions
4. **Advanced Analytics** - Machine learning for personalized recommendations
5. **API Rate Plans** - Different rate limits for different user types
6. **Data Export** - Export progress and statistics
7. **Webhook Support** - Event notifications
8. **GraphQL API** - Alternative query language support

### Performance Optimizations

1. **Redis Caching** - Distributed caching for scalability
2. **Database Indexing** - Optimized queries
3. **CDN Integration** - Static asset optimization
4. **Response Compression** - Reduced bandwidth usage
5. **Background Jobs** - Async processing for heavy operations

## 🚀 Getting Started

### Using the New API

1. **Start the server** - The new API is automatically available at `/api/v1`
2. **Test health endpoint** - `GET /api/v1/health`
3. **Explore endpoints** - Use the documentation above
4. **Handle responses** - All responses follow the standardized format

### Example Usage (JavaScript)

```javascript
// Get all exams
const response = await fetch('/api/v1/exams');
const { success, data } = await response.json();

if (success) {
  console.log('Exams:', data);
}

// Add a new question
const newQuestion = {
  question: "What is Node.js?",
  options: [
    { optionId: "a", text: "A database" },
    { optionId: "b", text: "A runtime environment" },
    { optionId: "c", text: "A web browser" },
    { optionId: "d", text: "An operating system" }
  ],
  correctOption: "b",
  explanation: "Node.js is a JavaScript runtime environment."
};

const addResponse = await fetch('/api/v1/exams/upsc/subjects/computer-science/papers/mock-1/questions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newQuestion)
});

const result = await addResponse.json();
```

This comprehensive improvement provides a solid foundation for the ExamFit application with enhanced performance, maintainability, and developer experience.
