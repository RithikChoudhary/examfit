#!/usr/bin/env python3
"""
ExamFit Data Scraper
Automatically scrapes exam questions from free educational websites
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
from datetime import datetime
import os
import hashlib
from urllib.parse import urljoin, urlparse
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ExamDataScraper:
    def __init__(self, config_file='config.json'):
        self.config = self.load_config(config_file)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.scraped_data = {
            "exams": [],
            "lastUpdated": datetime.now().isoformat(),
            "sources": []
        }
        
    def load_config(self, config_file):
        """Load scraping configuration"""
        config_path = os.path.join(os.path.dirname(__file__), config_file)
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"Config file {config_file} not found")
            return {"sources": []}
    
    def generate_question_id(self, question_text):
        """Generate unique question ID"""
        hash_object = hashlib.md5(question_text.encode())
        return f"q{int(time.time())}-{hash_object.hexdigest()[:8]}"
    
    def clean_text(self, text):
        """Clean and normalize text"""
        if not text:
            return ""
        # Remove extra whitespace and newlines
        text = re.sub(r'\s+', ' ', text.strip())
        # Remove special characters that might break JSON
        text = re.sub(r'[^\w\s\-.,;:()\'\"?!]', '', text)
        return text
    
    def scrape_jagran_josh(self, url):
        """Scrape questions from Jagran Josh"""
        logger.info(f"Scraping Jagran Josh: {url}")
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            questions = []
            
            # Look for question containers (adapt based on actual HTML structure)
            question_blocks = soup.find_all(['div', 'article'], class_=re.compile(r'question|quiz|mcq', re.I))
            
            for block in question_blocks:
                question_text = ""
                options = []
                correct_answer = ""
                
                # Extract question text
                question_elem = block.find(['h3', 'h4', 'p'], class_=re.compile(r'question|title', re.I))
                if question_elem:
                    question_text = self.clean_text(question_elem.get_text())
                
                # Extract options
                option_elems = block.find_all(['li', 'div'], class_=re.compile(r'option|choice', re.I))
                for i, option in enumerate(option_elems[:4]):  # Limit to 4 options
                    option_text = self.clean_text(option.get_text())
                    if option_text:
                        options.append({
                            "optionId": chr(97 + i),  # a, b, c, d
                            "text": option_text
                        })
                
                # Extract correct answer (if available)
                answer_elem = block.find(['span', 'div'], class_=re.compile(r'answer|correct', re.I))
                if answer_elem:
                    answer_text = answer_elem.get_text().lower()
                    # Try to extract option letter
                    answer_match = re.search(r'[abcd]', answer_text)
                    if answer_match:
                        correct_answer = answer_match.group()
                
                if question_text and len(options) >= 2:
                    questions.append({
                        "questionId": self.generate_question_id(question_text),
                        "question": question_text,
                        "options": options,
                        "correctOption": correct_answer or "a",  # Default if not found
                        "explanation": "",
                        "source": "Jagran Josh",
                        "difficulty": "medium",
                        "tags": ["general-knowledge"]
                    })
            
            logger.info(f"Scraped {len(questions)} questions from Jagran Josh")
            return questions
            
        except Exception as e:
            logger.error(f"Error scraping Jagran Josh: {str(e)}")
            return []
    
    def scrape_gktoday(self, url):
        """Scrape questions from GKToday"""
        logger.info(f"Scraping GKToday: {url}")
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            questions = []
            
            # Look for MCQ sections
            mcq_sections = soup.find_all(['div', 'section'], class_=re.compile(r'mcq|question', re.I))
            
            for section in mcq_sections:
                # Extract all text and try to parse Q&A format
                text_content = section.get_text()
                
                # Look for numbered questions
                question_pattern = r'(\d+\.?\s*)([^?]+\?)'
                matches = re.finditer(question_pattern, text_content)
                
                for match in matches:
                    question_text = self.clean_text(match.group(2))
                    
                    # Look for options after this question
                    start_pos = match.end()
                    next_match = re.search(r'\d+\.', text_content[start_pos:])
                    end_pos = next_match.start() + start_pos if next_match else len(text_content)
                    
                    options_text = text_content[start_pos:end_pos]
                    
                    # Extract options (a), (b), (c), (d) format
                    option_pattern = r'\([abcd]\)\s*([^(]+?)(?=\([abcd]\)|$)'
                    option_matches = re.finditer(option_pattern, options_text, re.IGNORECASE)
                    
                    options = []
                    for opt_match in option_matches:
                        opt_text = self.clean_text(opt_match.group(1))
                        if opt_text:
                            options.append({
                                "optionId": opt_match.group(0)[1].lower(),
                                "text": opt_text
                            })
                    
                    if question_text and len(options) >= 2:
                        questions.append({
                            "questionId": self.generate_question_id(question_text),
                            "question": question_text,
                            "options": options,
                            "correctOption": "a",  # Default, would need answer key
                            "explanation": "",
                            "source": "GKToday",
                            "difficulty": "medium",
                            "tags": ["current-affairs", "general-knowledge"]
                        })
            
            logger.info(f"Scraped {len(questions)} questions from GKToday")
            return questions
            
        except Exception as e:
            logger.error(f"Error scraping GKToday: {str(e)}")
            return []
    
    def scrape_affairs_cloud(self, url):
        """Scrape questions from AffairsCloud"""
        logger.info(f"Scraping AffairsCloud: {url}")
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            questions = []
            
            # Look for quiz/question sections
            content_div = soup.find('div', class_=re.compile(r'content|post|article', re.I))
            
            if content_div:
                # Extract questions in various formats
                paragraphs = content_div.find_all('p')
                current_question = ""
                current_options = []
                
                for p in paragraphs:
                    text = p.get_text().strip()
                    
                    # Check if this is a question (ends with ?)
                    if text.endswith('?'):
                        # Save previous question if complete
                        if current_question and len(current_options) >= 2:
                            questions.append({
                                "questionId": self.generate_question_id(current_question),
                                "question": self.clean_text(current_question),
                                "options": current_options,
                                "correctOption": "a",
                                "explanation": "",
                                "source": "AffairsCloud",
                                "difficulty": "medium",
                                "tags": ["current-affairs"]
                            })
                        
                        # Start new question
                        current_question = text
                        current_options = []
                    
                    # Check if this is an option
                    elif re.match(r'^[abcd][\).]\s*', text, re.IGNORECASE):
                        option_letter = text[0].lower()
                        option_text = re.sub(r'^[abcd][\).]\s*', '', text, flags=re.IGNORECASE)
                        current_options.append({
                            "optionId": option_letter,
                            "text": self.clean_text(option_text)
                        })
                
                # Don't forget the last question
                if current_question and len(current_options) >= 2:
                    questions.append({
                        "questionId": self.generate_question_id(current_question),
                        "question": self.clean_text(current_question),
                        "options": current_options,
                        "correctOption": "a",
                        "explanation": "",
                        "source": "AffairsCloud", 
                        "difficulty": "medium",
                        "tags": ["current-affairs"]
                    })
            
            logger.info(f"Scraped {len(questions)} questions from AffairsCloud")
            return questions
            
        except Exception as e:
            logger.error(f"Error scraping AffairsCloud: {str(e)}")
            return []
    
    def scrape_all_sources(self):
        """Scrape all configured sources"""
        all_questions = []
        
        for source in self.config.get('sources', []):
            try:
                scraper_method = getattr(self, f"scrape_{source['name'].lower().replace(' ', '_')}")
                for url in source['urls']:
                    questions = scraper_method(url)
                    all_questions.extend(questions)
                    time.sleep(2)  # Be respectful, wait between requests
            except AttributeError:
                logger.warning(f"No scraper method found for source: {source['name']}")
            except Exception as e:
                logger.error(f"Error scraping source {source['name']}: {str(e)}")
        
        return all_questions
    
    def organize_by_exam_structure(self, questions):
        """Organize questions into exam/subject structure"""
        exams = {}
        
        for question in questions:
            tags = question.get('tags', ['general'])
            
            # Determine exam type based on tags and source
            if any(tag in ['current-affairs', 'general-knowledge'] for tag in tags):
                exam_id = 'upsc'
                exam_name = 'Union Public Service Commission(CSE)'
                subject_id = 'general-studies'
                subject_name = 'General Studies'
            else:
                exam_id = 'general'
                exam_name = 'General Knowledge'
                subject_id = 'gk'
                subject_name = 'General Knowledge'
            
            # Initialize exam structure
            if exam_id not in exams:
                exams[exam_id] = {
                    "examId": exam_id,
                    "examName": exam_name,
                    "subjects": {}
                }
            
            # Initialize subject structure
            if subject_id not in exams[exam_id]["subjects"]:
                exams[exam_id]["subjects"][subject_id] = {
                    "subjectId": subject_id,
                    "subjectName": subject_name,
                    "questionPapers": {}
                }
            
            # Group by month for question papers
            current_month = datetime.now().strftime("%Y-%m")
            paper_id = f"auto-{current_month}"
            paper_name = f"Auto-Updated {datetime.now().strftime('%B %Y')}"
            
            if paper_id not in exams[exam_id]["subjects"][subject_id]["questionPapers"]:
                exams[exam_id]["subjects"][subject_id]["questionPapers"][paper_id] = {
                    "questionPaperId": paper_id,
                    "questionPaperName": paper_name,
                    "section": "Auto-Generated",
                    "questions": []
                }
            
            # Add question to paper
            exams[exam_id]["subjects"][subject_id]["questionPapers"][paper_id]["questions"].append(question)
        
        # Convert to list format
        result_exams = []
        for exam in exams.values():
            exam_subjects = []
            for subject in exam["subjects"].values():
                subject_papers = list(subject["questionPapers"].values())
                exam_subjects.append({
                    "subjectId": subject["subjectId"],
                    "subjectName": subject["subjectName"],
                    "questionPapers": subject_papers
                })
            
            result_exams.append({
                "examId": exam["examId"],
                "examName": exam["examName"],
                "subjects": exam_subjects
            })
        
        return result_exams
    
    def run_scraping(self):
        """Main scraping process"""
        logger.info("Starting exam data scraping...")
        
        # Scrape all sources
        questions = self.scrape_all_sources()
        logger.info(f"Total questions scraped: {len(questions)}")
        
        if not questions:
            logger.warning("No questions were scraped")
            return False
        
        # Organize into exam structure
        organized_exams = self.organize_by_exam_structure(questions)
        
        # Update scraped data
        self.scraped_data["exams"] = organized_exams
        self.scraped_data["sources"] = [source["name"] for source in self.config.get("sources", [])]
        
        logger.info("Scraping completed successfully")
        return True
    
    def save_data(self, output_file='../data/data.json'):
        """Save scraped data using the data merger"""
        try:
            from data_merger import DataMerger
            
            # Initialize merger and merge data
            merger = DataMerger(output_file)
            merged_data = merger.merge_data(self.scraped_data)
            
            # Save merged data
            if merger.save_merged_data(merged_data):
                logger.info("Data successfully merged and saved")
                return True
            else:
                logger.error("Failed to save merged data")
                return False
                
        except ImportError:
            # Fallback to direct save if merger not available
            logger.warning("Data merger not available, saving directly")
            output_path = os.path.join(os.path.dirname(__file__), output_file)
            
            try:
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(self.scraped_data, f, indent=2, ensure_ascii=False)
                logger.info(f"Data saved to {output_path}")
                return True
            except Exception as e:
                logger.error(f"Error saving data: {str(e)}")
                return False
        except Exception as e:
            logger.error(f"Error in data merger: {str(e)}")
            return False

if __name__ == "__main__":
    scraper = ExamDataScraper()
    
    if scraper.run_scraping():
        if scraper.save_data():
            print("✅ Scraping and data merge completed successfully!")
        else:
            print("❌ Data saving failed!")
            exit(1)
    else:
        print("❌ Scraping failed!")
        exit(1)
