const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

// Blog posts data (in production, this would come from a database)
const blogPosts = [
  {
    id: 'upsc-preparation-strategy-2025',
    title: 'UPSC Preparation Strategy 2025: Complete Guide for Beginners',
    excerpt: 'Learn the most effective UPSC preparation strategy for 2025. This comprehensive guide covers syllabus analysis, study plan, and expert tips.',
    content: `
      <h2>Introduction to UPSC 2025</h2>
      <p>The Union Public Service Commission (UPSC) Civil Services Examination is one of India's most prestigious competitive exams. With the changing pattern and increasing competition, a structured preparation strategy is essential for success in 2025.</p>
      
      <h2>Understanding the UPSC Syllabus</h2>
      <p>The UPSC exam consists of three stages:</p>
      <ul>
        <li><strong>Prelims:</strong> General Studies Paper I & II (CSAT)</li>
        <li><strong>Mains:</strong> 9 papers including Essay, General Studies, and Optional subjects</li>
        <li><strong>Interview:</strong> Personality Test</li>
      </ul>
      
      <h2>Effective Study Plan</h2>
      <h3>Phase 1: Foundation Building (6-8 months)</h3>
      <ul>
        <li>Complete NCERT books from Classes 6-12</li>
        <li>Read standard reference books</li>
        <li>Start newspaper reading habit</li>
        <li>Join coaching if needed</li>
      </ul>
      
      <h3>Phase 2: Intensive Preparation (6-8 months)</h3>
      <ul>
        <li>Complete optional subject preparation</li>
        <li>Practice answer writing</li>
        <li>Take mock tests regularly</li>
        <li>Current affairs compilation</li>
      </ul>
      
      <h3>Phase 3: Revision and Practice (2-3 months)</h3>
      <ul>
        <li>Intensive revision of all subjects</li>
        <li>Previous year question practice</li>
        <li>Mock test analysis</li>
        <li>Interview preparation</li>
      </ul>
      
      <h2>Key Success Tips</h2>
      <ul>
        <li>Maintain consistency in study routine</li>
        <li>Focus on conceptual clarity</li>
        <li>Practice answer writing regularly</li>
        <li>Stay updated with current affairs</li>
        <li>Take care of mental and physical health</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>UPSC preparation requires dedication, consistency, and smart strategy. Follow a structured approach, stay motivated, and success will follow. Remember, it's a marathon, not a sprint.</p>
    `,
    author: 'ExamFit Team',
    publishDate: '2025-06-20',
    category: 'UPSC',
    tags: ['UPSC', 'Strategy', 'Preparation', 'Civil Services'],
    readTime: '8 min read',
    image: '/templates/union-public-service-commission-(cms).webp'
  },
  {
    id: 'ssc-cgl-preparation-tips',
    title: 'SSC CGL 2025: Top 10 Preparation Tips for Success',
    excerpt: 'Discover the best SSC CGL preparation tips and strategies to crack the exam in 2025. Expert advice and study techniques included.',
    content: `
      <h2>Understanding SSC CGL</h2>
      <p>Staff Selection Commission Combined Graduate Level (SSC CGL) is a popular competitive exam for graduate-level posts in various government departments and organizations.</p>
      
      <h2>Exam Pattern Overview</h2>
      <h3>Tier 1: Objective Type</h3>
      <ul>
        <li>General Intelligence & Reasoning (25 questions)</li>
        <li>General Awareness (25 questions)</li>
        <li>Quantitative Aptitude (25 questions)</li>
        <li>English Comprehension (25 questions)</li>
      </ul>
      
      <h3>Tier 2: Objective Type</h3>
      <ul>
        <li>Quantitative Abilities</li>
        <li>English Language & Comprehension</li>
        <li>Statistics (for specific posts)</li>
        <li>General Studies (Finance & Economics)</li>
      </ul>
      
      <h2>Top 10 Preparation Tips</h2>
      <ol>
        <li><strong>Know the Syllabus:</strong> Understand the complete syllabus and exam pattern</li>
        <li><strong>Create a Study Schedule:</strong> Allocate time for each subject based on your strengths and weaknesses</li>
        <li><strong>Focus on Basics:</strong> Build strong fundamentals in mathematics and English</li>
        <li><strong>Practice Mock Tests:</strong> Take regular mock tests to improve speed and accuracy</li>
        <li><strong>Current Affairs:</strong> Stay updated with daily current affairs</li>
        <li><strong>Previous Year Papers:</strong> Solve at least 10 years of previous papers</li>
        <li><strong>Time Management:</strong> Learn to manage time effectively during the exam</li>
        <li><strong>Revision Strategy:</strong> Create short notes for quick revision</li>
        <li><strong>Stay Healthy:</strong> Maintain physical and mental health</li>
        <li><strong>Stay Motivated:</strong> Keep yourself motivated throughout the preparation journey</li>
      </ol>
      
      <h2>Subject-wise Preparation Strategy</h2>
      <h3>Quantitative Aptitude</h3>
      <ul>
        <li>Master basic arithmetic concepts</li>
        <li>Practice geometry and trigonometry</li>
        <li>Focus on data interpretation</li>
      </ul>
      
      <h3>English Language</h3>
      <ul>
        <li>Improve vocabulary daily</li>
        <li>Practice grammar rules</li>
        <li>Read newspapers and magazines</li>
      </ul>
      
      <h3>General Awareness</h3>
      <ul>
        <li>Focus on Indian history, geography, and polity</li>
        <li>Stay updated with current affairs</li>
        <li>Practice static GK regularly</li>
      </ul>
      
      <h3>Reasoning</h3>
      <ul>
        <li>Practice different types of reasoning questions</li>
        <li>Master puzzles and seating arrangements</li>
        <li>Focus on logical reasoning</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>SSC CGL success requires consistent effort, smart preparation, and regular practice. Follow these tips, stay dedicated, and you'll be well on your way to clearing the exam.</p>
    `,
    author: 'ExamFit Team',
    publishDate: '2025-06-19',
    category: 'SSC',
    tags: ['SSC CGL', 'Preparation', 'Tips', 'Strategy'],
    readTime: '6 min read',
    image: '/templates/cgl.png'
  },
  {
    id: 'current-affairs-june-2025',
    title: 'Current Affairs June 2025: Important Events for Competitive Exams',
    excerpt: 'Stay updated with the most important current affairs of June 2025. Comprehensive coverage of national and international events.',
    content: `
      <h2>National Current Affairs - June 2025</h2>
      
      <h3>Political Developments</h3>
      <ul>
        <li>Important policy announcements by the government</li>
        <li>Key parliamentary sessions and bills passed</li>
        <li>State assembly elections updates</li>
        <li>Supreme Court landmark judgments</li>
      </ul>
      
      <h3>Economic News</h3>
      <ul>
        <li>Budget announcements and economic policies</li>
        <li>RBI monetary policy decisions</li>
        <li>Stock market trends and major IPOs</li>
        <li>Infrastructure development projects</li>
      </ul>
      
      <h3>Science & Technology</h3>
      <ul>
        <li>ISRO space missions and achievements</li>
        <li>Digital India initiatives</li>
        <li>Innovation in renewable energy</li>
        <li>Healthcare and medical breakthroughs</li>
      </ul>
      
      <h2>International Current Affairs</h2>
      
      <h3>Global Politics</h3>
      <ul>
        <li>Major international summits and conferences</li>
        <li>Diplomatic relations and treaties</li>
        <li>Global security and peacekeeping efforts</li>
        <li>Trade agreements and economic partnerships</li>
      </ul>
      
      <h3>Environment & Climate</h3>
      <ul>
        <li>Climate change initiatives</li>
        <li>International environmental agreements</li>
        <li>Natural disasters and their impacts</li>
        <li>Sustainable development goals progress</li>
      </ul>
      
      <h2>Sports & Awards</h2>
      <ul>
        <li>Major sports events and championships</li>
        <li>Indian athletes' international achievements</li>
        <li>Important awards and recognitions</li>
        <li>Olympic and Commonwealth Games preparations</li>
      </ul>
      
      <h2>Books & Authors</h2>
      <ul>
        <li>New book releases by prominent authors</li>
        <li>Literary awards and recognitions</li>
        <li>International book fairs and festivals</li>
        <li>Educational publications and research</li>
      </ul>
      
      <h2>Important Dates & Days</h2>
      <ul>
        <li>World Environment Day (June 5)</li>
        <li>International Yoga Day (June 21)</li>
        <li>World Refugee Day (June 20)</li>
        <li>International Day of the Tropics (June 29)</li>
      </ul>
      
      <h2>Study Tips for Current Affairs</h2>
      <ul>
        <li>Read newspapers daily</li>
        <li>Watch news channels regularly</li>
        <li>Make monthly current affairs notes</li>
        <li>Practice current affairs MCQs</li>
        <li>Join current affairs discussion groups</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Staying updated with current affairs is crucial for competitive exam success. Make it a habit to read and revise current affairs regularly. This comprehensive coverage will help you stay ahead in your preparation.</p>
    `,
    author: 'ExamFit Team',
    publishDate: '2025-06-18',
    category: 'Current Affairs',
    tags: ['Current Affairs', 'June 2025', 'Competitive Exams', 'GK'],
    readTime: '10 min read',
    image: '/templates/current-affairs.svg'
  }
];

