// Loading indicator styles
const loadingSpinner = `
  <div class="loading-spinner" style="
    display: inline-block;
    width: 2rem;
    height: 2rem;
    border: 0.25em solid #f3f3f3;
    border-top: 0.25em solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  "></div>
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Initialize lazy loading
function initializeLazyLoading() {
  const subjectsContainer = document.getElementById('subjects-container');
  const loadingIndicator = document.createElement('div');
  loadingIndicator.innerHTML = loadingSpinner;
  
  let currentPage = 1;
  const pageSize = 10;

  // Show loading indicator when scrolling near bottom
  window.addEventListener('scroll', async () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
      if (!loadingIndicator.classList.contains('visible') && !isLoading) {
        loadingIndicator.classList.add('visible');
        subjectsContainer.appendChild(loadingIndicator);
        
        try {
          const response = await fetch(`/subjects/${examId}?page=${currentPage}&pageSize=${pageSize}`);
          const data = await response.json();
          
          if (data.hasMore) {
            currentPage++;
            appendSubjects(data.subjects);
          }
        } catch (error) {
          console.error('Error loading more subjects:', error);
        } finally {
          loadingIndicator.classList.remove('visible');
        }
      }
    }
  });
}

// Append new subjects to the container
function appendSubjects(subjects) {
  const subjectsList = document.getElementById('subjects-list');
  subjects.forEach(subject => {
    const subjectElement = document.createElement('div');
    subjectElement.className = 'subject-item';
    subjectElement.innerHTML = `
      <h3>${subject.subjectName}</h3>
      <p>${subject.questions.length} questions</p>
    `;
    subjectsList.appendChild(subjectElement);
  });
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', initializeLazyLoading);