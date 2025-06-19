#!/usr/bin/env python3
"""
Current Affairs Scraper for ExamFit
Specialized scraper for current affairs from multiple sources
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
from datetime import datetime, timedelta
import os
import hashlib
import logging

logger = logging.getLogger(__name__)

class CurrentAffairsScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.current_affairs_data = {
            "currentAffairs": [],
            "lastUpdated": datetime.now().isoformat(),
            "sources": [],
            "categories": []
        }
        
    def generate_id(self, text):
        """Generate unique ID for current affairs items"""
        hash_object = hashlib.md5(text.encode())
        return f"ca{int(time.time())}-{hash_object.hexdigest()[:8]}"
    
    def clean_text(self, text):
        """Clean and normalize text"""
        if not text:
            return ""
        text = re.sub(r'\s+', ' ', text.strip())
        text = re.sub(r'[^\w\s\-.,;:()\'\"?!\u0900-\u097F]', '', text)
        return text
    
    def scrape_gktoday_current_affairs(self):
        """Scrape current affairs from GKToday"""
        logger.info("Scraping current affairs from GKToday...")
        
        current_affairs = []
        urls = [
            "https://www.gktoday.in/current-affairs/",
            "https://www.gktoday.in/current-affairs/monthly-current-affairs/",
            "https://www.gktoday.in/current-affairs/daily-current-affairs/"
        ]
        
        for url in urls:
            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Look for current affairs articles
                articles = soup.find_all(['article', 'div'], class_=re.compile(r'post|article|content', re.I))
                
                for article in articles[:20]:  # Limit to 20 most recent
                    title_elem = article.find(['h1', 'h2', 'h3', 'h4'], class_=re.compile(r'title|headline', re.I))
                    if not title_elem:
                        title_elem = article.find(['h1', 'h2', 'h3', 'h4'])
                    
                    content_elem = article.find(['p', 'div'], class_=re.compile(r'content|excerpt|summary', re.I))
                    if not content_elem:
                        content_elem = article.find('p')
                    
                    date_elem = article.find(['time', 'span', 'div'], class_=re.compile(r'date|time', re.I))
                    
                    if title_elem and content_elem:
                        title = self.clean_text(title_elem.get_text())
                        content = self.clean_text(content_elem.get_text())
                        
                        # Extract date
                        date_published = datetime.now().isoformat()
                        if date_elem:
                            date_text = date_elem.get_text()
                            # Try to parse date (you can enhance this)
                            try:
                                # Simple date parsing - enhance as needed
                                pass
                            except:
                                pass
                        
                        # Categorize based on content
                        category = self.categorize_current_affair(title + " " + content)
                        
                        if len(title) > 10 and len(content) > 20:
                            current_affairs.append({
                                "id": self.generate_id(title),
                                "title": title,
                                "content": content,
                                "category": category,
                                "source": "GKToday",
                                "datePublished": date_published,
                                "importance": "high" if any(word in title.lower() for word in ['government', 'policy', 'scheme', 'international']) else "medium"
                            })
                
                time.sleep(2)  # Be respectful
                
            except Exception as e:
                logger.error(f"Error scraping GKToday current affairs: {str(e)}")
        
        logger.info(f"Scraped {len(current_affairs)} current affairs from GKToday")
        return current_affairs
    
    def scrape_affairs_cloud_current_affairs(self):
        """Scrape current affairs from AffairsCloud"""
        logger.info("Scraping current affairs from AffairsCloud...")
        
        current_affairs = []
        urls = [
            "https://www.affairscloud.com/current-affairs/",
            "https://www.affairscloud.com/current-affairs-quiz/",
            "https://www.affairscloud.com/today/"
        ]
        
        for url in urls:
            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Look for current affairs content
                articles = soup.find_all(['div', 'article'], class_=re.compile(r'post|item|card', re.I))
                
                for article in articles[:15]:
                    title_elem = article.find(['h1', 'h2', 'h3'], class_=re.compile(r'title|heading', re.I))
                    if not title_elem:
                        title_elem = article.find(['h1', 'h2', 'h3'])
                    
                    content_elem = article.find(['p', 'div'], class_=re.compile(r'excerpt|content|summary', re.I))
                    if not content_elem:
                        content_elem = article.find('p')
                    
                    if title_elem and content_elem:
                        title = self.clean_text(title_elem.get_text())
                        content = self.clean_text(content_elem.get_text())
                        category = self.categorize_current_affair(title + " " + content)
                        
                        if len(title) > 10 and len(content) > 20:
                            current_affairs.append({
                                "id": self.generate_id(title),
                                "title": title,
                                "content": content,
                                "category": category,
                                "source": "AffairsCloud",
                                "datePublished": datetime.now().isoformat(),
                                "importance": "high" if any(word in title.lower() for word in ['breaking', 'important', 'major']) else "medium"
                            })
                
                time.sleep(2)
                
            except Exception as e:
                logger.error(f"Error scraping AffairsCloud current affairs: {str(e)}")
        
        logger.info(f"Scraped {len(current_affairs)} current affairs from AffairsCloud")
        return current_affairs
    
    def scrape_jagran_josh_current_affairs(self):
        """Scrape current affairs from Jagran Josh"""
        logger.info("Scraping current affairs from Jagran Josh...")
        
        current_affairs = []
        urls = [
            "https://www.jagranjosh.com/current-affairs",
            "https://www.jagranjosh.com/current-affairs/monthly-current-affairs",
            "https://www.jagranjosh.com/current-affairs/daily-current-affairs"
        ]
        
        for url in urls:
            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Look for current affairs content
                articles = soup.find_all(['div', 'li', 'article'], class_=re.compile(r'item|post|news', re.I))
                
                for article in articles[:15]:
                    title_elem = article.find(['a', 'h1', 'h2', 'h3'])
                    content_elem = article.find(['p', 'div', 'span'])
                    
                    if title_elem:
                        title = self.clean_text(title_elem.get_text())
                        content = ""
                        
                        if content_elem:
                            content = self.clean_text(content_elem.get_text())
                        
                        if not content or len(content) < 20:
                            content = f"Important current affair: {title}"
                        
                        category = self.categorize_current_affair(title + " " + content)
                        
                        if len(title) > 10:
                            current_affairs.append({
                                "id": self.generate_id(title),
                                "title": title,
                                "content": content,
                                "category": category,
                                "source": "Jagran Josh",
                                "datePublished": datetime.now().isoformat(),
                                "importance": "medium"
                            })
                
                time.sleep(2)
                
            except Exception as e:
                logger.error(f"Error scraping Jagran Josh current affairs: {str(e)}")
        
        logger.info(f"Scraped {len(current_affairs)} current affairs from Jagran Josh")
        return current_affairs
    
    def categorize_current_affair(self, text):
        """Categorize current affairs based on content"""
        text_lower = text.lower()
        
        if any(word in text_lower for word in ['government', 'ministry', 'policy', 'scheme', 'cabinet']):
            return 'Government & Policy'
        elif any(word in text_lower for word in ['international', 'world', 'country', 'foreign', 'global']):
            return 'International Affairs'
        elif any(word in text_lower for word in ['economy', 'economic', 'budget', 'finance', 'market', 'gdp']):
            return 'Economy & Finance'
        elif any(word in text_lower for word in ['technology', 'tech', 'digital', 'ai', 'internet', 'cyber']):
            return 'Science & Technology'
        elif any(word in text_lower for word in ['sports', 'olympic', 'cricket', 'football', 'player', 'match']):
            return 'Sports'
        elif any(word in text_lower for word in ['defence', 'military', 'army', 'navy', 'air force', 'security']):
            return 'Defence & Security'
        elif any(word in text_lower for word in ['environment', 'climate', 'pollution', 'green', 'renewable']):
            return 'Environment'
        elif any(word in text_lower for word in ['award', 'prize', 'honour', 'recognition', 'achievement']):
            return 'Awards & Honours'
        else:
            return 'General Affairs'
    
    def scrape_all_current_affairs(self):
        """Scrape current affairs from all sources"""
        logger.info("Starting current affairs scraping from all sources...")
        
        all_current_affairs = []
        
        # Scrape from all sources
        all_current_affairs.extend(self.scrape_gktoday_current_affairs())
        all_current_affairs.extend(self.scrape_affairs_cloud_current_affairs())
        all_current_affairs.extend(self.scrape_jagran_josh_current_affairs())
        
        # Remove duplicates based on title similarity
        unique_affairs = self.remove_duplicates(all_current_affairs)
        
        # Sort by importance and date
        unique_affairs.sort(key=lambda x: (x['importance'] == 'high', x['datePublished']), reverse=True)
        
        # Update data structure
        self.current_affairs_data["currentAffairs"] = unique_affairs[:50]  # Keep top 50
        self.current_affairs_data["sources"] = ["GKToday", "AffairsCloud", "Jagran Josh"]
        self.current_affairs_data["categories"] = list(set([affair['category'] for affair in unique_affairs]))
        
        logger.info(f"Total unique current affairs collected: {len(unique_affairs)}")
        return True
    
    def remove_duplicates(self, affairs_list):
        """Remove duplicate current affairs based on title similarity"""
        unique_affairs = []
        seen_titles = set()
        
        for affair in affairs_list:
            # Create a normalized title for comparison
            normalized_title = re.sub(r'[^\w\s]', '', affair['title'].lower())
            normalized_title = ' '.join(normalized_title.split())
            
            # Check if similar title already exists
            is_duplicate = False
            for seen_title in seen_titles:
                if self.calculate_similarity(normalized_title, seen_title) > 0.8:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique_affairs.append(affair)
                seen_titles.add(normalized_title)
        
        return unique_affairs
    
    def calculate_similarity(self, str1, str2):
        """Calculate similarity between two strings"""
        words1 = set(str1.split())
        words2 = set(str2.split())
        
        if not words1 or not words2:
            return 0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union)
    
    def save_current_affairs(self, output_file='../data/current_affairs.json'):
        """Save current affairs data to file"""
        output_path = os.path.join(os.path.dirname(__file__), output_file)
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(self.current_affairs_data, f, indent=2, ensure_ascii=False)
            logger.info(f"Current affairs data saved to {output_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving current affairs data: {str(e)}")
            return False

if __name__ == "__main__":
    scraper = CurrentAffairsScraper()
    
    if scraper.scrape_all_current_affairs():
        if scraper.save_current_affairs():
            print("✅ Current affairs scraping completed successfully!")
        else:
            print("❌ Failed to save current affairs data!")
            exit(1)
    else:
        print("❌ Current affairs scraping failed!")
        exit(1)
