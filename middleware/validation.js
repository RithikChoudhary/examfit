const { body, param, query, validationResult } = require('express-validator');

// Custom validation middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.param,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

// Common validations
const examIdValidation = param('examId')
    .isLength({ min: 1, max: 50 })
    .withMessage('Exam ID must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Exam ID can only contain letters, numbers, hyphens, and underscores');

const subjectIdValidation = param('subjectId')
    .isLength({ min: 1, max: 50 })
    .withMessage('Subject ID must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Subject ID can only contain letters, numbers, hyphens, and underscores');

const paperIdValidation = param('paperId')
    .isLength({ min: 1, max: 50 })
    .withMessage('Paper ID must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Paper ID can only contain letters, numbers, hyphens, and underscores');

const questionIdValidation = param('questionId')
    .isLength({ min: 1, max: 50 })
    .withMessage('Question ID must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Question ID can only contain letters, numbers, hyphens, and underscores');

// Pagination validations
const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .toInt(),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
        .toInt()
];

// Subject validation
const subjectValidation = [
    body('subjectName')
        .isLength({ min: 1, max: 100 })
        .withMessage('Subject name must be between 1 and 100 characters')
        .trim()
];

// Question paper validation
const questionPaperValidation = [
    body('paperName')
        .isLength({ min: 1, max: 100 })
        .withMessage('Paper name must be between 1 and 100 characters')
        .trim(),
    body('paperSection')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('Paper section must be between 1 and 50 characters')
        .trim()
];

// Question validation
const questionValidation = [
    body('question')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Question must be between 10 and 1000 characters')
        .trim(),
    body('options')
        .isArray({ min: 2, max: 6 })
        .withMessage('Options must be an array with 2-6 items'),
    body('options.*.optionId')
        .isLength({ min: 1, max: 10 })
        .withMessage('Option ID must be between 1 and 10 characters')
        .matches(/^[a-zA-Z0-9]+$/)
        .withMessage('Option ID can only contain alphanumeric characters'),
    body('options.*.text')
        .isLength({ min: 1, max: 500 })
        .withMessage('Option text must be between 1 and 500 characters')
        .trim(),
    body('correctOption')
        .isLength({ min: 1, max: 10 })
        .withMessage('Correct option must be between 1 and 10 characters')
        .matches(/^[a-zA-Z0-9]+$/)
        .withMessage('Correct option can only contain alphanumeric characters'),
    body('explanation')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Explanation must be at most 1000 characters')
        .trim()
];

// Session validation
const sessionValidation = [
    body('sessionData.examId').notEmpty().withMessage('Exam ID is required'),
    body('sessionData.subjectId').notEmpty().withMessage('Subject ID is required'),
    body('sessionData.paperId').notEmpty().withMessage('Paper ID is required'),
    body('answers').isObject().withMessage('Answers must be an object'),
    body('timeSpent')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Time spent must be a non-negative integer')
        .toInt()
];

// Search validation
const searchValidation = [
    query('q')
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters')
        .trim(),
    query('section')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('Section filter must be between 1 and 50 characters')
        .trim()
];

// Date range validation
const dateRangeValidation = [
    query('dateFrom')
        .optional()
        .isISO8601()
        .withMessage('Date from must be a valid ISO 8601 date')
        .toDate(),
    query('dateTo')
        .optional()
        .isISO8601()
        .withMessage('Date to must be a valid ISO 8601 date')
        .toDate()
];

// Custom validation to check if dateTo is after dateFrom
const validateDateRange = (req, res, next) => {
    const { dateFrom, dateTo } = req.query;
    
    if (dateFrom && dateTo && new Date(dateTo) <= new Date(dateFrom)) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: [{
                field: 'dateTo',
                message: 'End date must be after start date'
            }]
        });
    }
    
    next();
};

// Export validation sets
module.exports = {
    handleValidationErrors,
    
    // Parameter validations
    examIdValidation,
    subjectIdValidation,
    paperIdValidation,
    questionIdValidation,
    
    // Body validations
    subjectValidation,
    questionPaperValidation,
    questionValidation,
    sessionValidation,
    
    // Query validations
    paginationValidation,
    searchValidation,
    dateRangeValidation,
    
    // Custom validations
    validateDateRange,
    
    // Validation sets for common endpoints
    validateExamParams: [examIdValidation],
    validateSubjectParams: [examIdValidation, subjectIdValidation],
    validatePaperParams: [examIdValidation, subjectIdValidation, paperIdValidation],
    validateQuestionParams: [examIdValidation, subjectIdValidation, questionIdValidation],
    
    validateCreateSubject: [examIdValidation, ...subjectValidation],
    validateCreatePaper: [examIdValidation, subjectIdValidation, ...questionPaperValidation],
    validateCreateQuestion: [examIdValidation, subjectIdValidation, paperIdValidation, ...questionValidation],
    validateUpdateQuestion: [examIdValidation, subjectIdValidation, questionIdValidation, ...questionValidation],
    
    validateSubmitSession: [...sessionValidation],
    validateSearch: [...searchValidation, ...paginationValidation],
    validateSessionsQuery: [...paginationValidation, ...dateRangeValidation, validateDateRange]
};
