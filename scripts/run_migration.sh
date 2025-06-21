#!/bin/bash

# MongoDB Migration Runner Script for ExamFit

echo "🚀 ExamFit MongoDB Migration"
echo "================================="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3 and try again."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is required but not installed."
    echo "Please install pip3 and try again."
    exit 1
fi

# Navigate to scripts directory
cd "$(dirname "$0")"

echo "📦 Installing Python dependencies..."
pip3 install -r requirements_mongo.txt

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies."
    echo "Please check your pip installation and try again."
    exit 1
fi

echo ""
echo "🔄 Starting migration..."
echo "This will migrate your data.json to MongoDB"
echo "Your original data.json file will NOT be modified"
echo ""

# Run the migration script
python3 mongo_migration.py

migration_exit_code=$?

echo ""
if [ $migration_exit_code -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Update your Node.js application to use MongoDB"
    echo "2. Test the application thoroughly"
    echo "3. Keep data.json as backup until confident"
else
    echo "❌ Migration failed!"
    echo "Your data.json file remains unchanged."
    echo "Check the error messages above for details."
fi

echo ""
echo "Migration script finished."
exit $migration_exit_code
