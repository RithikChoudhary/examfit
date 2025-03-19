const cache = new Map();
const { cacheHits, cacheMisses } = require('./performance');

class CacheService {
    constructor(defaultTtl = 3600000) { // 1 hour default expiry
        this.defaultTtl = defaultTtl;
    }

    async get(key) {
        const startTime = Date.now();
        const item = cache.get(key);
        
        if (!item) {
            cacheMisses++;
            console.log(`Cache miss: ${key} (Time: ${Date.now() - startTime}ms)`);
            return null;
        }
        
        if (Date.now() > item.expires) {
            cache.delete(key);
            cacheMisses++;
            console.log(`Cache expired: ${key} (Time: ${Date.now() - startTime}ms)`);
            return null;
        }
        
        cacheHits++;
        console.log(`Cache hit: ${key} (Time: ${Date.now() - startTime}ms)`);
        return item.value;
    }

    async set(key, value, ttl = this.defaultTtl) {
        cache.set(key, {
            value,
            expires: Date.now() + ttl
        });
        return value;
    }

    async clear(key) {
        if (key) {
            cache.delete(key);
        } else {
            cache.clear();
        }
    }

    async getCacheHitRate() {
        const total = cacheHits + cacheMisses;
        return total > 0 ? cacheHits / total : 0;
    }

    async trackRequest(key, fn) {
        const startTime = Date.now();
        const cachedValue = await this.get(key);
        
        if (cachedValue !== null) {
            return cachedValue;
        }
        
        const result = await fn();
        await this.set(key, result);
        console.log(`Generated and cached new value for ${key} in ${Date.now() - startTime}ms`);
        return result;
    }
}

export const cacheService = new CacheService();
