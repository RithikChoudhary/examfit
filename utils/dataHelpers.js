const fs = require('fs').promises;
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'data.json');

// Cache for data loading promises
const dataCache = new Map();

async function getQuestions() {
    try {
        const data = await fs.readFile(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Create default structure if file doesn't exist
            const defaultData = { exams: [] };
            await fs.writeFile(dataPath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        throw error; // Re-throw other errors
    }
}

async function saveQuestions(data) {
    if (!data || !data.exams) {
        throw new Error('Invalid data structure');
    }
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
}

/**
 * Loads multiple data sources in parallel using Promise.all
 * @param {Array<string>} sources - Array of data source identifiers
 * @param {Function} loaderFn - Function that loads a single source (defaults to getQuestions)
 * @returns {Promise<Array>} - Promise resolving to array of loaded data
 */
async function loadDataInParallel(sources = ['default'], loaderFn = getQuestions) {
    // Create an array of promises for each source
    const loadPromises = sources.map(source => {
        // Use cache to avoid multiple concurrent requests for the same source
        if (!dataCache.has(source)) {
            dataCache.set(source, loaderFn(source));
        }
        return dataCache.get(source);
    });
    
    // Execute all promises in parallel
    return Promise.all(loadPromises);
}

// Clear cached promises on server restart
process.on('SIGTERM', () => {
    dataCache.clear();
});

module.exports = {
    getQuestions,
    saveQuestions,
    loadDataInParallel
};
