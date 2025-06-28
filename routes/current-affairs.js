const express = require('express');
const router = express.Router();

// Get current affairs data from MongoDB
async function getCurrentAffairs() {
  try {
    console.log('📰 Loading current affairs from MongoDB...');
    
    // Use MongoDB instead of file system
    const mongoService = require('../services/mongoService');
    const db = await mongoService.connect();
    
    // Get current affairs from MongoDB
    const currentAffairs = await db.collection('currentAffairs').find({}).sort({ publishedDate: -1 }).toArray();
    
    // Get metadata
    const metadata = await db.collection('currentAffairsMetadata').findOne({}) || {};
    
    // Extract unique categories and sources
    const categories = [...new Set(currentAffairs.map(affair => affair.category).filter(Boolean))];
    const sources = [...new Set(currentAffairs.map(affair => affair.source).filter(Boolean))];
    
    console.log(`✅ Loaded ${currentAffairs.length} current affairs from MongoDB`);
    
    return {
      currentAffairs,
      lastUpdated: metadata.lastUpdated || new Date().toISOString(),
      sources,
      categories
    };
  } catch (error) {
    console.error('❌ Error loading current affairs from MongoDB:', error);
    
    // Fallback to empty data with proper structure
    return {
      currentAffairs: [],
      lastUpdated: null,
      sources: [],
      categories: []
    };
  }
}

// Main current affairs page
router.get('/', async (req, res) => {
  try {
    const data = await getCurrentAffairs();
    const { category, importance } = req.query;
    
    let filteredAffairs = data.currentAffairs || [];
    
    // Only filter if specific values are selected (not 'all' or undefined)
    if (category && category !== 'all' && category !== '') {
      filteredAffairs = filteredAffairs.filter(affair => 
        affair.category === category
      );
    }
    
    // Only filter if specific values are selected (not 'all' or undefined)
    if (importance && importance !== 'all' && importance !== '') {
      filteredAffairs = filteredAffairs.filter(affair => 
        affair.importance === importance
      );
    }
    
    // Group by category for better organization
    const groupedAffairs = {};
    filteredAffairs.forEach(affair => {
      if (!groupedAffairs[affair.category]) {
        groupedAffairs[affair.category] = [];
      }
      groupedAffairs[affair.category].push(affair);
    });
    
    res.render('current-affairs', {
      title: 'Current Affairs - ExamFit',
      currentAffairs: filteredAffairs,
      groupedAffairs: groupedAffairs,
      categories: data.categories || [],
      sources: data.sources || [],
      lastUpdated: data.lastUpdated,
      selectedCategory: category || 'all',
      selectedImportance: importance || 'all',
      totalCount: data.currentAffairs?.length || 0,
      filteredCount: filteredAffairs.length
    });
  } catch (error) {
    console.error('Error in current affairs route:', error);
    res.status(500).render('error', { 
      message: 'Failed to load current affairs',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// API endpoint for current affairs
router.get('/api/current-affairs', async (req, res) => {
  try {
    const data = await getCurrentAffairs();
    const { category, importance, limit } = req.query;
    
    let filteredAffairs = data.currentAffairs || [];
    
    // Apply filters
    if (category && category !== 'all') {
      filteredAffairs = filteredAffairs.filter(affair => 
        affair.category === category
      );
    }
    
    if (importance && importance !== 'all') {
      filteredAffairs = filteredAffairs.filter(affair => 
        affair.importance === importance
      );
    }
    
    // Apply limit
    if (limit) {
      filteredAffairs = filteredAffairs.slice(0, parseInt(limit));
    }
    
    res.json({
      success: true,
      data: {
        currentAffairs: filteredAffairs,
        categories: data.categories,
        sources: data.sources,
        lastUpdated: data.lastUpdated,
        total: filteredAffairs.length
      }
    });
  } catch (error) {
    console.error('Error in current affairs API:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load current affairs'
    });
  }
});

// Widget for homepage
router.get('/widget', async (req, res) => {
  try {
    const data = await getCurrentAffairs();
    const recentAffairs = data.currentAffairs?.slice(0, 5) || [];
    
    res.json({
      success: true,
      data: {
        recentAffairs,
        lastUpdated: data.lastUpdated,
        totalCount: data.currentAffairs?.length || 0
      }
    });
  } catch (error) {
    console.error('Error in current affairs widget:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load current affairs widget'
    });
  }
});

module.exports = router;
