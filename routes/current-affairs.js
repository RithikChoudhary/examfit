const express = require('express');
const router = express.Router();
const dailyCurrentAffairsService = require('../services/dailyCurrentAffairsService');

// Main current affairs page
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    // Default to 2 days ago instead of today
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 2);
    const selectedDate = date || defaultDate.toISOString().split('T')[0];
    
    // Get current affairs for the selected date
    let currentAffairs = await dailyCurrentAffairsService.getCurrentAffairsByDate(selectedDate);
    
    // If no current affairs exist for this date, fetch them from NewsAPI
    if (currentAffairs.length === 0 && selectedDate) {
      console.log(`📡 No current affairs found for ${selectedDate}, fetching from NewsAPI...`);
      try {
        const fetchResult = await dailyCurrentAffairsService.scrapeAffairsForDate(selectedDate);
        if (fetchResult.success) {
          // Fetch the newly saved current affairs
          currentAffairs = await dailyCurrentAffairsService.getCurrentAffairsByDate(selectedDate);
          console.log(`✅ Fetched ${currentAffairs.length} current affairs for ${selectedDate}`);
        }
      } catch (fetchError) {
        console.error(`❌ Error fetching current affairs for ${selectedDate}:`, fetchError);
      }
    }
    
    // Get available dates for date picker
    const availableDates = await dailyCurrentAffairsService.getAvailableDates();
    
    res.render('current-affairs', {
      title: 'Current Affairs - ExamFit',
      currentAffairs,
      selectedDate,
      availableDates,
      totalCount: currentAffairs.length,
      lastUpdated: currentAffairs.length > 0 ? currentAffairs[0].scrapedAt : null
    });
  } catch (error) {
    console.error('Error in current affairs route:', error);
    res.status(500).render('error', { 
      message: 'Failed to load current affairs',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// API endpoint - Get today's current affairs
router.get('/api/current-affairs/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const affairs = await dailyCurrentAffairsService.getTodaysAffairs();
    
    res.json({
      success: true,
      date: today,
      affairs,
      count: affairs.length
    });
  } catch (error) {
    console.error('Error in today\'s current affairs API:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load today\'s current affairs'
    });
  }
});

// API endpoint - Get current affairs for a specific date
router.get('/api/current-affairs/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const affairs = await dailyCurrentAffairsService.getCurrentAffairsByDate(date);
    
    res.json({
      success: true,
      date,
      affairs,
      count: affairs.length
    });
  } catch (error) {
    console.error('Error in current affairs API:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load current affairs'
    });
  }
});

// API endpoint - Get available dates
router.get('/api/current-affairs/dates', async (req, res) => {
  try {
    const dates = await dailyCurrentAffairsService.getAvailableDates();
    
    res.json({
      success: true,
      dates
    });
  } catch (error) {
    console.error('Error getting available dates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available dates'
    });
  }
});

// API endpoint - Manual update (for testing)
router.post('/api/current-affairs/update', async (req, res) => {
  try {
    const { date } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`🔄 Manual update requested for date: ${targetDate}`);
    const result = await dailyCurrentAffairsService.manualUpdate(targetDate);
    
    res.json({
      success: true,
      message: `Current affairs updated successfully for ${targetDate}`,
      result
    });
  } catch (error) {
    console.error('Error in manual update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update current affairs'
    });
  }
});

// Widget for homepage
router.get('/widget', async (req, res) => {
  try {
    const recentAffairs = await dailyCurrentAffairsService.getTodaysAffairs();
    
    res.json({
      success: true,
      data: {
        recentAffairs: recentAffairs.slice(0, 5),
        lastUpdated: recentAffairs.length > 0 ? recentAffairs[0].scrapedAt : null,
        totalCount: recentAffairs.length
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

// Dynamic sitemap for current affairs
router.get('/sitemap.xml', async (req, res) => {
  try {
    const availableDates = await dailyCurrentAffairsService.getAvailableDates();
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() - 2); // 2 days ago limit
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Main Current Affairs Page -->
  <url>
    <loc>https://examfit.in/current-affairs</loc>
    <lastmod>${today.toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;

    // Add recent dates (last 30 days)
    for (let i = 0; i < 30; i++) {
      const date = new Date(maxDate);
      date.setDate(maxDate.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const priority = i < 7 ? '0.8' : '0.7'; // Higher priority for recent dates
      const changefreq = i < 7 ? 'daily' : 'weekly';
      
      sitemap += `  <url>
    <loc>https://examfit.in/current-affairs?date=${dateStr}</loc>
    <lastmod>${today.toISOString().split('T')[0]}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>
`;
    }

    sitemap += '</urlset>';
    
    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Error generating current affairs sitemap:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Sitemap generation failed</error>');
  }
});

module.exports = router;
