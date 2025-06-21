const https = require('https');

function testURL(url) {
    return new Promise((resolve) => {
        const start = Date.now();
        https.get(url, (res) => {
            const time = Date.now() - start;
            console.log(`${res.statusCode} ${url} (${time}ms)`);
            resolve({ url, status: res.statusCode, time });
        }).on('error', (err) => {
            console.log(`ERROR ${url}: ${err.message}`);
            resolve({ url, error: err.message });
        });
    });
}

async function runQuickTests() {
    console.log('🧪 Quick Endpoint Test for examfit.in');
    console.log('=====================================');
    
    const urls = [
        'https://examfit.in/',
        'https://examfit.in/upsc',
        'https://examfit.in/upsc/economy/questionPapers',
        'https://examfit.in/upsc/geography/questionPapers',
        'https://examfit.in/practice',
        'https://examfit.in/practice/api/subjects/upsc',
        'https://examfit.in/api/health/mongodb',
        'https://examfit.in/api/health/data'
    ];
    
    for (const url of urls) {
        await testURL(url);
    }
    
    console.log('\n✅ Test completed');
}

runQuickTests();
