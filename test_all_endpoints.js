#!/usr/bin/env node

/**
 * Comprehensive Endpoint Testing Script
 * Tests all major routes and identifies issues
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const IS_HTTPS = BASE_URL.startsWith('https');

console.log(`🧪 Testing endpoints for: ${BASE_URL}`);
console.log('='=40);

// Test results storage
const results = {
    passed: [],
    failed: [],
    slow: []
};

// Make HTTP request
function makeRequest(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (IS_HTTPS ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            timeout: timeout,
            headers: {
                'User-Agent': 'ExamFit-Endpoint-Tester/1.0'
            }
        };

        const client = IS_HTTPS ? https : http;
        
        const req = client.request(options, (res) => {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    url,
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    responseTime,
                    contentLength: data.length,
                    headers: res.headers,
                    body: data.substring(0, 500) // First 500 chars
                });
            });
        });

        req.on('error', (error) => {
            reject({
                url,
                error: error.message,
                responseTime: Date.now() - startTime
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject({
                url,
                error: 'Request timeout',
                responseTime: timeout
            });
        });

        req.end();
    });
}

// Test an endpoint
async function testEndpoint(path, expectedStatus = 200, description = '') {
    const url = BASE_URL + path;
    
    try {
        console.log(`🔍 Testing: ${path} ${description ? '(' + description + ')' : ''}`);
        const result = await makeRequest(url);
        
        const status = result.statusCode === expectedStatus ? '✅' : '❌';
        const timeStatus = result.responseTime > 3000 ? '🐌' : result.responseTime > 1000 ? '⏰' : '⚡';
        
        console.log(`   ${status} ${result.statusCode} ${result.statusMessage} ${timeStatus} ${result.responseTime}ms (${result.contentLength} bytes)`);
        
        if (result.statusCode === expectedStatus) {
            results.passed.push({ path, ...result });
            if (result.responseTime > 2000) {
                results.slow.push({ path, ...result });
            }
        } else {
            results.failed.push({ path, expected: expectedStatus, ...result });
        }
        
        return result;
    } catch (error) {
        console.log(`   ❌ FAILED: ${error.error}`);
        results.failed.push({ path, ...error });
        return error;
    }
}

// Main testing function
async function runTests() {
    console.log('\n📄 Testing Main Pages');
    console.log('-'.repeat(20));
    
    // Main pages
    await testEndpoint('/', 200, 'Homepage');
    await testEndpoint('/practice', 200, 'Practice page');
    await testEndpoint('/current-affairs', 200, 'Current affairs');
    await testEndpoint('/blog', 200, 'Blog');
    await testEndpoint('/contact', 200, 'Contact page');
    await testEndpoint('/dashboard', 200, 'Dashboard');
    
    console.log('\n🔧 Testing Health Endpoints');
    console.log('-'.repeat(25));
    
    // Health check endpoints
    await testEndpoint('/api/health/mongodb', 200, 'MongoDB health');
    await testEndpoint('/api/health/data', 200, 'Data health');
    
    console.log('\n📚 Testing Exam Routes');
    console.log('-'.repeat(20));
    
    // Test some exam routes
    await testEndpoint('/upsc', 200, 'UPSC exam page');
    await testEndpoint('/upsc/economy/questionPapers', 200, 'UPSC Economy papers');
    await testEndpoint('/upsc/geography/questionPapers', 200, 'UPSC Geography papers');
    
    console.log('\n🎯 Testing Practice API Endpoints');
    console.log('-'.repeat(30));
    
    // Practice API endpoints
    await testEndpoint('/practice/api/subjects/upsc', 200, 'UPSC subjects API');
    await testEndpoint('/practice/api/subjects/union-public-service-commission-(cms)', 200, 'CMS subjects API');
    
    console.log('\n📊 Testing API Endpoints');
    console.log('-'.repeat(20));
    
    // API endpoints
    await testEndpoint('/api/subjects/upsc', 200, 'Legacy subjects API');
    await testEndpoint('/api/v1/exams', 200, 'V1 exams API');
    
    console.log('\n🔍 Testing Error Cases');
    console.log('-'.repeat(20));
    
    // Test 404 cases
    await testEndpoint('/nonexistent-page', 404, 'Non-existent page');
    await testEndpoint('/practice/api/subjects/fake-exam', 404, 'Fake exam subjects');
    await testEndpoint('/api/fake-endpoint', 404, 'Fake API endpoint');
    
    console.log('\n📱 Testing Static Files');
    console.log('-'.repeat(20));
    
    // Static files
    await testEndpoint('/favicon.ico', 200, 'Favicon');
    await testEndpoint('/robots.txt', 200, 'Robots.txt');
    await testEndpoint('/sitemap.xml', 200, 'Sitemap');
    await testEndpoint('/css/style.css', 200, 'Main CSS');
    await testEndpoint('/js/app.js', 200, 'Main JS');
    
    // Generate report
    generateReport();
}

function generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 ENDPOINT TEST REPORT');
    console.log('='.repeat(50));
    
    console.log(`\n✅ PASSED: ${results.passed.length} endpoints`);
    console.log(`❌ FAILED: ${results.failed.length} endpoints`);
    console.log(`🐌 SLOW (>2s): ${results.slow.length} endpoints`);
    
    if (results.failed.length > 0) {
        console.log('\n❌ FAILED ENDPOINTS:');
        results.failed.forEach(result => {
            console.log(`   ${result.path}: ${result.error || `${result.statusCode} (expected ${result.expected})`}`);
        });
    }
    
    if (results.slow.length > 0) {
        console.log('\n🐌 SLOW ENDPOINTS (>2s):');
        results.slow.forEach(result => {
            console.log(`   ${result.path}: ${result.responseTime}ms`);
        });
    }
    
    if (results.passed.length > 0) {
        console.log('\n⚡ FASTEST ENDPOINTS:');
        results.passed
            .sort((a, b) => a.responseTime - b.responseTime)
            .slice(0, 5)
            .forEach(result => {
                console.log(`   ${result.path}: ${result.responseTime}ms`);
            });
        
        console.log('\n📈 PERFORMANCE SUMMARY:');
        const times = results.passed.map(r => r.responseTime);
        const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);
        
        console.log(`   Average: ${avgTime}ms`);
        console.log(`   Fastest: ${minTime}ms`);
        console.log(`   Slowest: ${maxTime}ms`);
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (results.slow.length > 0) {
        console.log('   - Optimize slow endpoints with caching or database indexes');
    }
    if (results.failed.length > 0) {
        console.log('   - Fix failed endpoints to prevent user issues');
    }
    if (results.passed.length === 0) {
        console.log('   - Server may not be running or accessible');
    } else {
        console.log('   - Most endpoints are working correctly!');
    }
    
    console.log('\n' + '='.repeat(50));
    
    // Exit with error code if any tests failed
    if (results.failed.length > 0) {
        process.exit(1);
    }
}

// Run the tests
if (require.main === module) {
    console.log('🚀 Starting comprehensive endpoint tests...\n');
    
    runTests().catch(error => {
        console.error('💥 Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = { testEndpoint, runTests };
