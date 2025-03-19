const express = require('express');
const router = express.Router();
const cacheService = require('../services/cache');
const databaseOptimizer = require('../services/database');

router.use((req, res, next) => {
    const startTime = Date.now();
    
    // Set optimized headers
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('ETag', `${Date.now()}`);
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Track request start time
    req.startTime = startTime;
    
    // Process parallel requests
    if (req.headers['x-parallel-process'] === 'true') {
        req.parallelProcessing = true;
    }
    
    next();
});

module.exports = router;