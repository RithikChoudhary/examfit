// Connection pool configuration
const pool = {
    max: 10, // Maximum number of connections
    min: 2, // Minimum number of connections
    acquire: 30000, // Maximum time to wait for a connection
    idle: 10000 // Idle timeout
};

// Query optimization
const optimizeQuery = (query) => {
    // Add indexes for frequently queried columns
    if (!query.includes('INDEX')) {
        query = query + ' USING INDEX idx_column_name';
    }
    return query;
};

// Enable query caching
const enableQueryCache = () => {
    const originalQuery = db.query;
    db.query = function (sql, params) {
        const cachedResult = cacheService.get(sql);
        if (cachedResult) {
            return Promise.resolve(cachedResult);
        }
        
        const result = originalQuery(sql, params);
        cacheService.set(sql, result);
        return result;
    };
};

enableQueryCache();