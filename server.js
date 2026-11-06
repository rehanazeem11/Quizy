const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. AUTH & USER SERVICE (Mock Microservice)
// ==========================================
app.get('/api/auth/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, role FROM users').all();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email } = req.body;
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      // Auto-create student user if they don't exist
      const newId = 'u-' + uuidv4().slice(0, 8);
      const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      db.prepare('INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)').run(
        newId,
        name,
        email,
        'student'
      );
      user = { id: newId, name, email, role: 'student' };
    }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. QUIZ SERVICE (Core Microservice)
// ==========================================
// List quizzes with question counts and attempt counts
app.get('/api/quizzes', (req, res) => {
  try {
    const { role } = req.query; // 'admin' or 'student'
    let query = `
      SELECT 
        q.*,
        COUNT(DISTINCT qst.id) as question_count,
        COUNT(DISTINCT att.id) as total_attempts,
        ROUND(AVG(att.percentage), 1) as avg_score
      FROM quizzes q
      LEFT JOIN questions qst ON qst.quiz_id = q.id
      LEFT JOIN attempts att ON att.quiz_id = q.id
    `;

    if (role !== 'admin') {
      query += ` WHERE q.is_published = 1 `;
    }

    query += ` GROUP BY q.id ORDER BY q.created_at DESC`;

    const quizzes = db.prepare(query).all();
    res.json({ success: true, data: quizzes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single quiz metadata
app.get('/api/quizzes/:id', (req, res) => {
  try {
    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, error: 'Quiz not found' });
    res.json({ success: true, data: quiz });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Secure quiz bundle for student attempt (Correct answer keys stripped)
app.get('/api/quizzes/:id/for-attempt', (req, res) => {
  try {
    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ? AND is_published = 1').get(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, error: 'Quiz not found or not published' });

    const questions = db.prepare('SELECT id, question_text, options, points FROM questions WHERE quiz_id = ?').all(quiz.id);
    
    // Parse JSON options
    const safeQuestions = questions.map(q => ({
      id: q.id,
      question_text: q.question_text,
      options: JSON.parse(q.options),
      points: q.points
    }));

    res.json({
      success: true,
      data: {
        quiz,
        questions: safeQuestions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Create new quiz
app.post('/api/quizzes', (req, res) => {
  try {
    const { title, description, category, time_limit_mins, passing_score, is_published } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

    const id = 'quiz-' + uuidv4().slice(0, 8);
    db.prepare(`
      INSERT INTO quizzes (id, title, description, category, time_limit_mins, passing_score, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      description || '',
      category || 'General',
      parseInt(time_limit_mins) || 10,
      parseInt(passing_score) || 60,
      is_published ? 1 : 0
    );

    const created = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Update quiz
app.put('/api/quizzes/:id', (req, res) => {
  try {
    const { title, description, category, time_limit_mins, passing_score, is_published } = req.body;
    const existing = db.prepare('SELECT id FROM quizzes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Quiz not found' });

    db.prepare(`
      UPDATE quizzes 
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          category = COALESCE(?, category),
          time_limit_mins = COALESCE(?, time_limit_mins),
          passing_score = COALESCE(?, passing_score),
          is_published = COALESCE(?, is_published),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title,
      description,
      category,
      time_limit_mins ? parseInt(time_limit_mins) : undefined,
      passing_score ? parseInt(passing_score) : undefined,
      typeof is_published === 'boolean' ? (is_published ? 1 : 0) : undefined,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Delete quiz
app.delete('/api/quizzes/:id', (req, res) => {
  try {
    const info = db.prepare('DELETE FROM quizzes WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ success: false, error: 'Quiz not found' });
    res.json({ success: true, message: 'Quiz deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. QUESTION SERVICE (Admin MCQ Management)
// ==========================================
// Get all questions with answers for admin
app.get('/api/quizzes/:quizId/questions', (req, res) => {
  try {
    const questions = db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY created_at ASC').all(req.params.quizId);
    const parsed = questions.map(q => ({
      ...q,
      options: JSON.parse(q.options)
    }));
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create question
app.post('/api/quizzes/:quizId/questions', (req, res) => {
  try {
    const { question_text, options, correct_option_index, points, explanation } = req.body;
    if (!question_text || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, error: 'Question text and at least 2 options are required' });
    }

    const id = 'q-' + uuidv4().slice(0, 8);
    db.prepare(`
      INSERT INTO questions (id, quiz_id, question_text, options, correct_option_index, points, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.params.quizId,
      question_text,
      JSON.stringify(options),
      parseInt(correct_option_index) || 0,
      parseInt(points) || 1,
      explanation || ''
    );

    const created = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    created.options = JSON.parse(created.options);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Edit question
app.put('/api/questions/:id', (req, res) => {
  try {
    const { question_text, options, correct_option_index, points, explanation } = req.body;
    db.prepare(`
      UPDATE questions 
      SET question_text = COALESCE(?, question_text),
          options = COALESCE(?, options),
          correct_option_index = COALESCE(?, correct_option_index),
          points = COALESCE(?, points),
          explanation = COALESCE(?, explanation)
      WHERE id = ?
    `).run(
      question_text,
      options ? JSON.stringify(options) : undefined,
      correct_option_index !== undefined ? parseInt(correct_option_index) : undefined,
      points !== undefined ? parseInt(points) : undefined,
      explanation,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    if (!updated) return res.status(404).json({ success: false, error: 'Question not found' });
    updated.options = JSON.parse(updated.options);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete question
app.delete('/api/questions/:id', (req, res) => {
  try {
    const info = db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ success: false, error: 'Question not found' });
    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. ATTEMPT & EVALUATION SERVICE
// ==========================================
// Automatic grading engine (Slides 4 & 5)
app.post('/api/attempts/submit', (req, res) => {
  try {
    const { quiz_id, user_id, student_name, student_email, answers, started_at } = req.body;
    // answers format: { "q-id": 0, "q-id2": 2 }
    if (!quiz_id || !answers) {
      return res.status(400).json({ success: false, error: 'quiz_id and answers are required' });
    }

    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quiz_id);
    if (!quiz) return res.status(404).json({ success: false, error: 'Quiz not found' });

    const questions = db.prepare('SELECT * FROM questions WHERE quiz_id = ?').all(quiz_id);
    if (questions.length === 0) {
      return res.status(400).json({ success: false, error: 'Quiz has no questions' });
    }

    let earnedScore = 0;
    let totalScore = 0;
    const itemizedReview = [];

    questions.forEach(q => {
      const qOptions = JSON.parse(q.options);
      const points = q.points || 1;
      totalScore += points;

      const studentSelected = answers[q.id] !== undefined ? parseInt(answers[q.id]) : null;
      const isCorrect = studentSelected === q.correct_option_index;

      if (isCorrect) {
        earnedScore += points;
      }

      itemizedReview.push({
        question_id: q.id,
        question_text: q.question_text,
        options: qOptions,
        student_selected_index: studentSelected,
        student_selected_text: studentSelected !== null ? qOptions[studentSelected] : 'Unanswered',
        correct_option_index: q.correct_option_index,
        correct_option_text: qOptions[q.correct_option_index],
        is_correct: isCorrect,
        points_awarded: isCorrect ? points : 0,
        max_points: points,
        explanation: q.explanation
      });
    });

    const percentage = totalScore > 0 ? Math.round((earnedScore / totalScore) * 100 * 10) / 10 : 0;
    const passed = percentage >= quiz.passing_score ? 1 : 0;
    const attemptId = 'att-' + uuidv4().slice(0, 8);

    db.prepare(`
      INSERT INTO attempts (id, quiz_id, user_id, student_name, student_email, answers, score, max_score, percentage, passed, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attemptId,
      quiz_id,
      user_id || 'guest',
      student_name || 'Anonymous Student',
      student_email || 'student@domain.edu',
      JSON.stringify(answers),
      earnedScore,
      totalScore,
      percentage,
      passed,
      started_at || new Date().toISOString()
    );

    res.json({
      success: true,
      data: {
        attempt_id: attemptId,
        quiz_id,
        quiz_title: quiz.title,
        student_name: student_name || 'Anonymous Student',
        score: earnedScore,
        max_score: totalScore,
        percentage,
        passing_score: quiz.passing_score,
        passed: Boolean(passed),
        completed_at: new Date().toISOString(),
        review: itemizedReview
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List attempts / history
app.get('/api/attempts', (req, res) => {
  try {
    const { quiz_id, user_id } = req.query;
    let query = `
      SELECT 
        a.*,
        q.title as quiz_title,
        q.passing_score
      FROM attempts a
      JOIN quizzes q ON q.id = a.quiz_id
      WHERE 1=1
    `;
    const params = [];

    if (quiz_id) {
      query += ` AND a.quiz_id = ? `;
      params.push(quiz_id);
    }
    if (user_id) {
      query += ` AND a.user_id = ? `;
      params.push(user_id);
    }

    query += ` ORDER BY a.completed_at DESC`;

    const attempts = db.prepare(query).all(...params);
    res.json({ success: true, data: attempts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get attempt details with review breakdown
app.get('/api/attempts/:id', (req, res) => {
  try {
    const attempt = db.prepare(`
      SELECT a.*, q.title as quiz_title, q.category, q.passing_score
      FROM attempts a
      JOIN quizzes q ON q.id = a.quiz_id
      WHERE a.id = ?
    `).get(req.params.id);

    if (!attempt) return res.status(404).json({ success: false, error: 'Attempt not found' });

    const questions = db.prepare('SELECT * FROM questions WHERE quiz_id = ?').all(attempt.quiz_id);
    const answers = JSON.parse(attempt.answers);

    const review = questions.map(q => {
      const opts = JSON.parse(q.options);
      const studentSelected = answers[q.id] !== undefined ? answers[q.id] : null;
      const isCorrect = studentSelected === q.correct_option_index;
      return {
        question_id: q.id,
        question_text: q.question_text,
        options: opts,
        student_selected_index: studentSelected,
        student_selected_text: studentSelected !== null ? opts[studentSelected] : 'Unanswered',
        correct_option_index: q.correct_option_index,
        correct_option_text: opts[q.correct_option_index],
        is_correct: isCorrect,
        points: isCorrect ? q.points : 0,
        max_points: q.points,
        explanation: q.explanation
      };
    });

    res.json({
      success: true,
      data: {
        ...attempt,
        passed: Boolean(attempt.passed),
        review
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. SYSTEM STATS & METRICS
// ==========================================
app.get('/api/stats', (req, res) => {
  try {
    const totalQuizzes = db.prepare('SELECT count(*) as count FROM quizzes').get().count;
    const totalQuestions = db.prepare('SELECT count(*) as count FROM questions').get().count;
    const totalAttempts = db.prepare('SELECT count(*) as count FROM attempts').get().count;
    const passCount = db.prepare('SELECT count(*) as count FROM attempts WHERE passed = 1').get().count;
    const avgScore = db.prepare('SELECT ROUND(AVG(percentage), 1) as avg FROM attempts').get().avg || 0;

    res.json({
      success: true,
      data: {
        totalQuizzes,
        totalQuestions,
        totalAttempts,
        passRate: totalAttempts > 0 ? Math.round((passCount / totalAttempts) * 100) : 0,
        avgScore
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Quiz Microservice running on http://localhost:${PORT}`);
});

