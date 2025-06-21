class CacheService {
    constructor() {
        this.cache = new Map();
        this.indexes = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.maxCacheSize = 1000; // Maximum cache entries
        this.hitCount = 0;
        this.missCount = 0;
        
        // Initialize cleanup interval
        this.startCleanup();
        this.buildIndexes();
    }

    // Enhanced cache operations
    set(key, value, ttl = this.cacheTimeout) {
        // Check cache size limit
        if (this.cache.size >= this.maxCacheSize) {
            this.evictLRU();
        }

        this.cache.set(key, {
            data: value,
            timestamp: Date.now(),
            ttl,
            accessCount: 0,
            lastAccessed: Date.now()
        });
    }

    get(key) {
        if (!this.cache.has(key)) {
            this.missCount++;
            return null;
        }

        const item = this.cache.get(key);
        
        // Check if expired
        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            this.missCount++;
            return null;
        }

        // Update access statistics
        item.accessCount++;
        item.lastAccessed = Date.now();
        this.hitCount++;
        
        return item.data;
    }

    // Least Recently Used eviction
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, item] of this.cache.entries()) {
            if (item.lastAccessed < oldestTime) {
                oldestTime = item.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    // Cache statistics
    getStats() {
        const total = this.hitCount + this.missCount;
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            hitRate: total > 0 ? (this.hitCount / total * 100).toFixed(2) + '%' : '0%',
            hits: this.hitCount,
            misses: this.missCount,
            memoryUsage: this.getMemoryUsage()
        };
    }

    // Estimate memory usage
    getMemoryUsage() {
        let size = 0;
        for (const [key, item] of this.cache.entries()) {
            size += JSON.stringify(key).length;
            size += JSON.stringify(item.data).length;
            size += 64; // Overhead estimate
        }
        return `${(size / 1024 / 1024).toFixed(2)} MB`;
    }

    // Pattern-based cache invalidation
    invalidatePattern(pattern) {
        const regex = new RegExp(pattern);
        const keysToDelete = [];
        
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.cache.delete(key));
        return keysToDelete.length;
    }

    // Warm up cache with frequently accessed data
    async warmUp(dataLoader) {
        try {
            console.log('Warming up cache...');
            
            // Get actual exams from database instead of hardcoded list
            try {
                const allExams = await dataLoader.getAllExams(false); // Skip cache
                console.log(`Found ${allExams.length} exams for cache warm-up`);
                
                // Pre-load first few exams (most important ones)
                const examsToPreload = allExams.slice(0, 5); // Only preload first 5 to avoid delays
                
                for (const exam of examsToPreload) {
                    try {
                        const examData = await dataLoader.getExamById(exam.examId);
                        this.set(`exam_${exam.examId}`, examData);
                        console.log(`✓ Cached exam: ${exam.examId}`);
                    } catch (error) {
                        console.warn(`⚠️ Failed to cache exam ${exam.examId}:`, error.message);
                    }
                }
            } catch (error) {
                console.warn('⚠️ Could not get exams list for warm-up:', error.message);
            }
            
            console.log('Cache warm-up completed');
        } catch (error) {
            console.error('Cache warm-up failed:', error);
        }
    }

    // Build search indexes for faster lookups
    buildIndexes() {
        this.indexes.set('examsByName', new Map());
        this.indexes.set('subjectsByName', new Map());
        this.indexes.set('questionsByKeywords', new Map());
    }

    // Update search indexes
    updateIndex(indexName, key, value) {
        if (!this.indexes.has(indexName)) {
            this.indexes.set(indexName, new Map());
        }
        
        const index = this.indexes.get(indexName);
        
        if (Array.isArray(value)) {
            // Multiple values for one key
            index.set(key, value);
        } else {
            // Single value
            if (!index.has(key)) {
                index.set(key, []);
            }
            index.get(key).push(value);
        }
    }

    // Search using indexes
    searchIndex(indexName, query) {
        if (!this.indexes.has(indexName)) {
            return [];
        }
        
        const index = this.indexes.get(indexName);
        const results = [];
        const searchLower = query.toLowerCase();
        
        for (const [key, values] of index.entries()) {
            if (key.toLowerCase().includes(searchLower)) {
                results.push(...(Array.isArray(values) ? values : [values]));
            }
        }
        
        return results;
    }

    // Cache preloading strategies
    async preloadExamData(examService) {
        console.log('Starting aggressive cache preloading...');
        const startTime = Date.now();
        
        const exams = await examService.getAllExams(false); // Skip cache
        
        // Preload exam subjects in parallel for maximum speed
        const preloadPromises = exams.map(async (exam) => {
            try {
                // Preload exam details
                const fullExam = await examService.getExamById(exam.examId);
                this.set(`exam_${exam.examId}`, fullExam);
                
                // Preload subjects
                const subjects = await examService.getExamSubjects(exam.examId);
                this.set(`subjects_${exam.examId}`, subjects);
                
                // Update search indexes
                this.updateIndex('examsByName', exam.examName.toLowerCase(), exam);
                
                subjects.forEach(subject => {
                    this.updateIndex('subjectsByName', subject.subjectName.toLowerCase(), {
                        ...subject,
                        examId: exam.examId
                    });
                });
                
                console.log(`✓ Preloaded ${exam.examId} with ${subjects.length} subjects`);
                return { success: true, examId: exam.examId, subjectCount: subjects.length };
            } catch (error) {
                console.warn(`✗ Failed to preload data for exam ${exam.examId}:`, error.message);
                return { success: false, examId: exam.examId, error: error.message };
            }
        });
        
        // Execute all preloading in parallel
        const results = await Promise.allSettled(preloadPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - successful;
        const duration = Date.now() - startTime;
        
        console.log(`Cache preloading completed: ${successful} successful, ${failed} failed in ${duration}ms`);
        
        // Set preload completion flag
        this.set('preload_completed', {
            timestamp: Date.now(),
            successful,
            failed,
            duration,
            examsPreloaded: successful
        }, 24 * 60 * 60 * 1000); // Cache for 24 hours
    }

    // Fast preload check
    isPreloadCompleted() {
        const preloadData = this.get('preload_completed');
        return preloadData && preloadData.examsPreloaded > 0;
    }

    // Get preload statistics
    getPreloadStats() {
        return this.get('preload_completed') || {
            timestamp: 0,
            successful: 0,
            failed: 0,
            duration: 0,
            examsPreloaded: 0
        };
    }

    // Automatic cleanup of expired entries
    startCleanup() {
        setInterval(() => {
            this.cleanup();
        }, 60000); // Clean up every minute
    }

    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > item.ttl) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.cache.delete(key));
        
        if (keysToDelete.length > 0) {
            console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
        }
    }

    // Clear all cache and indexes
    clear() {
        this.cache.clear();
        this.indexes.clear();
        this.hitCount = 0;
        this.missCount = 0;
        this.buildIndexes();
    }

    // Export cache data for persistence
    export() {
        const data = {};
        for (const [key, item] of this.cache.entries()) {
            data[key] = {
                data: item.data,
                timestamp: item.timestamp,
                ttl: item.ttl
            };
        }
        return data;
    }

    // Import cache data from persistence
    import(data) {
        const now = Date.now();
        for (const [key, item] of Object.entries(data)) {
            // Only import non-expired items
            if (now - item.timestamp < item.ttl) {
                this.set(key, item.data, item.ttl - (now - item.timestamp));
            }
        }
    }
}

module.exports = new CacheService();
