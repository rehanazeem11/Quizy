# Quiz Service — Microservice Online Assessment Platform

A fully decoupled, modular online quiz and assessment engine developed directly from the system specifications in **Quiz-Service.pdf** ("Microservice Design College Presentation").

---

## 🎯 PDF Architecture & Requirements Analysis

The presentation outlines the motivation, architecture, and core MVP workflow for separating Quiz Management into a standalone microservice:

| Slide | Topic | Implementation in Platform |
|---|---|---|
| **Slide 1 & 2** | *Core Idea: One service, one clear job* | Dedicated `Quiz Service` owning the entire quiz lifecycle: quiz creation, MCQ management, student attempts, and automated grading. |
| **Slide 3** | *The Problem: Manual Quiz Management Does Not Scale* | Elimination of manual grading with instant algorithmic evaluation, automated scorecards, and persistent attempt tracking. |
| **Slide 4** | *Target State: Create, Manage, Attempt, Evaluate, Report* | Full 5-stage lifecycle implemented across Admin Studio and Student Runner. |
| **Slide 5** | *MVP Scope & UI Layout* | Pixel-accurate recreation of the interactive quiz taker with progress headers (`QUESTION 03 OF 10 30%`), 4-option cards, countdown timer, and answer submission. |
| **Slide 6** | *Service Boundaries* | Decoupled architecture separating **Client**, **Quiz Service**, **Auth/User Service**, and **Result Service** over REST/JSON. |
| **Slide 7** | *End-to-End Flow* | Seamless flow: Admin creates quiz ➔ Student logs in ➔ Takes quiz ➔ Submits answers ➔ Evaluates automatically ➔ Displays score breakdown. |
| **Slide 8** | *Practical Tech Stack* | High-performance REST API with persistent relational database (SQLite/MySQL compatible schema) + built-in interactive Postman-style API explorer. |
| **Slide 9 & 10** | *Modularity & Future Scalability* | Decoupled endpoints ready for containerization, load balancing, and independent scaling. |

---

## 🚀 Features

### 1. Student Assessment Runner (Slide 5)
- **Live Progress Tracking**: Displays `QUESTION XX OF YY`, completion percentage bar, and point values.
- **Interactive MCQ Cards**: Option cards with radio selector indicators and responsive keyboard selection.
- **Timed Quizzes**: Automatic countdown timer with alert styling and auto-submit on expiry.
- **Question Navigator**: Quick jump palette indicating answered, current, and unanswered questions.

### 2. Instant Automated Evaluation Engine (Slide 4 & 7)
- Immediate pass/fail scoring based on passing threshold percentage.
- Question-by-question breakdown comparing student choices with verified answer keys.
- Clear explanations for every question to support self-learning.
- Persistent attempt records stored in SQLite database.

### 3. Admin Studio
- **Quiz Management**: Create, edit, publish/unpublish, and delete quizzes.
- **Question Bank Builder**: Add MCQs with 4 options, designate correct answer keys, assign point values, and add explanations.
- **Evaluation Logs & Gradebook**: Real-time log of student attempts with timestamps, scores, and review links.

### 4. Interactive API Playground (Slide 8 Postman Alternative)
- Built-in live API console to test `GET /api/quizzes`, `POST /api/attempts/submit`, `GET /api/stats`, and `GET /api/quizzes/:id/for-attempt` with formatted JSON inspection.

---

## 🛠️ Quick Start

### 1. Prerequisites
- Node.js (v18+ or v24)
- npm

### 2. Run the Platform
```bash
# Navigate to the project directory
cd "c:\Users\lenovo\Desktop\quiz thingy"

# Start the server (already seeded with sample quizzes)
npm start
```

### 3. Open in Browser
Visit **[http://localhost:4000](http://localhost:4000)** in any web browser.

---

## 📡 REST API Endpoints

- `GET /api/quizzes` — List published quizzes (or all for admin)
- `GET /api/quizzes/:id/for-attempt` — Secure quiz bundle for student (correct keys stripped)
- `POST /api/quizzes` — Create new quiz (Admin)
- `PUT /api/quizzes/:id` — Update quiz metadata or publish status
- `DELETE /api/quizzes/:id` — Delete quiz
- `GET /api/quizzes/:quizId/questions` — List questions with answer keys (Admin)
- `POST /api/quizzes/:quizId/questions` — Add new question with options and key
- `POST /api/attempts/submit` — Submit answers for auto-grading
- `GET /api/attempts` — List all attempts or filter by student
- `GET /api/attempts/:id` — Get detailed scorecard and question review
- `GET /api/stats` — Overall platform analytics

