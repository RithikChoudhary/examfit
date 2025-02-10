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
