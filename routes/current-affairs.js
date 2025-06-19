const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Get current affairs data
function getCurrentAffairs() {
  try {
    const dataPath = path.join(__dirname, '../data/current_affairs.json');
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf8');
      return JSON.parse(rawData);
    }
    return {
      currentAffairs: [],
      lastUpdated: null,
      sources: [],
      categories: []
    };
  } catch (error) {
    console.error('Error loading current affairs:', error);
    return {
      currentAffairs: [],
      lastUpdated: null,
      sources: [],
      categories: []
    };
  }
}

// Main current affairs page
router.get('/', (req, res) => {
  try {
    const data = getCurrentAffairs();
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
router.get('/api/current-affairs', (req, res) => {
  try {
    const data = getCurrentAffairs();
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
router.get('/widget', (req, res) => {
  try {
    const data = getCurrentAffairs();
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
