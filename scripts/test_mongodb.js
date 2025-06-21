#!/usr/bin/env node

/**
 * MongoDB Connection Test Script
 * Tests the MongoDB connection and displays database statistics
 */

const path = require('path');

// Add the parent directory to the module path so we can require mongoService
process.chdir(path.join(__dirname, '..'));

const mongoService = require('./services/mongoService');

async function testMongoDB() {
    console.log('🧪 Testing MongoDB Connection...');
    console.log('================================');
    
    try {
        // Test 1: Health Check
        console.log('📊 Running health check...');
        const health = await mongoService.healthCheck();
        
        if (health.status === 'healthy') {
            console.log('✅ MongoDB connection successful!');
            console.log('\n📈 Database Statistics:');
            console.log(`   📚 Exams: ${health.collections.exams.toLocaleString()}`);
            console.log(`   📖 Subjects: ${health.collections.subjects.toLocaleString()}`);
            console.log(`   📄 Question Papers: ${health.collections.questionPapers.toLocaleString()}`);
            console.log(`   ❓ Questions: ${health.collections.questions.toLocaleString()}`);
        } else {
            console.log('❌ MongoDB health check failed');
            console.log('Error:', health.error);
            process.exit(1);
        }
        
        // Test 2: Get Exams
        console.log('\n🔍 Testing data retrieval...');
        const exams = await mongoService.getExams();
        console.log(`✅ Retrieved ${exams.length} exams`);
        
        if (exams.length > 0) {
            console.log('\n📚 Available Exams:');
            exams.forEach(exam => {
                console.log(`   • ${exam.examName} (${exam.examId}) - ${exam.subjects?.length || 0} subjects`);
            });
            
            // Test 3: Get Random Questions
            if (exams[0] && exams[0].subjects && exams[0].subjects[0]) {
                const firstExam = exams[0];
                const firstSubject = firstExam.subjects[0];
                
                console.log(`\n🎲 Testing random questions (${firstExam.examId} → ${firstSubject.subjectId})...`);
                try {
                    const randomQuestions = await mongoService.getRandomQuestions(
                        firstExam.examId, 
                        firstSubject.subjectId, 
                        3
                    );
                    console.log(`✅ Retrieved ${randomQuestions.length} random questions`);
                    
                    if (randomQuestions.length > 0) {
                        console.log('\n📝 Sample Question:');
                        const sample = randomQuestions[0];
                        console.log(`   Q: ${sample.question.substring(0, 100)}${sample.question.length > 100 ? '...' : ''}`);
                        console.log(`   Options: ${sample.options.length}`);
                        console.log(`   Correct: ${sample.correctOption}`);
                    }
                } catch (error) {
                    console.log('⚠️  Random questions test failed (this is normal if no questions exist yet)');
                    console.log('   Error:', error.message);
                }
            }
        }
        
        // Test 4: Fallback System
        console.log('\n🔄 Testing fallback system...');
        const fallbackData = await mongoService.getDataWithFallback();
        console.log(`✅ Fallback system working - data source: ${fallbackData.source}`);
        
        console.log('\n🎉 All tests completed successfully!');
        console.log('\n🎯 Next Steps:');
        console.log('1. Update your routes to use mongoService');
        console.log('2. Test your application with MongoDB data');
        console.log('3. Monitor performance improvements');
        
        process.exit(0);
        
    } catch (error) {
        console.log('\n❌ MongoDB test failed!');
        console.log('Error:', error.message);
        
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check if MongoDB migration was run successfully');
        console.log('2. Verify your internet connection');
        console.log('3. Ensure MongoDB Atlas cluster is running');
        console.log('4. Check connection string in mongoService.js');
        
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down...');
    await mongoService.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n👋 Shutting down...');
    await mongoService.disconnect();
    process.exit(0);
});

// Run the test
if (require.main === module) {
    testMongoDB().catch(console.error);
}

module.exports = testMongoDB;
