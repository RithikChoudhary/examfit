const axios = require('axios');
const puppeteer = require('puppeteer');
const mongoService = require('./mongoService');

class DailyCurrentAffairsService {
  constructor() {
    this.sources = {
      newsapi: 'https://newsapi.org/v2/everything',
      pib: 'https://pib.gov.in/indexd.aspx',
      thehindu: 'https://www.thehindu.com/news/national/',
      indianexpress: 'https://indianexpress.com/section/india/',
      livemint: 'https://www.livemint.com/news'
    };
    this.newsApiKey = 'e790c2966d0c4792ba555f4067251cbb';
  }

  async scrapeTodaysAffairs() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`📰 Starting current affairs scraping for ${today}...`);
    
    try {
      // Check if today's affairs already exist
      const db = await mongoService.connect();
      const existingCount = await db.collection('currentAffairs').countDocuments({ date: today });
      
      if (existingCount > 0) {
        console.log(`⚠️ Current affairs for ${today} already exist (${existingCount} items). Skipping...`);
        return { success: true, message: 'Already exists', count: existingCount };
      }

      // Scrape from multiple sources
      const allAffairs = await this.scrapeFromMultipleSources();
      
      if (allAffairs.length === 0) {
        console.log('⚠️ No current affairs found from any source');
        return { success: false, message: 'No content found' };
      }

      // Save to database
      let savedCount = 0;
      for (let i = 0; i < allAffairs.length; i++) {
        try {
          await this.saveAffair({
            date: today,
            title: allAffairs[i].title,
            description: allAffairs[i].description,
            content: allAffairs[i].content,
            source: allAffairs[i].source,
            url: allAffairs[i].url,
            urlToImage: allAffairs[i].urlToImage,
            publishedAt: allAffairs[i].publishedAt,
            author: allAffairs[i].author,
            sourceUrl: allAffairs[i].sourceUrl,
            sourceId: allAffairs[i].sourceId,
            scrapedAt: new Date(),
            order: i + 1
          });
          savedCount++;
        } catch (error) {
          console.error(`❌ Error saving affair ${i + 1}:`, error.message);
        }
      }

      console.log(`✅ Successfully scraped and saved ${savedCount} current affairs for ${today}`);
      return { success: true, count: savedCount, date: today };

    } catch (error) {
      console.error('❌ Error in scrapeTodaysAffairs:', error);
      throw error;
    }
  }

  async scrapeFromMultipleSources(targetDate = null) {
    try {
      console.log(`🔍 Fetching current affairs from NewsAPI for date: ${targetDate || 'today'}...`);
      
      // Use NewsAPI as primary and only source
      const affairs = [];
      
      // Fetch from NewsAPI (primary source)
      try {
        const newsAffairs = await this.scrapeNewsAPIs(targetDate);
        affairs.push(...newsAffairs);
        console.log(`✅ Fetched ${newsAffairs.length} affairs from NewsAPI`);
      } catch (error) {
        console.log('⚠️ NewsAPI failed:', error.message);
      }
      
      // Try PIB RSS as secondary source only if NewsAPI fails
      if (affairs.length === 0) {
        try {
          const pibAffairs = await this.scrapePIB();
          affairs.push(...pibAffairs);
          console.log(`✅ Fetched ${pibAffairs.length} affairs from PIB as fallback`);
        } catch (error) {
          console.log('⚠️ PIB RSS failed:', error.message);
        }
      }
      
      // If no real data available, return empty array
      if (affairs.length === 0) {
        console.log('⚠️ No current affairs found from any source');
        return [];
      }
      
      return affairs; // Return all fetched affairs

    } catch (error) {
      console.error('❌ Error fetching from sources:', error.message);
      
      // Return empty array if all sources fail
      return [];
    }
  }


  async scrapePIB() {
    try {
      // PIB RSS feed
      const response = await axios.get('https://pib.gov.in/rss/leng.xml', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      // Parse RSS (simplified parsing)
      const affairs = [];
      const items = response.data.match(/<item>[\s\S]*?<\/item>/g) || [];
      
      for (let i = 0; i < Math.min(items.length, 5); i++) {
        const item = items[i];
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        
        if (titleMatch && descMatch) {
          affairs.push({
            title: this.cleanText(titleMatch[1]),
            content: this.cleanText(descMatch[1]),
            source: 'PIB',
            url: linkMatch ? linkMatch[1] : this.sources.pib
          });
        }
      }
      
      return affairs;
    } catch (error) {
      console.log('PIB scraping failed:', error.message);
      return [];
    }
  }

  async scrapeNewsAPIs(targetDate = null) {
    try {
      console.log('🔍 Fetching news from NewsAPI...');
      
      // Calculate the date limit (30 days ago for free plan)
      const today = new Date();
      const dateLimit = new Date();
      dateLimit.setDate(today.getDate() - 30);
      
      // Use the target date if provided, otherwise use yesterday
      let fromDate;
      if (targetDate) {
        const targetDateObj = new Date(targetDate);
        
        // Check if date is within NewsAPI limits
        if (targetDateObj < dateLimit) {
          console.log(`⚠️ Date ${targetDate} is beyond NewsAPI free plan limit (30 days)`);
          console.log(`📅 Using date from 7 days ago instead`);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(today.getDate() - 7);
          fromDate = sevenDaysAgo.toISOString().split('T')[0];
        } else if (targetDateObj > today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          fromDate = yesterday.toISOString().split('T')[0];
          console.log(`📅 Target date ${targetDate} is in future, using yesterday: ${fromDate}`);
        } else {
          fromDate = targetDate;
          console.log(`📅 Fetching news for selected date: ${targetDate}`);
        }
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        fromDate = yesterday.toISOString().split('T')[0];
        console.log(`📅 Fetching news for yesterday: ${fromDate}`);
      }
      
      // Make a focused query for India-specific news
      const query = 'india';
      // Add 'to' parameter to get news only for the specific date
      const toDate = fromDate; // Same as from date to get news for that day only
      // Add language=en to get only English articles
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${fromDate}&to=${toDate}&language=en&sortBy=publishedAt&apiKey=${this.newsApiKey}&pageSize=100`;
      
      console.log(`📡 Making single API request for date: ${fromDate}`);
      
      try {
        const response = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.data && response.data.articles) {
          console.log(`📊 Total results available: ${response.data.totalResults}`);
          
          const articles = response.data.articles
            .filter(article => 
              article.title && 
              (article.description || article.content) && 
              article.title.length > 10 &&
              !article.title.toLowerCase().includes('[removed]') &&
              !article.description?.toLowerCase().includes('[removed]') &&
              !article.content?.toLowerCase().includes('[removed]')
            );
          
          console.log(`✅ Found ${articles.length} valid articles in single request`);
          
          // Convert to current affairs format with ALL fields
          const currentAffairs = articles.map(article => {
            // Get full content, remove NewsAPI suffix
            let fullContent = '';
            if (article.content) {
              fullContent = article.content.replace(/\[\+\d+\s+chars\]$/, '').trim();
            }
            
            return {
              title: article.title || '',
              description: article.description || '',
              content: fullContent || article.description || '',
              source: article.source?.name || 'NewsAPI',
              url: article.url || '',
              urlToImage: article.urlToImage || '',
              publishedAt: article.publishedAt || new Date().toISOString(),
              author: article.author || '',
              sourceUrl: article.source?.url || '',
              sourceId: article.source?.id || ''
            };
          });
          
          console.log(`📰 Successfully fetched ${currentAffairs.length} current affairs from NewsAPI for ${fromDate}`);
          return currentAffairs;
        }
        
        return [];
        
      } catch (error) {
        if (error.response?.status === 429) {
          console.log('❌ Rate limit exceeded. Please check your API key quota.');
          console.log('Error details:', error.response.data);
        } else {
          console.log('❌ NewsAPI request failed:', error.message);
        }
        return [];
      }
      
    } catch (error) {
      console.log('❌ NewsAPI scraping failed:', error.message);
      return [];
    }
  }


  cleanText(text) {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, ' ') // Replace newlines with space
      .trim()
      .substring(0, 2000); // Limit length
  }


  async saveAffair(affairData) {
    try {
      const db = await mongoService.connect();
      
      // Check for duplicates based on title and date
      const existing = await db.collection('currentAffairs').findOne({
        date: affairData.date,
        title: affairData.title
      });

      if (existing) {
        console.log(`⚠️ Duplicate affair found: ${affairData.title}`);
        return existing;
      }

      const result = await db.collection('currentAffairs').insertOne(affairData);
      console.log(`✅ Saved affair: ${affairData.title.substring(0, 50)}...`);
      
      return result;
    } catch (error) {
      console.error('❌ Error saving affair to database:', error);
      throw error;
    }
  }

  async getCurrentAffairsByDate(date) {
    try {
      const db = await mongoService.connect();
      const affairs = await db.collection('currentAffairs')
        .find({ date })
        .sort({ order: 1 })
        .toArray();
      
      return affairs;
    } catch (error) {
      console.error('❌ Error getting current affairs by date:', error);
      throw error;
    }
  }

  async getAvailableDates() {
    try {
      const db = await mongoService.connect();
      const dates = await db.collection('currentAffairs')
        .distinct('date');
      
      return dates.sort().reverse(); // Latest first
    } catch (error) {
      console.error('❌ Error getting available dates:', error);
      throw error;
    }
  }

  async getTodaysAffairs() {
    const today = new Date().toISOString().split('T')[0];
    return this.getCurrentAffairsByDate(today);
  }

  // Fetch current affairs for a specific date
  async scrapeAffairsForDate(targetDate) {
    console.log(`📰 Starting current affairs scraping for ${targetDate}...`);
    
    try {
      // Check if affairs for this date already exist
      const db = await mongoService.connect();
      const existingCount = await db.collection('currentAffairs').countDocuments({ date: targetDate });
      
      if (existingCount > 0) {
        console.log(`⚠️ Current affairs for ${targetDate} already exist (${existingCount} items). Skipping...`);
        return { success: true, message: 'Already exists', count: existingCount, date: targetDate };
      }

      // Scrape from multiple sources for the specific date
      const allAffairs = await this.scrapeFromMultipleSources(targetDate);
      
      if (allAffairs.length === 0) {
        console.log(`⚠️ No current affairs found for ${targetDate}`);
        return { success: false, message: 'No content found', date: targetDate };
      }

      // Save to database
      let savedCount = 0;
      for (let i = 0; i < allAffairs.length; i++) {
        try {
          await this.saveAffair({
            date: targetDate,
            title: allAffairs[i].title,
            description: allAffairs[i].description,
            content: allAffairs[i].content,
            source: allAffairs[i].source,
            url: allAffairs[i].url,
            urlToImage: allAffairs[i].urlToImage,
            publishedAt: allAffairs[i].publishedAt,
            author: allAffairs[i].author,
            sourceUrl: allAffairs[i].sourceUrl,
            sourceId: allAffairs[i].sourceId,
            scrapedAt: new Date(),
            order: i + 1
          });
          savedCount++;
        } catch (error) {
          console.error(`❌ Error saving affair ${i + 1}:`, error.message);
        }
      }

      console.log(`✅ Successfully scraped and saved ${savedCount} current affairs for ${targetDate}`);
      return { success: true, count: savedCount, date: targetDate };

    } catch (error) {
      console.error(`❌ Error in scrapeAffairsForDate for ${targetDate}:`, error);
      throw error;
    }
  }

  // Manual trigger for testing
  async manualUpdate(targetDate = null) {
    if (targetDate) {
      console.log(`🔄 Manual current affairs update triggered for date: ${targetDate}...`);
      // Clear existing data first for manual updates
      const db = await mongoService.connect();
      await db.collection('currentAffairs').deleteMany({ date: targetDate });
      console.log(`🗑️ Cleared existing data for ${targetDate}`);
      return this.scrapeAffairsForDate(targetDate);
    } else {
      const today = new Date().toISOString().split('T')[0];
      console.log(`🔄 Manual current affairs update triggered for today: ${today}...`);
      // Clear existing data first for manual updates
      const db = await mongoService.connect();
      await db.collection('currentAffairs').deleteMany({ date: today });
      console.log(`🗑️ Cleared existing data for ${today}`);
      return this.scrapeTodaysAffairs();
    }
  }
}

module.exports = new DailyCurrentAffairsService();
