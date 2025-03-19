const fs = require('fs').promises;
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'data.json');


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



module.exports = {
    getQuestions,
    saveQuestions,
};
