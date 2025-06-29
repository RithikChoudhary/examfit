const { MongoClient } = require('mongodb');

async function createOptimizedIndexes() {
  const mongoService = require('../services/mongoService');
  
  try {
    console.log('🔧 Creating optimized database indexes...');
    
    const db = await mongoService.connect();
    
    // Indexes for exams collection
    console.log('📚 Creating indexes for exams collection...');
    await db.collection('exams').createIndex({ examId: 1, isActive: 1 });
    await db.collection('exams').createIndex({ isActive: 1 });
    await db.collection('exams').createIndex({ examName: 1 });
    
    // Indexes for subjects collection
    console.log('📖 Creating indexes for subjects collection...');
    try {
      await db.collection('subjects').createIndex({ examId: 1 }, { name: 'examId_1_idx' });
    } catch (e) { console.log('   Index examId_1_idx already exists'); }
    
    try {
      await db.collection('subjects').createIndex({ examId: 1, subjectId: 1 }, { name: 'examId_subjectId_idx' });
    } catch (e) { console.log('   Index examId_subjectId_idx already exists'); }
    
    try {
      await db.collection('subjects').createIndex({ subjectName: 1 }, { name: 'subjectName_1_idx' });
    } catch (e) { console.log('   Index subjectName_1_idx already exists'); }
    
    // Indexes for questionPapers collection
    console.log('📄 Creating indexes for questionPapers collection...');
    await db.collection('questionPapers').createIndex({ examId: 1, subjectId: 1 });
    await db.collection('questionPapers').createIndex({ examId: 1, subjectId: 1, paperId: 1 });
    await db.collection('questionPapers').createIndex({ examId: 1, subjectId: 1, questionPaperId: 1 });
    
    // Indexes for questions collection
    console.log('❓ Creating indexes for questions collection...');
    await db.collection('questions').createIndex({ examId: 1, subjectId: 1 });
    await db.collection('questions').createIndex({ examId: 1, subjectId: 1, paperId: 1 });
    await db.collection('questions').createIndex({ questionId: 1 });
    
    // Compound indexes for better performance
    console.log('🔗 Creating compound indexes...');
    await db.collection('questions').createIndex({ 
      examId: 1, 
      subjectId: 1, 
      paperId: 1,
      questionId: 1 
    });
    
    // Index for current affairs
    console.log('📰 Creating indexes for current affairs...');
    await db.collection('currentAffairs').createIndex({ date: -1 });
    await db.collection('currentAffairs').createIndex({ scrapedAt: -1 });
    await db.collection('currentAffairs').createIndex({ date: -1, language: 1 });
    
    console.log('✅ All database indexes created successfully!');
    
    // Show index statistics
    const collections = ['exams', 'subjects', 'questionPapers', 'questions', 'currentAffairs'];
    
    for (const collectionName of collections) {
      const indexes = await db.collection(collectionName).indexes();
      console.log(`📊 ${collectionName} collection has ${indexes.length} indexes:`);
      indexes.forEach(index => {
        console.log(`   - ${JSON.stringify(index.key)} (${index.name})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createOptimizedIndexes()
    .then(() => {
      console.log('🎉 Index creation completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Index creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createOptimizedIndexes };
