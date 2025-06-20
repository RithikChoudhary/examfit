mnma# examfit
asf
asd
s


if i go to. this page , it gives error
http://localhost:16/upsc 

and update the dashboard page as well , it have many other pages inside it , so check them out 

and on home page of the website , can we bring the choose your exam thing up ,as nobody will scroll down to see the subjects or exams 

and on the website u mentioned that we track the progress , so there is no such functionality , so need that too

and there is file called data.json where all data is stored,
I dont have much time to update the questions or data , so how to do it automatically and have the actual questions only , not the made up questions and mention the last date when they are updated.

so find something to do it.
this website is only hosted on vercel

graph TB
    A[Client Requests] --> B[API Router /api/v1]
    B --> C[Validation Middleware]
    C --> D[Controller Layer]
    D --> E[Service Layer]
    E --> F[Cache Layer]
    F --> G[Data Access Layer]
    G --> H[JSON File Storage]
    
    E --> I[Business Logic]
    I --> J[Exam Service]
    I --> K[Question Service]
    I --> L[Progress Service]
    
    subgraph "New Components"
        M[Error Handler]
        N[Request Logger]
        O[Response Formatter]
    end
    
    D --> M
    D --> N
    D --> O
