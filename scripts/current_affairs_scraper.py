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
    
    def is_valid_news_url(self, url, title):
        """Check if URL and title represent actual news content"""
        # Exclude non-news URLs - much more comprehensive
        exclude_patterns = [
            '/quiz', '/test', '/mcq', '/practice', '/login', '/register', 
            '/contact', '/about', '/terms', '/privacy', '/sitemap',
            '/category/', '/tag/', '/author/', '/page/', '/wp-',
            'javascript:', 'mailto:', '#', '/feed', '/rss', '/archives',
            '/pdf', '/download', '/subscribe', '/cart', 'add-to-cart',
            '/wp-content', '/wp-admin', '/admin', '/user'
        ]
        
        for pattern in exclude_patterns:
            if pattern in url.lower():
                return False
        
        # Exclude non-news titles - much more comprehensive
        exclude_titles = [
            'register', 'login', 'sign up', 'contact us', 'about us',
            'privacy policy', 'terms', 'sitemap', 'categories', 'archives',
            'home', 'menu', 'search', 'subscribe', 'follow', 'share',
            'current affairs quiz', 'daily current affairs quiz', 'gk questions',
            'general knowledge', 'previous months quiz', 'current affairs today',
            'mcqs pdf', 'add to cart', 'view all', 'leave a reply', 'cancel reply',
            'your email address', 'required fields', 'comment', 'name', 'email'
        ]
        
        title_lower = title.lower().strip()
        
        # Direct exclusions
        for exclude in exclude_titles:
            if exclude in title_lower:
                return False
        
        # Must be a meaningful news title
        if (len(title) < 25 or  # Increased minimum length
            title_lower.startswith(('click', 'read more', 'view', 'see', 'get', 'download', 'buy')) or
            title_lower.endswith(('quiz', 'questions', 'mcqs', 'pdf', 'test', 'practice')) or
            'gktoday' in title_lower or
            any(char.isdigit() for char in title) and 'rs.' in title_lower):  # Price indicators
            return False
        
        # Must contain actual news keywords
        news_indicators = [
            'government', 'policy', 'minister', 'parliament', 'court', 'india',
            'launches', 'announces', 'signs', 'approves', 'passes', 'introduces',
            'international', 'economy', 'economic', 'growth', 'budget', 'scheme',
            'mission', 'project', 'summit', 'agreement', 'treaty', 'bill'
        ]
        
        has_news_indicator = any(indicator in title_lower for indicator in news_indicators)
        if not has_news_indicator:
            return False
            
        return True
    
    def is_valid_news_content(self, content):
        """Validate that content is actually news, not generic site content"""
        if not content or len(content) < 100:
            return False
        
        content_lower = content.lower()
        
        # Exclude generic site content
        exclude_content = [
            'gktodays current affairs today section provides',
            'gktodays daily current affairs quiz',
            'below is the archive of topic wise',
            'username or email address required',
            'your email address will not be published',
            'required fields are marked',
            'add to cart',
            'pdf compilation',
            'multiple choice (mcqs)',
            'objective current affairs questions',
            'general knowledge test quiz'
        ]
        
        for exclude in exclude_content:
            if exclude in content_lower:
                return False
        
        # Must contain actual news content indicators
        news_content_indicators = [
            'announced', 'launched', 'signed', 'approved', 'passed',
            'minister', 'government', 'parliament', 'court', 'policy',
            'international', 'agreement', 'treaty', 'summit', 'meeting'
        ]
        
        has_news_content = any(indicator in content_lower for indicator in news_content_indicators)
        return has_news_content
    
    def extract_article_content(self, soup, url):
        """Extract main article content using multiple strategies"""
        content_text = ""
        
        # Strategy 1: Look for main article content containers
        article_containers = [
            soup.find('div', class_=re.compile(r'entry-content|post-content|article-content|main-content|content-area', re.I)),
            soup.find('article'),
            soup.find('div', {'class': re.compile(r'post-body|article-body|story-body', re.I)}),
            soup.find('div', {'id': re.compile(r'content|post|main|article', re.I)})
        ]
        
        for container in article_containers:
            if container:
                # Get paragraphs from the container
                paragraphs = container.find_all('p')
                if len(paragraphs) >= 2:  # Must have at least 2 paragraphs to be substantial
                    content_parts = []
                    for p in paragraphs[:5]:  # Take first 5 paragraphs max
                        p_text = self.clean_text(p.get_text())
                        # Filter out common non-content paragraphs
                        if (len(p_text) > 50 and 
                            not p_text.lower().startswith(('share', 'follow', 'subscribe', 'click', 'read more', 'advertisement'))):
                            content_parts.append(p_text)
                    
                    if len(content_parts) >= 2:  # Need at least 2 substantial paragraphs
                        content_text = " ".join(content_parts)
                        break
        
        # Strategy 2: If no container found, look for consecutive paragraphs
        if not content_text:
            all_paragraphs = soup.find_all('p')
            content_parts = []
            for p in all_paragraphs:
                p_text = self.clean_text(p.get_text())
                if (len(p_text) > 50 and 
                    not any(word in p_text.lower() for word in ['advertisement', 'sponsored', 'follow us', 'subscribe', 'share this'])):
                    content_parts.append(p_text)
                    if len(content_parts) >= 3:  # Got enough content
                        break
            
            if len(content_parts) >= 2:
                content_text = " ".join(content_parts)
        
        return content_text
    
    def scrape_gktoday_current_affairs(self):
        """Scrape high-quality current affairs from GKToday with smart filtering"""
        logger.info("Scraping current affairs from GKToday with enhanced filtering...")
        
        current_affairs = []
        
        # Try multiple GKToday sections for better coverage
        base_urls = [
            "https://www.gktoday.in/current-affairs/",
            "https://www.gktoday.in/current-affairs-2025/",
            "https://www.gktoday.in/2025/06/"  # Current month
        ]
        
        all_article_links = []
        
        for base_url in base_urls:
            try:
                response = self.session.get(base_url, timeout=30)
                if response.status_code != 200:
                    logger.warning(f"Failed to fetch {base_url}: {response.status_code}")
                    continue
                    
                soup = BeautifulSoup(response.content, 'html.parser')
                logger.info(f"✅ Successfully fetched {base_url}")
                
                # Find article links with smart filtering
                links = soup.find_all('a', href=True)
                logger.info(f"Found {len(links)} total links on {base_url}")
                
                for link in links:
                    href = link.get('href')
                    title_text = self.clean_text(link.get_text())
                    
                    if (href and 
                        href.startswith('https://www.gktoday.in/') and
                        self.is_valid_news_url(href, title_text) and
                        title_text not in [item[1] for item in all_article_links]):
                        
                        all_article_links.append((href, title_text))
                
                time.sleep(2)  # Be respectful between pages
                
            except Exception as e:
                logger.warning(f"Error fetching {base_url}: {str(e)}")
                continue
        
        logger.info(f"Found {len(all_article_links)} valid article links after filtering")
        
        # Process articles to extract high-quality content
        processed_urls = set()
        
        for article_url, article_title in all_article_links[:25]:  # Process up to 25 articles
            if article_url in processed_urls:
                continue
            processed_urls.add(article_url)
            
            try:
                time.sleep(1)  # Be respectful
                article_response = self.session.get(article_url, timeout=20)
                
                if article_response.status_code == 200:
                    article_soup = BeautifulSoup(article_response.content, 'html.parser')
                    
                    # Extract main article content
                    content_text = self.extract_article_content(article_soup, article_url)
                    
                    # Only accept high-quality content that passes all validation
                    if (content_text and 
                        len(content_text) > 150 and 
                        self.is_valid_news_content(content_text)):  # Added content validation
                        
                        category = self.categorize_current_affair(article_title + " " + content_text)
                        
                        # Try to extract actual publication date
                        pub_date = self.extract_publication_date(article_soup)
                        if not pub_date:
                            # Spread dates across last week if no date found
                            days_offset = len(current_affairs) % 7
                            pub_date = datetime.now() - timedelta(days=days_offset)
                        
                        # Determine importance based on keywords and content
                        importance = self.determine_importance(article_title, content_text)
                        
                        current_affairs.append({
                            "id": self.generate_id(article_title + str(len(current_affairs))),
                            "title": article_title,
                            "content": content_text,
                            "category": category,
                            "source": "GKToday",
                            "sourceUrl": article_url,
                            "datePublished": pub_date.isoformat(),
                            "importance": importance
                        })
                        logger.info(f"✅ Scraped quality article: {article_title[:60]}...")
                        
                        # Stop when we have enough quality articles
                        if len(current_affairs) >= 20:
                            break
                            
            except Exception as e:
                logger.debug(f"Error processing article {article_url}: {str(e)}")
                continue
        
        logger.info(f"✅ Scraped {len(current_affairs)} high-quality current affairs from GKToday")
        return current_affairs
    
    def extract_publication_date(self, soup):
        """Try to extract actual publication date from article"""
        try:
            # Look for time tags
            time_tags = soup.find_all('time')
            for time_tag in time_tags:
                datetime_attr = time_tag.get('datetime')
                if datetime_attr:
                    return datetime.fromisoformat(datetime_attr.replace('Z', '+00:00'))
            
            # Look for date patterns in text
            date_patterns = [
                r'published.{0,20}(\d{1,2}[-/]\d{1,2}[-/]\d{4})',
                r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})',
                r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})'
            ]
            
            page_text = soup.get_text()
            for pattern in date_patterns:
                match = re.search(pattern, page_text, re.I)
                if match:
                    try:
                        date_str = match.group(1)
                        # Try to parse the date
                        for fmt in ['%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d', '%Y/%m/%d']:
                            try:
                                return datetime.strptime(date_str, fmt)
                            except ValueError:
                                continue
                    except:
                        continue
            
        except Exception as e:
            logger.debug(f"Error extracting publication date: {str(e)}")
        
        return None
    
    def determine_importance(self, title, content):
        """Determine importance level based on content analysis"""
        high_importance_keywords = [
            'government', 'policy', 'budget', 'international', 'breaking',
            'major', 'supreme court', 'parliament', 'election', 'gdp',
            'economic', 'minister', 'president', 'prime minister'
        ]
        
        text_to_analyze = (title + " " + content).lower()
        
        high_count = sum(1 for keyword in high_importance_keywords if keyword in text_to_analyze)
        
        if high_count >= 2:
            return "high"
        elif high_count >= 1:
            return "medium"
        else:
            return "medium"  # Default to medium for current affairs content
    
    def generate_additional_sample_affairs(self):
        """Generate additional sample current affairs content"""
        logger.info("Generating additional sample current affairs...")
        
        additional_samples = [
            {
                "id": self.generate_id("Central Vista"),
                "title": "Central Vista Project Phase 2 Inaugurated in New Delhi",
                "content": "The second phase of the Central Vista redevelopment project has been inaugurated, featuring new government buildings and improved infrastructure. The project aims to create a modern administrative complex while preserving the heritage value of the area.",
                "category": "Government & Policy",
                "source": "Sample News",
                "datePublished": datetime.now().isoformat(),
                "importance": "medium"
            },
            {
                "id": self.generate_id("Renewable Target"),
                "title": "India Achieves 175 GW Renewable Energy Target Ahead of Schedule",
                "content": "India has successfully achieved its 175 GW renewable energy target six months ahead of the planned deadline. The achievement includes significant contributions from solar and wind energy projects across various states.",
                "category": "Environment",
                "source": "Sample News",
                "datePublished": datetime.now().isoformat(),
                "importance": "high"
            },
            {
                "id": self.generate_id("Digital Payment"),
                "title": "UPI Transactions Cross 10 Billion Monthly Milestone",
                "content": "Unified Payments Interface (UPI) transactions have crossed the 10 billion monthly transaction mark, reflecting the rapid digitization of India's payment ecosystem. The growth demonstrates increasing adoption of digital payment methods.",
                "category": "Economy & Finance",
                "source": "Sample News",
                "datePublished": datetime.now().isoformat(),
                "importance": "medium"
            },
            {
                "id": self.generate_id("Healthcare Initiative"),
                "title": "Ayushman Bharat Scheme Covers 5 Crore Families",
                "content": "The Ayushman Bharat scheme has successfully provided healthcare coverage to over 5 crore families across India. The scheme continues to expand its reach to ensure universal health coverage for economically vulnerable populations.",
                "category": "Government & Policy",
                "source": "Sample News",
                "datePublished": datetime.now().isoformat(),
                "importance": "high"
            },
            {
                "id": self.generate_id("Infrastructure Development"),
                "title": "Golden Quadrilateral Highway Project Sees Major Upgrades",
                "content": "The Golden Quadrilateral highway network has received significant infrastructure upgrades, improving connectivity between major metropolitan cities. The enhancements include smart traffic management systems and enhanced safety features.",
                "category": "Government & Policy",
                "source": "Sample News",
                "datePublished": datetime.now().isoformat(),
                "importance": "medium"
            }
        ]
        
        logger.info(f"Generated {len(additional_samples)} additional sample affairs")
        return additional_samples
    
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
    
    def generate_sample_current_affairs(self):
        """Generate sample current affairs when scraping fails"""
        logger.info("Generating sample current affairs as fallback...")
        
        sample_affairs = [
            {
                "id": self.generate_id("Digital India Mission"),
                "title": "Government Launches Next Phase of Digital India Mission",
                "content": "The Government of India has announced the launch of the next phase of Digital India Mission with a focus on AI integration and digital literacy. The initiative aims to bridge the digital divide and enhance citizen services through technology.",
                "category": "Government & Policy",
                "source": "Sample News",
                "datePublished": datetime.now().isoformat(),
                "importance": "high"
            },
            {
                "id": self.generate_id("Climate Summit"),
                "title": "India Hosts International Climate Action Summit",
                "content": "India is hosting a major international climate action summit focusing on renewable energy and sustainable development. Leaders from over 50 countries are participating to discuss climate change mitigation strategies.",
                "category": "International Affairs",
                "source": "Sample News",
                "datePublished": datetime.now().isoformat(),
                "importance": "high"
            },
            {
                "id": self.generate_id("Economic Growth"),
                "title": "India's GDP Growth Exceeds Expectations in Q4",
                "content": "India's Gross Domestic Product (GDP) has shown robust growth in the fourth quarter, exceeding economists' expectations. The growth is attributed to strong performance in manufacturing and services sectors.",
                "category": "Economy & Finance",
                "source": "Sample News",
                "datePublished": datetime.now().isoformat(),
                "importance": "medium"
            },
            {
                "id": self.generate_id("Space Mission"),
                "title": "ISRO Successfully Launches Advanced Earth Observation Satellite",
                "content": "The Indian Space Research Organisation (ISRO) has successfully launched an advanced earth observation satellite that will enhance weather forecasting and disaster management capabilities.",
                "category": "Science & Technology",
                "source": "Sample News",
                "datePublished": datetime.now().isoformat(),
                "importance": "high"
            },
            {
                "id": self.generate_id("Education Policy"),
                "title": "New Education Policy Implementation Shows Positive Results",
                "content": "The implementation of the New Education Policy (NEP) 2020 is showing positive results with increased enrollment in vocational courses and improved learning outcomes in government schools.",
                "category": "Government & Policy",
                "source": "Sample News",
                "datePublished": datetime.now().isoformat(),
                "importance": "medium"
            }
        ]
        
        logger.info(f"Generated {len(sample_affairs)} sample current affairs")
        return sample_affairs
    
    def scrape_all_current_affairs(self):
        """Scrape ONLY real current affairs from working sources - NO SAMPLE DATA"""
        logger.info("Starting current affairs scraping from real sources only...")
        
        # Only scrape real data from GKToday - NO SAMPLE DATA AT ALL
        gktoday_affairs = self.scrape_gktoday_current_affairs()
        
        if not gktoday_affairs:
            logger.error("❌ No real current affairs data could be scraped!")
            logger.error("❌ Aborting - will not use any sample data")
            return False
        
        # Remove duplicates based on title similarity
        unique_affairs = self.remove_duplicates(gktoday_affairs)
        
        # Sort by importance and date
        unique_affairs.sort(key=lambda x: (x['importance'] == 'high', x['datePublished']), reverse=True)
        
        # Update data structure with ONLY real data
        self.current_affairs_data["currentAffairs"] = unique_affairs
        self.current_affairs_data["sources"] = ["GKToday"]
        self.current_affairs_data["categories"] = list(set([affair['category'] for affair in unique_affairs]))
        
        logger.info(f"✅ {len(unique_affairs)} REAL current affairs collected from GKToday")
        logger.info(f"✅ NO sample data used - 100% real content")
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
    
    def load_existing_current_affairs(self, output_file='../data/current_affairs.json'):
        """Load existing current affairs data from file"""
        output_path = os.path.join(os.path.dirname(__file__), output_file)
        
        try:
            if os.path.exists(output_path):
                with open(output_path, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
                logger.info(f"Loaded {len(existing_data.get('currentAffairs', []))} existing current affairs")
                return existing_data
            else:
                logger.info("No existing current affairs file found, starting fresh")
                return None
        except Exception as e:
            logger.error(f"Error loading existing current affairs data: {str(e)}")
            return None
    
    def merge_with_existing_data(self, new_affairs, existing_data):
        """Merge new current affairs with existing data, keeping last 6 weeks"""
        if not existing_data:
            return new_affairs
        
        existing_affairs = existing_data.get('currentAffairs', [])
        logger.info(f"Merging {len(new_affairs)} new affairs with {len(existing_affairs)} existing affairs")
        
        # Combine all affairs
        all_affairs = new_affairs + existing_affairs
        
        # Remove duplicates based on title similarity
        unique_affairs = self.remove_duplicates(all_affairs)
        
        # Sort by date (newest first)
        unique_affairs.sort(key=lambda x: x.get('datePublished', ''), reverse=True)
        
        # Keep only last 6 weeks of data (approximately 100-150 items)
        cutoff_date = datetime.now() - timedelta(weeks=6)
        cutoff_str = cutoff_date.isoformat()
        
        filtered_affairs = []
        for affair in unique_affairs:
            affair_date = affair.get('datePublished', '')
            if affair_date >= cutoff_str or len(filtered_affairs) < 50:  # Always keep at least 50 items
                filtered_affairs.append(affair)
            if len(filtered_affairs) >= 200:  # Max 200 items total
                break
        
        logger.info(f"After merging and filtering: {len(filtered_affairs)} total affairs (last 6 weeks)")
        return filtered_affairs
    
    def save_current_affairs(self, output_file='../data/current_affairs.json'):
        """Save current affairs data to file, merging with existing data"""
        output_path = os.path.join(os.path.dirname(__file__), output_file)
        
        try:
            # Load existing data
            existing_data = self.load_existing_current_affairs(output_file)
            
            # Merge new data with existing
            new_affairs = self.current_affairs_data["currentAffairs"]
            merged_affairs = self.merge_with_existing_data(new_affairs, existing_data)
            
            # Update the data structure with merged content
            self.current_affairs_data["currentAffairs"] = merged_affairs
            
            # Update metadata
            if existing_data:
                # Combine sources
                existing_sources = existing_data.get('sources', [])
                all_sources = list(set(self.current_affairs_data['sources'] + existing_sources))
                self.current_affairs_data['sources'] = all_sources
                
                # Combine categories
                existing_categories = existing_data.get('categories', [])
                all_categories = list(set(self.current_affairs_data['categories'] + existing_categories))
                self.current_affairs_data['categories'] = all_categories
            
            # Add weekly update metadata
            self.current_affairs_data['weeklyUpdate'] = {
                'lastWeeklyUpdate': datetime.now().isoformat(),
                'totalAffairs': len(merged_affairs),
                'weeksOfData': 6,
                'updateFrequency': 'Weekly - Every Sunday'
            }
            
            # Save merged data
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(self.current_affairs_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Current affairs data saved to {output_path}")
            logger.info(f"Total affairs after merge: {len(merged_affairs)}")
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
