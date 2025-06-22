// Standard response formatter
const formatResponse = (success, data = null, error = null, meta = null) => {
    const response = { success };
    
    if (success) {
        response.data = data;
        if (meta) response.meta = meta;
    } else {
        response.error = error;
    }
    
    return response;
};

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    
    // Log error details
    console.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    } else if (err.code === 'ENOENT') {
        statusCode = 404;
        message = 'File not found';
    } else if (err.code === 'EACCES') {
        statusCode = 403;
        message = 'Permission denied';
    }

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'Something went wrong. Please try again later.';
    }

    // Check if this is an API request or a web page request
    const isApiRequest = req.originalUrl.startsWith('/api') || 
                        req.headers.accept?.includes('application/json') ||
                        req.headers['content-type']?.includes('application/json');

    if (isApiRequest) {
        // Return JSON for API requests
        res.status(statusCode).json(formatResponse(false, null, {
            message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }));
    } else {
        // Return HTML error page for web requests
        try {
            res.status(statusCode).render('error', {
                title: getErrorTitle(statusCode),
                message: message,
                details: process.env.NODE_ENV === 'development' ? err.stack : null,
                backUrl: req.headers.referer || '/'
            });
        } catch (renderError) {
            // Fallback to simple HTML if template rendering fails
            res.status(statusCode).send(`
                <!DOCTYPE html>
                <html>
                <head><title>Error ${statusCode}</title></head>
                <body>
                    <h1>Error ${statusCode}</h1>
                    <p>${message}</p>
                    <a href="/">Go Home</a>
                </body>
                </html>
            `);
        }
    }
};

// Helper function to get appropriate error titles
const getErrorTitle = (statusCode) => {
    switch (statusCode) {
        case 400: return 'Bad Request';
        case 401: return 'Unauthorized';
        case 403: return 'Forbidden';
        case 404: return 'Page Not Found';
        case 429: return 'Too Many Requests';
        case 500: return 'Server Error';
        default: return 'Error';
    }
};

// Async error wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Not found handler
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
};

// Request logger middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
};

// Rate limiting helper (basic implementation)
const rateLimitMap = new Map();

const rateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
    return (req, res, next) => {
        // Disable rate limiting for localhost/development
        if (req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1' || 
            req.hostname === 'localhost' || process.env.NODE_ENV === 'development') {
            console.log('🚀 Rate limiting disabled for localhost/development');
            return next();
        }
        
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        if (!rateLimitMap.has(key)) {
            rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }
        
        const limitData = rateLimitMap.get(key);
        
        if (now > limitData.resetTime) {
            limitData.count = 1;
            limitData.resetTime = now + windowMs;
            return next();
        }
        
        // Increase limits for production (was too restrictive)
        const actualMax = process.env.NODE_ENV === 'production' ? max : 10000;
        
        if (limitData.count >= actualMax) {
            console.log(`⚠️ Rate limit exceeded for ${key}: ${limitData.count}/${actualMax}`);
            return res.status(429).json(formatResponse(false, null, {
                message: 'Too many requests. Please try again later.'
            }));
        }
        
        limitData.count++;
        next();
    };
};

// Clean up rate limit map periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitMap.entries()) {
        if (now > data.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}, 60000); // Clean up every minute

module.exports = {
    formatResponse,
    errorHandler,
    asyncHandler,
    notFound,
    requestLogger,
    rateLimit
};
