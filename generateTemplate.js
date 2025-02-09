const XLSX = require('xlsx');

// Create workbook
const workbook = XLSX.utils.book_new();

// Sample data
const data = [
  {
    'Question': 'What is the capital of France?',
    'Option A': 'London',
    'Option B': 'Paris',
    'Option C': 'Berlin',
    'Option D': 'Madrid',
    'Correct Option': 'b',
    'Explanation': 'Paris is the capital city of France'
  },
  {
    'Question': 'Who wrote "Romeo and Juliet"?',
    'Option A': 'Charles Dickens',
    'Option B': 'Mark Twain',
    'Option C': 'William Shakespeare',
    'Option D': 'Jane Austen',
    'Correct Option': 'c',
    'Explanation': 'William Shakespeare wrote Romeo and Juliet in the late 16th century'
  }
];

// Create worksheet
const ws = XLSX.utils.json_to_sheet(data);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, ws, "Questions");

// Save to file
XLSX.writeFile(workbook, "question_templat.xlsx");