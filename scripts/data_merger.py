#!/usr/bin/env python3
"""
Data Merger for ExamFit
Merges newly scraped data with existing data.json
"""

import json
import os
from datetime import datetime
import hashlib
import logging

logger = logging.getLogger(__name__)

class DataMerger:
    def __init__(self, existing_data_path='../data/data.json'):
        self.existing_data_path = os.path.join(os.path.dirname(__file__), existing_data_path)
        self.existing_data = self.load_existing_data()
        
    def load_existing_data(self):
        """Load existing data.json file"""
        try:
            with open(self.existing_data_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.info("No existing data file found, starting fresh")
            return {"exams": [], "lastUpdated": None}
        except Exception as e:
            logger.error(f"Error loading existing data: {str(e)}")
            return {"exams": [], "lastUpdated": None}
    
    def generate_question_hash(self, question):
        """Generate hash for question to check duplicates"""
        # Use question text and first option to create hash
        content = question.get('question', '') + question.get('options', [{}])[0].get('text', '')
        return hashlib.md5(content.encode()).hexdigest()
    
    def find_exam_by_id(self, exam_id, exams_list):
        """Find exam in list by ID"""
        for exam in exams_list:
            if exam.get('examId') == exam_id:
                return exam
        return None
    
    def find_subject_by_id(self, subject_id, subjects_list):
        """Find subject in list by ID"""
        for subject in subjects_list:
            if subject.get('subjectId') == subject_id:
                return subject
        return None
    
    def find_paper_by_id(self, paper_id, papers_list):
        """Find question paper in list by ID"""
        for paper in papers_list:
            if paper.get('questionPaperId') == paper_id:
                return paper
        return None
    
    def merge_questions(self, existing_questions, new_questions):
        """Merge questions, avoiding duplicates"""
        # Create hash set of existing questions
        existing_hashes = set()
        for q in existing_questions:
            q_hash = self.generate_question_hash(q)
            existing_hashes.add(q_hash)
        
        # Add new questions that don't exist
        merged_questions = existing_questions.copy()
        new_count = 0
        
        for new_q in new_questions:
            new_hash = self.generate_question_hash(new_q)
            if new_hash not in existing_hashes:
                merged_questions.append(new_q)
                existing_hashes.add(new_hash)
                new_count += 1
        
        logger.info(f"Added {new_count} new questions, {len(new_questions) - new_count} duplicates skipped")
        return merged_questions
    
    def merge_papers(self, existing_papers, new_papers):
        """Merge question papers"""
        # Convert to dict for easier lookup
        papers_dict = {p['questionPaperId']: p for p in existing_papers}
        
        for new_paper in new_papers:
            paper_id = new_paper['questionPaperId']
            
            if paper_id in papers_dict:
                # Merge questions within existing paper
                existing_questions = papers_dict[paper_id].get('questions', [])
                new_questions = new_paper.get('questions', [])
                merged_questions = self.merge_questions(existing_questions, new_questions)
                papers_dict[paper_id]['questions'] = merged_questions
                
                # Update metadata
                papers_dict[paper_id]['lastUpdated'] = datetime.now().isoformat()
            else:
                # Add new paper
                new_paper['lastUpdated'] = datetime.now().isoformat()
                papers_dict[paper_id] = new_paper
        
        return list(papers_dict.values())
    
    def merge_subjects(self, existing_subjects, new_subjects):
        """Merge subjects"""
        # Convert to dict for easier lookup
        subjects_dict = {s['subjectId']: s for s in existing_subjects}
        
        for new_subject in new_subjects:
            subject_id = new_subject['subjectId']
            
            if subject_id in subjects_dict:
                # Merge question papers within existing subject
                existing_papers = subjects_dict[subject_id].get('questionPapers', [])
                new_papers = new_subject.get('questionPapers', [])
                merged_papers = self.merge_papers(existing_papers, new_papers)
                subjects_dict[subject_id]['questionPapers'] = merged_papers
            else:
                # Add new subject
                subjects_dict[subject_id] = new_subject
        
        return list(subjects_dict.values())
    
    def merge_exams(self, existing_exams, new_exams):
        """Merge exams"""
        # Convert to dict for easier lookup
        exams_dict = {e['examId']: e for e in existing_exams}
        
        for new_exam in new_exams:
            exam_id = new_exam['examId']
            
            if exam_id in exams_dict:
                # Merge subjects within existing exam
                existing_subjects = exams_dict[exam_id].get('subjects', [])
                new_subjects = new_exam.get('subjects', [])
                merged_subjects = self.merge_subjects(existing_subjects, new_subjects)
                exams_dict[exam_id]['subjects'] = merged_subjects
            else:
                # Add new exam
                exams_dict[exam_id] = new_exam
        
        return list(exams_dict.values())
    
    def merge_data(self, new_data):
        """Main merge function"""
        logger.info("Starting data merge process...")
        
        # Merge exams
        existing_exams = self.existing_data.get('exams', [])
        new_exams = new_data.get('exams', [])
        
        merged_exams = self.merge_exams(existing_exams, new_exams)
        
        # Create merged data structure
        merged_data = {
            'exams': merged_exams,
            'lastUpdated': datetime.now().isoformat(),
            'sources': new_data.get('sources', []),
            'autoUpdate': new_data.get('autoUpdate', {}),
            'mergeStats': {
                'totalExams': len(merged_exams),
                'mergedAt': datetime.now().isoformat(),
                'previousUpdate': self.existing_data.get('lastUpdated'),
                'newSources': new_data.get('sources', [])
            }
        }
        
        # Calculate statistics
        total_questions = 0
        total_papers = 0
        total_subjects = 0
        
        for exam in merged_exams:
            for subject in exam.get('subjects', []):
                total_subjects += 1
                for paper in subject.get('questionPapers', []):
                    total_papers += 1
                    total_questions += len(paper.get('questions', []))
        
        merged_data['mergeStats'].update({
            'totalQuestions': total_questions,
            'totalPapers': total_papers,
            'totalSubjects': total_subjects
        })
        
        logger.info(f"Merge completed: {len(merged_exams)} exams, {total_questions} questions")
        return merged_data
    
    def save_merged_data(self, merged_data):
        """Save merged data to file"""
        try:
            # Create backup of existing file
            if os.path.exists(self.existing_data_path):
                backup_path = f"{self.existing_data_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                os.rename(self.existing_data_path, backup_path)
                logger.info(f"Created backup: {backup_path}")
            
            # Save merged data
            with open(self.existing_data_path, 'w', encoding='utf-8') as f:
                json.dump(merged_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Merged data saved to {self.existing_data_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving merged data: {str(e)}")
            return False

if __name__ == "__main__":
    # This would be called by the main scraper
    print("Data Merger - Run from main scraper script")
