const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'quiz_database.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for high performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('admin', 'student')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'General',
      time_limit_mins INTEGER DEFAULT 10,
      passing_score INTEGER DEFAULT 60,
      is_published INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options TEXT NOT NULL, -- JSON array of strings
      correct_option_index INTEGER NOT NULL,
      points INTEGER DEFAULT 1,
      explanation TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      user_id TEXT,
      student_name TEXT NOT NULL,
      student_email TEXT NOT NULL,
      answers TEXT NOT NULL, -- JSON object { questionId: selectedIndex }
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      percentage REAL NOT NULL,
      passed INTEGER NOT NULL,
      started_at DATETIME NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
  `);

  // Check if we need to seed
  const quizCount = db.prepare('SELECT count(*) as count FROM quizzes').get().count;
  if (quizCount === 0) {
    seedData();
  }
}

function seedData() {
  console.log('Seeding initial quizzes and questions...');

  // Pre-seed users
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, role)
    VALUES (?, ?, ?, ?)
  `);
  insertUser.run('u-admin-1', 'Prof. Alan Turing', 'admin@college.edu', 'admin');
  insertUser.run('u-student-1', 'Alex Rivera', 'alex@college.edu', 'student');
  insertUser.run('u-student-2', 'Samantha Chen', 'samantha@college.edu', 'student');

  // Pre-seed Quizzes
  const insertQuiz = db.prepare(`
    INSERT INTO quizzes (id, title, description, category, time_limit_mins, passing_score, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertQuestion = db.prepare(`
    INSERT INTO questions (id, quiz_id, question_text, options, correct_option_index, points, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Quiz 1: Microservices Architecture (Directly inspired by the PDF slides)
  const q1Id = 'quiz-microservices-101';
  insertQuiz.run(
    q1Id,
    'Microservice Architecture & Distributed Systems',
    'Test your fundamental understanding of microservice boundaries, REST APIs, and decoupled systems as outlined in the system design presentation.',
    'System Design',
    10,
    60,
    1
  );

  const q1Questions = [
    {
      id: 'q1-1',
      text: 'Which protocol is standard for connecting independent microservices in web architectures?',
      options: ['REST', 'SMTP', 'FTP', 'DNS'],
      correct: 0,
      points: 1,
      explanation: 'REST (over HTTP/HTTPS) is the standard lightweight architectural protocol used for microservice communication.'
    },
    {
      id: 'q1-2',
      text: 'According to the single responsibility principle in microservices, what should a dedicated "Quiz Service" own?',
      options: [
        'User billing, card transactions, and invoice PDF rendering',
        'Quiz lifecycle: managing quizzes, questions, student attempts, and evaluations',
        'Direct low-level network routing and hardware load balancing only',
        'Hosting the campus DNS registrar and email servers'
      ],
      correct: 1,
      points: 1,
      explanation: 'As highlighted in slide 2, the Quiz Service owns the quiz lifecycle: managing quizzes, questions, attempts, and scores.'
    },
    {
      id: 'q1-3',
      text: 'Why does manual quiz management fail to scale for colleges and learning platforms?',
      options: [
        'Paper and manual checking is slow, error-prone, and student records are hard to track',
        'Digital databases cannot store more than 10 students',
        'REST APIs require paper backups by law',
        'Calculators cannot compute percentages'
      ],
      correct: 0,
      points: 1,
      explanation: 'Slide 3 notes that manual question paper updates and manual answer checking are slow and error-prone, whereas automated services provide fast, consistent results.'
    },
    {
      id: 'q1-4',
      text: 'In the Quiz Service architecture diagram (Slide 6), which service manages identity and authentication?',
      options: ['Client Direct DB', 'Result Service', 'Auth Service', 'Cache Server'],
      correct: 2,
      points: 1,
      explanation: 'Slide 6 shows distinct microservices: Client -> Quiz Service -> Auth Service, User Service, and Result Service.'
    },
    {
      id: 'q1-5',
      text: 'What is a primary benefit of decoupling Quiz evaluation into an automated service?',
      options: [
        'It requires questions to be written only in binary code',
        'Independent scalability, high modularity, and instant automated feedback for students',
        'It guarantees zero internet bandwidth usage',
        'Students can change their scores at any time'
      ],
      correct: 1,
      points: 1,
      explanation: 'Slide 9 highlights Easy Maintenance, Scalability, Modularity, Automation, and Reusability.'
    }
  ];

  for (const q of q1Questions) {
    insertQuestion.run(
      q.id,
      q1Id,
      q.text,
      JSON.stringify(q.options),
      q.correct,
      q.points,
      q.explanation
    );
  }

  // Quiz 2: Web APIs & Database Fundamentals
  const q2Id = 'quiz-web-db-201';
  insertQuiz.run(
    q2Id,
    'REST APIs & Database Design Essentials',
    'Assess your knowledge of HTTP status codes, relational database normalization, and CRUD API operations.',
    'Software Engineering',
    8,
    70,
    1
  );

  const q2Questions = [
    {
      id: 'q2-1',
      text: 'Which HTTP method should be used to submit a new student quiz attempt?',
      options: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      correct: 1,
      points: 1,
      explanation: 'POST is the appropriate idempotent or state-creating HTTP verb used to send resource data to the server for processing.'
    },
    {
      id: 'q2-2',
      text: 'What HTTP status code signifies that a requested quiz ID was not found on the server?',
      options: ['200 OK', '404 Not Found', '500 Server Error', '302 Found'],
      correct: 1,
      points: 1,
      explanation: 'HTTP 404 indicates that the server cannot find the requested resource.'
    },
    {
      id: 'q2-3',
      text: 'In relational database design, what ensures referential integrity between Questions and Quizzes?',
      options: ['Foreign Key constraint', 'CSS style rule', 'REST parameter', 'HTML tag'],
      correct: 0,
      points: 1,
      explanation: 'A Foreign Key on questions(quiz_id) linking to quizzes(id) guarantees referential integrity and supports cascade deletion.'
    },
    {
      id: 'q2-4',
      text: 'What tool is typically used during development to verify and test REST API endpoints (as mentioned in slide 8)?',
      options: ['Postman', 'Photoshop', 'VLC Media Player', 'Microsoft Excel'],
      correct: 0,
      points: 1,
      explanation: 'Slide 8 explicitly lists Postman for "API testing during development".'
    }
  ];

  for (const q of q2Questions) {
    insertQuestion.run(
      q.id,
      q2Id,
      q.text,
      JSON.stringify(q.options),
      q.correct,
      q.points,
      q.explanation
    );
  }

  console.log('Seed completed successfully!');
}

initDB();

module.exports = { db };

