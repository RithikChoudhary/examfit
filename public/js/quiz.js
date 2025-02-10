
function checkAnswer(event, correctOption, explanation) {
    const selectedElement = event.target.parentElement;
    const selectedValue = event.target.value;
    const questionBlock = event.target.closest('.question-block');
    const allOptions = questionBlock.querySelectorAll('label');
    const explanationDiv = questionBlock.querySelector('.explanation');
    
    // Store correct answer for score calculation
    selectedElement.querySelector('input').setAttribute('data-correct', correctOption);
    
    allOptions.forEach(option => {
        const input = option.querySelector('input');
        input.disabled = true;
    });

    const correctElement = Array.from(allOptions).find(label => 
        label.querySelector('input').value === correctOption
    );
    correctElement.classList.add('correct');

    if (selectedValue !== correctOption) {
        selectedElement.classList.add('incorrect');
    }

    // if (explanation) {
    //     explanationDiv.innerHTML = `<p><strong>Explanation:</strong> ${explanation}</p>`;
    //     explanationDiv.style.display = 'block';
    // }
    explanationDiv.style.display = 'block';
    
    // Replace newline characters with <br> tags for proper formatting
    const formattedExplanation = explanation.replace(/\n/g, '<br>');
    
    // Set the explanation text
    explanationDiv.innerHTML = `<strong>Explanation:</strong> ${formattedExplanation}`;
    
}

function calculateResults() {
    const allQuestions = document.querySelectorAll('.question-block');
    let correct = 0;
    let total = allQuestions.length;
    let attempted = 0;
    
    allQuestions.forEach(question => {
        const selectedInput = question.querySelector('input:checked');
        const correctOption = selectedInput?.getAttribute('data-correct');
        
        if (selectedInput) {
            attempted++;
            if (selectedInput.value === correctOption) {
                correct++;
            }
        }
    });

    alert(`
        Score Summary:
        ----------------
        Total Questions: ${total}
        Attempted: ${attempted}
        Correct Answers: ${correct}
        Incorrect Answers: ${attempted - correct}
        Score: ${Math.round((correct/total) * 100)}%
    `);
}