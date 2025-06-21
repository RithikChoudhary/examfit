#!/usr/bin/env python3
"""
MongoDB Migration Script for ExamFit
Migrates data.json to MongoDB without modifying the original file
"""

import json
import os
import sys
from datetime import datetime
from pymongo import MongoClient
from tqdm import tqdm
import hashlib
import time

class MongoMigration:
    def __init__(self, connection_string, data_file_path='../data/data.json'):
        self.connection_string = connection_string
        self.data_file_path = os.path.join(os.path.dirname(__file__), data_file_path)
        self.client = None
        self.db = None
        self.migration_stats = {
            'start_time': None,
            'end_time': None,
            'total_exams': 0,
            'total_subjects': 0,
            'total_papers': 0,
            'total_questions': 0,
            'errors': []
        }
        
    def connect_to_mongodb(self):
        """Connect to MongoDB"""
        try:
            print("🔗 Connecting to MongoDB...")
            self.client = MongoClient(self.connection_string)
            self.db = self.client.examfit
            
            # Test connection
            self.client.admin.command('ping')
            print("✅ MongoDB connection successful!")
            return True
            
        except Exception as e:
            print(f"❌ MongoDB connection failed: {str(e)}")
            return False
    
    def load_json_data(self):
        """Load data from JSON file"""
        try:
            print(f"📂 Loading data from {self.data_file_path}...")
            
            if not os.path.exists(self.data_file_path):
                print(f"❌ Data file not found: {self.data_file_path}")
                return None
            
            file_size = os.path.getsize(self.data_file_path)
            print(f"📊 File size: {file_size / (1024*1024):.2f} MB")
            
            with open(self.data_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            print(f"✅ JSON data loaded successfully!")
            return data
            
        except Exception as e:
            print(f"❌ Error loading JSON data: {str(e)}")
            return None
    
    def create_indexes(self):
        """Create database indexes for performance"""
        try:
            print("🔧 Creating database indexes...")
            
            # Exams collection indexes
            self.db.exams.create_index("examId", unique=True)
            
            # Subjects collection indexes
            self.db.subjects.create_index([("examId", 1), ("subjectId", 1)], unique=True)
            
            # Question papers collection indexes
            self.db.questionPapers.create_index([("examId", 1), ("subjectId", 1), ("paperId", 1)], unique=True)
            
            # Questions collection indexes
            self.db.questions.create_index("questionId", unique=True)
            self.db.questions.create_index("examId")
            self.db.questions.create_index("subjectId")
            self.db.questions.create_index("paperId")
            self.db.questions.create_index([("examId", 1), ("subjectId", 1)])
            
            # Migration log indexes
            self.db.migrationLogs.create_index("timestamp")
            
            print("✅ Database indexes created!")
            
        except Exception as e:
            print(f"⚠️  Warning: Could not create indexes: {str(e)}")
    
    def clear_existing_data(self):
        """Clear existing data in MongoDB (for fresh migration)"""
        try:
            print("🧹 Clearing existing data...")
            
            collections = ['exams', 'subjects', 'questionPapers', 'questions']
            for collection in collections:
                result = self.db[collection].delete_many({})
                if result.deleted_count > 0:
                    print(f"   Cleared {result.deleted_count} documents from {collection}")
            
            print("✅ Existing data cleared!")
            
        except Exception as e:
            print(f"❌ Error clearing data: {str(e)}")
            raise
    
    def migrate_exams(self, exams_data):
        """Migrate exam metadata"""
        try:
            print("📚 Migrating exams...")
            
            exams_to_insert = []
            
            for exam in exams_data:
                exam_doc = {
                    'examId': exam['examId'],
                    'examName': exam['examName'],
                    'totalSubjects': len(exam.get('subjects', [])),
                    'isActive': True,
                    'createdAt': datetime.now(),
                    'migratedAt': datetime.now()
                }
                exams_to_insert.append(exam_doc)
                self.migration_stats['total_exams'] += 1
            
            if exams_to_insert:
                self.db.exams.insert_many(exams_to_insert)
                print(f"✅ {len(exams_to_insert)} exams migrated!")
            
        except Exception as e:
            error_msg = f"Error migrating exams: {str(e)}"
            print(f"❌ {error_msg}")
            self.migration_stats['errors'].append(error_msg)
            raise
    
    def migrate_subjects(self, exams_data):
        """Migrate subjects"""
        try:
            print("📖 Migrating subjects...")
            
            subjects_to_insert = []
            
            for exam in exams_data:
                for subject in exam.get('subjects', []):
                    subject_doc = {
                        'examId': exam['examId'],
                        'subjectId': subject['subjectId'],
                        'subjectName': subject['subjectName'],
                        'totalPapers': len(subject.get('questionPapers', [])),
                        'createdAt': datetime.now(),
                        'migratedAt': datetime.now()
                    }
                    subjects_to_insert.append(subject_doc)
                    self.migration_stats['total_subjects'] += 1
            
            if subjects_to_insert:
                self.db.subjects.insert_many(subjects_to_insert)
                print(f"✅ {len(subjects_to_insert)} subjects migrated!")
            
        except Exception as e:
            error_msg = f"Error migrating subjects: {str(e)}"
            print(f"❌ {error_msg}")
            self.migration_stats['errors'].append(error_msg)
            raise
    
    def migrate_question_papers(self, exams_data):
        """Migrate question papers"""
        try:
            print("📄 Migrating question papers...")
            
            papers_to_insert = []
            
            for exam in exams_data:
                for subject in exam.get('subjects', []):
                    for paper in subject.get('questionPapers', []):
                        paper_doc = {
                            'examId': exam['examId'],
                            'subjectId': subject['subjectId'],
                            'paperId': paper['questionPaperId'],
                            'paperName': paper['questionPaperName'],
                            'section': paper.get('section', ''),
                            'totalQuestions': len(paper.get('questions', [])),
                            'createdAt': datetime.now(),
                            'migratedAt': datetime.now()
                        }
                        papers_to_insert.append(paper_doc)
                        self.migration_stats['total_papers'] += 1
            
            if papers_to_insert:
                self.db.questionPapers.insert_many(papers_to_insert)
                print(f"✅ {len(papers_to_insert)} question papers migrated!")
            
        except Exception as e:
            error_msg = f"Error migrating question papers: {str(e)}"
            print(f"❌ {error_msg}")
            self.migration_stats['errors'].append(error_msg)
            raise
    
    def migrate_questions(self, exams_data):
        """Migrate questions with progress tracking"""
        try:
            print("❓ Migrating questions...")
            
            # Count total questions first
            total_questions = 0
            for exam in exams_data:
                for subject in exam.get('subjects', []):
                    for paper in subject.get('questionPapers', []):
                        total_questions += len(paper.get('questions', []))
            
            print(f"📊 Total questions to migrate: {total_questions}")
            
            # Migrate in batches
            batch_size = 1000
            questions_batch = []
            processed = 0
            
            # Progress bar
            with tqdm(total=total_questions, desc="Questions", unit="q") as pbar:
                for exam in exams_data:
                    for subject in exam.get('subjects', []):
                        for paper in subject.get('questionPapers', []):
                            for question in paper.get('questions', []):
                                question_doc = {
                                    'questionId': question['questionId'],
                                    'examId': exam['examId'],
                                    'subjectId': subject['subjectId'],
                                    'paperId': paper['questionPaperId'],
                                    'question': question['question'],
                                    'options': question['options'],
                                    'correctOption': question['correctOption'],
                                    'explanation': question.get('explanation', ''),
                                    'difficulty': question.get('difficulty', 'medium'),
                                    'tags': question.get('tags', []),
                                    'source': question.get('source', ''),
                                    'createdAt': datetime.now(),
                                    'migratedAt': datetime.now()
                                }
                                
                                questions_batch.append(question_doc)
                                processed += 1
                                self.migration_stats['total_questions'] += 1
                                
                                # Insert batch when it reaches batch_size
                                if len(questions_batch) >= batch_size:
                                    self.db.questions.insert_many(questions_batch)
                                    questions_batch = []
                                    pbar.update(batch_size)
                
                # Insert remaining questions
                if questions_batch:
                    self.db.questions.insert_many(questions_batch)
                    pbar.update(len(questions_batch))
            
            print(f"✅ {processed} questions migrated!")
            
        except Exception as e:
            error_msg = f"Error migrating questions: {str(e)}"
            print(f"❌ {error_msg}")
            self.migration_stats['errors'].append(error_msg)
            raise
    
    def validate_migration(self, original_data):
        """Validate migration by comparing counts"""
        try:
            print("🔍 Validating migration...")
            
            # Count original data
            original_exams = len(original_data.get('exams', []))
            original_subjects = 0
            original_papers = 0
            original_questions = 0
            
            for exam in original_data.get('exams', []):
                for subject in exam.get('subjects', []):
                    original_subjects += 1
                    for paper in subject.get('questionPapers', []):
                        original_papers += 1
                        original_questions += len(paper.get('questions', []))
            
            # Count MongoDB data
            mongo_exams = self.db.exams.count_documents({})
            mongo_subjects = self.db.subjects.count_documents({})
            mongo_papers = self.db.questionPapers.count_documents({})
            mongo_questions = self.db.questions.count_documents({})
            
            print("\n📊 Migration Validation Report:")
            print(f"   Exams:     {original_exams:,} → {mongo_exams:,} {'✅' if original_exams == mongo_exams else '❌'}")
            print(f"   Subjects:  {original_subjects:,} → {mongo_subjects:,} {'✅' if original_subjects == mongo_subjects else '❌'}")
            print(f"   Papers:    {original_papers:,} → {mongo_papers:,} {'✅' if original_papers == mongo_papers else '❌'}")
            print(f"   Questions: {original_questions:,} → {mongo_questions:,} {'✅' if original_questions == mongo_questions else '❌'}")
            
            # Check for any validation failures
            validation_passed = (
                original_exams == mongo_exams and
                original_subjects == mongo_subjects and
                original_papers == mongo_papers and
                original_questions == mongo_questions
            )
            
            if validation_passed:
                print("\n✅ Migration validation PASSED!")
                return True
            else:
                print("\n❌ Migration validation FAILED!")
                return False
                
        except Exception as e:
            print(f"❌ Error during validation: {str(e)}")
            return False
    
    def log_migration(self, success=True):
        """Log migration details"""
        try:
            log_doc = {
                'timestamp': datetime.now(),
                'success': success,
                'stats': self.migration_stats,
                'duration_seconds': (
                    (self.migration_stats['end_time'] - self.migration_stats['start_time']).total_seconds()
                    if self.migration_stats['end_time'] and self.migration_stats['start_time']
                    else 0
                )
            }
            
            self.db.migrationLogs.insert_one(log_doc)
            print("📝 Migration logged to database")
            
        except Exception as e:
            print(f"⚠️  Warning: Could not log migration: {str(e)}")
    
    def run_migration(self, clear_existing=True):
        """Run complete migration process"""
        try:
            self.migration_stats['start_time'] = datetime.now()
            
            print("🚀 Starting MongoDB Migration...")
            print("=" * 50)
            
            # Step 1: Connect to MongoDB
            if not self.connect_to_mongodb():
                return False
            
            # Step 2: Load JSON data
            data = self.load_json_data()
            if not data:
                return False
            
            # Step 3: Clear existing data (if requested)
            if clear_existing:
                self.clear_existing_data()
            
            # Step 4: Create indexes
            self.create_indexes()
            
            # Step 5: Migrate data
            exams_data = data.get('exams', [])
            
            self.migrate_exams(exams_data)
            self.migrate_subjects(exams_data)
            self.migrate_question_papers(exams_data)
            self.migrate_questions(exams_data)
            
            # Step 6: Validate migration
            validation_passed = self.validate_migration(data)
            
            self.migration_stats['end_time'] = datetime.now()
            duration = self.migration_stats['end_time'] - self.migration_stats['start_time']
            
            # Step 7: Log migration
            self.log_migration(success=validation_passed)
            
            # Final report
            print("\n" + "=" * 50)
            print("🎉 MIGRATION COMPLETED!")
            print(f"⏱️  Duration: {duration}")
            print(f"📚 Exams: {self.migration_stats['total_exams']:,}")
            print(f"📖 Subjects: {self.migration_stats['total_subjects']:,}")
            print(f"📄 Papers: {self.migration_stats['total_papers']:,}")
            print(f"❓ Questions: {self.migration_stats['total_questions']:,}")
            
            if self.migration_stats['errors']:
                print(f"⚠️  Errors: {len(self.migration_stats['errors'])}")
                for error in self.migration_stats['errors']:
                    print(f"   - {error}")
            
            if validation_passed:
                print("\n✅ Migration successful! Data is ready in MongoDB.")
            else:
                print("\n❌ Migration completed with validation errors.")
            
            return validation_passed
            
        except Exception as e:
            self.migration_stats['end_time'] = datetime.now()
            error_msg = f"Fatal migration error: {str(e)}"
            print(f"\n❌ {error_msg}")
            self.migration_stats['errors'].append(error_msg)
            self.log_migration(success=False)
            return False
        
        finally:
            if self.client:
                self.client.close()

if __name__ == "__main__":
    # MongoDB connection string (replace with yours)
    CONNECTION_STRING = "mongodb+srv://examfit:snpN01ULMUC2cdI5@examfit.hzuwfkl.mongodb.net/?retryWrites=true&w=majority&appName=examfit"
    
    # Run migration
    migrator = MongoMigration(CONNECTION_STRING)
    success = migrator.run_migration(clear_existing=True)
    
    if success:
        print("\n🎯 Next steps:")
        print("1. Update your Node.js app to use MongoDB")
        print("2. Test the application with MongoDB data")
        print("3. Keep data.json as backup until you're confident")
        sys.exit(0)
    else:
        print("\n💡 Migration failed. Your data.json file is untouched.")
        sys.exit(1)
