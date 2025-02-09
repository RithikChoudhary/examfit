// function submitQuestionForm() {
//     const formData = {
//         question: document.getElementById('question').value,
//         options: [
//             document.getElementById('optionA').value,
//             document.getElementById('optionB').value,
//             document.getElementById('optionC').value,
//             document.getElementById('optionD').value
//         ],
//         correctOption: document.querySelector('input[name="correctOption"]:checked').value,
//         explanation: document.getElementById('explanation').value
//     };

//     fetch('/api/questions/examId/subjectId', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(formData)
//     })
//     .then(response => response.json())
//     .then(data => {
//         if (data.error) {
//             alert('Error: ' + data.error);
//         } else {
//             alert('Question added successfully!');
//             // Optionally clear the form or redirect the user
//         }
//     })
//     .catch(error => {
//         console.error('Error adding question:', error);
//         alert('Failed to add question');
//     });
// }

// Assuming you have a frontend JavaScript file handling form submissions
function submitQuestionForm() {
    const questionData = gatherFormData();
    if (!validateQuestionData(questionData)) {
        alert('Please fill all fields correctly.');
        return;
    }

    fetch(`/api/questions/${examId}/${subjectId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(questionData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            alert('Question added successfully!');
            clearForm();
        }
    })
    .catch(error => {
        console.error('Error adding question:', error);
        alert('Failed to add question');
    });
}
