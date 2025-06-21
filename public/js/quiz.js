
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

async function calculateResults() {
    const allQuestions = document.querySelectorAll('.question-block');
    let correct = 0;
    let total = allQuestions.length;
    let attempted = 0;
    let answers = {};
    let results = [];
    
    allQuestions.forEach(question => {
        const selectedInput = question.querySelector('input:checked');
        const questionId = selectedInput ? selectedInput.name.replace('question-', '') : null;
        
        if (selectedInput && questionId) {
            attempted++;
            const correctOption = selectedInput.getAttribute('data-correct');
            const isCorrect = selectedInput.value === correctOption;
            
            if (isCorrect) {
                correct++;
            }
            
            // Store answer for session submission
            answers[questionId] = selectedInput.value;
            results.push({
                questionId: questionId,
                userAnswer: selectedInput.value,
                correctAnswer: correctOption,
                isCorrect: isCorrect
            });
        }
    });

    const score = total > 0 ? Math.round((correct/total) * 100) : 0;
    
    // Get session data from URL or page context
    const pathParts = window.location.pathname.split('/');
    const examId = pathParts[1];
    const subjectId = pathParts[2];
    const paperId = pathParts[3];
    
    // Prepare session data
    const sessionData = {
        examId: examId,
        subjectId: subjectId,
        paperId: paperId,
        score: score,
        correct: correct,
        total: attempted, // Only count attempted questions
        answers: answers,
        results: results,
        timeSpent: Date.now() - (window.sessionStartTime || Date.now()),
        completedAt: new Date().toISOString()
    };
    
    try {
        // Save session to database
        const response = await fetch('/api/v1/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(sessionData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Session saved successfully:', result);
            
            // Show enhanced results with save confirmation
            alert(`
                ✅ Session Saved Successfully!
                ============================
                Score Summary:
                Total Questions: ${total}
                Attempted: ${attempted}
                Correct Answers: ${correct}
                Incorrect Answers: ${attempted - correct}
                Score: ${score}%
                
                Session ID: ${result.data?.sessionId || 'Generated'}
                
                View your progress at: /practice/progress
            `);
            
            // Optionally redirect to results page
            if (result.data?.sessionId) {
                setTimeout(() => {
                    if (confirm('Would you like to view detailed results?')) {
                        window.location.href = `/practice/results/${result.data.sessionId}`;
                    }
                }, 1000);
            }
        } else {
            throw new Error('Failed to save session');
        }
    } catch (error) {
        console.error('Error saving session:', error);
        
        // Fallback to basic score display
        alert(`
            ⚠️ Score Calculated (Not Saved)
            ================================
            Total Questions: ${total}
            Attempted: ${attempted}
            Correct Answers: ${correct}
            Incorrect Answers: ${attempted - correct}
            Score: ${score}%
            
            Note: Session could not be saved to database.
        `);
    }
}

// Track session start time
window.sessionStartTime = Date.now();

// Add auto-save functionality every 30 seconds
let autoSaveInterval;
function startAutoSave() {
    autoSaveInterval = setInterval(async () => {
        try {
            const answers = {};
            const questions = document.querySelectorAll('.question-block');
            
            questions.forEach(question => {
                const selectedInput = question.querySelector('input:checked');
                if (selectedInput) {
                    const questionId = selectedInput.name.replace('question-', '');
                    answers[questionId] = selectedInput.value;
                }
            });
            
            // Only auto-save if there are answers
            if (Object.keys(answers).length > 0) {
                const pathParts = window.location.pathname.split('/');
                const draftData = {
                    examId: pathParts[1],
                    subjectId: pathParts[2],
                    paperId: pathParts[3],
                    answers: answers,
                    timestamp: Date.now(),
                    isDraft: true
                };
                
                // Save to localStorage as backup
                localStorage.setItem('quiz_draft', JSON.stringify(draftData));
                console.log('Draft saved locally');
            }
        } catch (error) {
            console.warn('Auto-save failed:', error);
        }
    }, 30000); // Save every 30 seconds
}

// Load draft answers on page load
function loadDraftAnswers() {
    try {
        const draft = localStorage.getItem('quiz_draft');
        if (draft) {
            const draftData = JSON.parse(draft);
            const pathParts = window.location.pathname.split('/');
            
            // Check if draft matches current quiz
            if (draftData.examId === pathParts[1] && 
                draftData.subjectId === pathParts[2] && 
                draftData.paperId === pathParts[3]) {
                
                // Restore answers
                Object.entries(draftData.answers).forEach(([questionId, answer]) => {
                    const input = document.querySelector(`input[name="question-${questionId}"][value="${answer}"]`);
                    if (input) {
                        input.checked = true;
                    }
                });
                
                console.log('Draft answers restored');
            }
        }
    } catch (error) {
        console.warn('Failed to load draft:', error);
    }
}

// Clear draft when quiz is submitted
function clearDraft() {
    localStorage.removeItem('quiz_draft');
}

// Initialize auto-save and load draft when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadDraftAnswers();
    startAutoSave();
});

// Clear draft on successful submission
const originalCalculateResults = calculateResults;
calculateResults = async function() {
    await originalCalculateResults();
    clearDraft();
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
};
