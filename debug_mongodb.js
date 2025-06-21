#!/usr/bin/env node

const mongoService = require('./services/mongoService');

async function debugMongoDB() {
    try {
        console.log('🔍 MongoDB Debug Script');
        console.log('========================');
        
        // Test connection
        console.log('\n1. Testing MongoDB connection...');
        await mongoService.connect();
        console.log('✅ Connected to MongoDB');
        
        // Get all exams
        console.log('\n2. Getting all exams...');
        const exams = await mongoService.getExams();
        console.log(`✅ Found ${exams.length} exams`);
        
        // List exam IDs
        console.log('\n3. Available exam IDs:');
        exams.forEach(exam => {
            console.log(`   - ${exam.examId}: ${exam.examName}`);
        });
        
        // Test specific exam
        const testExamId = 'union-public-service-commission-(cms)'; // This was the slow one
        console.log(`\n4. Testing exam: ${testExamId}`);
        
        try {
            const subjects = await mongoService.getSubjectsByExam(testExamId);
            console.log(`✅ Found ${subjects.length} subjects for ${testExamId}`);
            
            if (subjects.length > 0) {
                console.log('\n5. First subject details:');
                const firstSubject = subjects[0];
                console.log(`   Subject: ${firstSubject.subjectName} (${firstSubject.subjectId})`);
                console.log(`   Question Papers: ${firstSubject.questionPapers?.length || 0}`);
                console.log(`   Total Questions: ${firstSubject.totalQuestions || 0}`);
                
                if (firstSubject.questionPapers?.length > 0) {
                    console.log('\n6. First question paper:');
                    const firstPaper = firstSubject.questionPapers[0];
                    console.log(`   Paper: ${firstPaper.questionPaperName}`);
                    console.log(`   Section: ${firstPaper.section || 'N/A'}`);
                    console.log(`   Questions: ${firstPaper.questionCount || 0}`);
                } else {
                    console.log('❌ No question papers found in first subject');
                }
            }
        } catch (error) {
            console.log(`❌ Error testing ${testExamId}:`, error.message);
        }
        
        // Test UPSC as well
        console.log(`\n7. Testing exam: upsc`);
        try {
            const upscSubjects = await mongoService.getSubjectsByExam('upsc');
            console.log(`✅ Found ${upscSubjects.length} subjects for upsc`);
            
            if (upscSubjects.length > 0) {
                const firstUpscSubject = upscSubjects[0];
                console.log(`   First UPSC Subject: ${firstUpscSubject.subjectName}`);
                console.log(`   Question Papers: ${firstUpscSubject.questionPapers?.length || 0}`);
            }
        } catch (error) {
            console.log(`❌ Error testing upsc:`, error.message);
        }
        
        // Test direct MongoDB collections
        console.log('\n8. Testing direct MongoDB collections...');
        const db = await mongoService.connect();
        
        const examCount = await db.collection('exams').countDocuments();
        const subjectCount = await db.collection('subjects').countDocuments();
        const paperCount = await db.collection('questionPapers').countDocuments();
        const questionCount = await db.collection('questions').countDocuments();
        
        console.log(`   Exams: ${examCount}`);
        console.log(`   Subjects: ${subjectCount}`);
        console.log(`   Question Papers: ${paperCount}`);
        console.log(`   Questions: ${questionCount}`);
        
        // Test specific subject
        console.log('\n9. Testing specific subject query...');
        const sampleSubjects = await db.collection('subjects').find({}).limit(3).toArray();
        console.log(`   Sample subjects:`, sampleSubjects.map(s => `${s.examId}/${s.subjectId}`));
        
        // Test question papers for a subject
        if (sampleSubjects.length > 0) {
            const firstSub = sampleSubjects[0];
            const papers = await db.collection('questionPapers').find({
                examId: firstSub.examId,
                subjectId: firstSub.subjectId
            }).toArray();
            console.log(`   Papers for ${firstSub.examId}/${firstSub.subjectId}: ${papers.length}`);
        }
        
        console.log('\n✅ Debug completed successfully');
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    debugMongoDB();
}

module.exports = debugMongoDB;