// Blog home page
router.get('/', (req, res) => {
  res.render('blog/index', {
    title: 'ExamFit Blog - Latest Updates & Preparation Tips',
    posts: blogPosts,
    categories: ['All', 'UPSC', 'SSC', 'Banking', 'Current Affairs', 'Study Tips'],
    activeCategory: 'All',
    featuredPost: blogPosts[0]
  });
});

// Individual blog post
router.get('/:slug', (req, res) => {
  const post = blogPosts.find(p => p.id === req.params.slug);
  
  if (!post) {
    return res.status(404).render('404', {
      title: 'Blog Post Not Found'
    });
  }
  
  // Related posts (excluding current post)
  const relatedPosts = blogPosts
    .filter(p => p.id !== post.id && (p.category === post.category || p.tags.some(tag => post.tags.includes(tag))))
    .slice(0, 3);
  
  res.render('blog/post', {
    title: post.title,
    post: post,
    relatedPosts: relatedPosts
  });
});

// Category filter
router.get('/category/:category', (req, res) => {
  const category = req.params.category;
  const filteredPosts = category === 'All' ? blogPosts : blogPosts.filter(p => p.category.toLowerCase() === category.toLowerCase());
  
  res.render('blog/index', {
    title: `${category} - ExamFit Blog`,
    posts: filteredPosts,
    categories: ['All', 'UPSC', 'SSC', 'Banking', 'Current Affairs', 'Study Tips'],
    activeCategory: category,
    featuredPost: filteredPosts[0],
    canonicalUrl: `https://examfit.in/blog/category/${category.toLowerCase()}`
  });
});

module.exports = router;
