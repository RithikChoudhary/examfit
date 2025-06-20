#!/usr/bin/env python3
"""
Test Google News scraper functionality
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from GoogleNews import GoogleNews
import json
from datetime import datetime

def test_google_news():
    print("🔍 Testing Google News library...")
    
    try:
        # Initialize GoogleNews
        googlenews = GoogleNews(lang='en', region='IN')
        googlenews.set_time_range('7d')
        googlenews.set_encode('utf-8')
        
        print("✅ GoogleNews initialized successfully")
        
        # Test a simple search
        search_term = "India government policy"
        print(f"🔍 Searching for: {search_term}")
        
        googlenews.search(search_term)
        results = googlenews.results()
        
        print(f"📰 Found {len(results)} results")
        
        if results:
            print("\n📋 Sample results:")
            for i, article in enumerate(results[:3]):
                print(f"\n{i+1}. Title: {article.get('title', 'No title')}")
                print(f"   Media: {article.get('media', 'No media')}")
                print(f"   Date: {article.get('date', 'No date')}")
                print(f"   Desc: {article.get('desc', 'No description')[:100]}...")
        else:
            print("❌ No results found")
            
        return len(results) > 0
        
    except Exception as e:
        print(f"❌ Error testing Google News: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_google_news()
    if success:
        print("\n✅ Google News test successful!")
    else:
        print("\n❌ Google News test failed!")
        sys.exit(1)
