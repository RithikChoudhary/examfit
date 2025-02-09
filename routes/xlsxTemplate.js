const express = require('express');
const XLSX = require('xlsx');
const router = express.Router();

router.get('/templates/question_template.xlsx', (req, res) => {
    try {
        // Create a new workbook
        const workbook = XLSX.utils.book_new();
        
        // Create sample data
        const templateData = [
            {
                'Question': 'Sample Question 1?',
                'Option A': 'First Option',
                'Option B': 'Second Option',
                'Option C': 'Third Option',
                'Option D': 'Fourth Option',
                'Correct Option': 'a',
                'Explanation': 'Explanation for why option A is correct'
            },
            {
                'Question': 'Sample Question 2?',
                'Option A': 'Option One',
                'Option B': 'Option Two',
                'Option C': 'Option Three',
                'Option D': 'Option Four.',
                'Correct Option': 'b',
                'Explanation': 'Explanation for why option B is correct'
            }
        ];

        // Convert data to worksheet
        const ws = XLSX.utils.json_to_sheet(templateData);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, ws, "Template");

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for file download
        res.setHeader('Content-Disposition', 'attachment; filename=question_template.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        // Send the file
        res.send(buffer);
    } catch (error) {
        console.error('Error generating template:', error);
        res.status(500).send('Error generating template file');
    }
});

module.exports = router;