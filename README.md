# QuizForms — Full-Stack Google Forms-Style Timed Quiz & Exam Platform

QuizForms is a high-concurrency, full-stack web application designed for creating, hosting, and automatically grading timed multiple-choice practice exams (optimized for 200+ concurrent students per test). It features a clean, familiar **Google Forms layout** for both instructors and student test takers, along with an **AI-powered PDF-to-Quiz importer** with an integrated diagram cropper.

---

## 🚀 Key Features

### 1. Google Forms-Style Visual Design & Architecture
- **Soft Lavender Background** (`#f0ebf8`), single-column centered white rounded cards (`max-w-3xl`), crisp 1px borders, and purple accent top banner (`#673ab7`).
- **Floating Vertical Toolbar** beside the active question card:
  - ➕ Add Question
  - 🖼️ Attach Diagram Image
  - 📄 Import from PDF (Gemini AI OCR)
  - 📋 Bulk JSON Import
  - 📄 Duplicate Question
  - 🗑️ Delete Question
- Fully responsive across mobile phones, tablets, and desktop displays.

### 2. High Concurrency & Free-Tier Optimization (200+ Students per Test)
- **Zero Firestore `onSnapshot` listeners** on student quiz pages to eliminate listener quotas.
- **Strict 3-Request Budget per student session:**
  1. **1 Read**: Fetch quiz questions on initial load (`getQuiz`).
  2. **1 Write**: Record attempt session on test start (`createAttempt`).
  3. **1 Write**: Final submission and grading update (`submitAttempt`).
- **Instant LocalStorage Persistence**: Selected answers are continuously saved to client `localStorage` keyed by `attemptId`. Accidental tab refreshes, network drops, or power loss never erase student progress.
- **Server-Anchored Countdown Timer**: Time remaining is computed from server timestamps (`expiresAt = startedAt + durationMinutes`). Refreshing the tab calculates from the server deadline, preventing timer tampering or extension.
- **Auto-Submit on Expiry**: Automatically submits student answers when the countdown hits `00:00`.

### 3. Automatic PDF-to-Quiz Importer & Diagram Cropper
- **Gemini AI Extraction (`/api/import-pdf`)**:
  - Leverages `@google/genai` (Gemini 2.5 Flash) server-side to extract 100+ questions from complex exam PDFs.
  - Automatically parses multi-column layouts, end-of-paper answer keys, and explanations.
  - Flags questions that reference diagrams with their PDF page numbers.
- **Interactive Diagram Cropper**:
  - Uses `pdfjs-dist` to render PDF pages onto an interactive canvas.
  - Teachers can drag-and-crop diagrams in one click and attach them directly to the corresponding question.
- **Quality Warnings**: Highlights missing choices, option mismatches, or ambiguous answer keys before publishing.
- **Bulk JSON Alternative**: Paste a JSON array directly for rapid question imports.

### 4. Comprehensive Responses & Analytics Dashboard (`/admin/responses/[quizId]`)
- **Key Summary Metrics**: Total Responses, Average Score, Highest Score, Lowest Score, Average Time Taken.
- **Searchable & Sortable Student Submissions Table**: Filter by student name or roll number/email; sort by score, percentage, time taken, or submission date.
- **Interactive Graded Response Inspection**: Click any student row to view their entire paper with correct/incorrect highlights, student selections, and answer explanations.
- **One-Click CSV Export**: Downloads a complete grade report spreadsheet with student names, identifiers, scores, percentages, and timestamps.

### 5. Local Demo / Mock Mode Fallback
- Runs immediately without requiring Firebase or Gemini credentials.
- Includes pre-populated sample quizzes, mock student attempts, simulated PDF extraction, and canvas diagram cropping.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router, TypeScript, React 19)
- **Styling**: Tailwind CSS 4 with Google Forms design system
- **Backend / Database**: Cloud Firestore (NoSQL)
- **Storage**: Firebase Storage (Diagrams & Assets)
- **Authentication**: Firebase Auth (Google Sign-In for Admin)
- **AI OCR & Extraction**: `@google/genai` (Google Gemini API)
- **PDF Rendering**: `pdfjs-dist`

---

## 🏁 Quick Start & Local Setup

### 1. Clone & Install Dependencies
```bash
cd formsV2
npm install
```

### 2. Run in Demo Mode (Zero Config)
Leave `.env.local` unset. Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Home**: [http://localhost:3000](http://localhost:3000)
- **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Sample Quiz (Student View)**: [http://localhost:3000/quiz/demo-quiz-1](http://localhost:3000/quiz/demo-quiz-1)
- **Responses & CSV Export**: [http://localhost:3000/admin/responses/demo-quiz-1](http://localhost:3000/admin/responses/demo-quiz-1)

### 3. Configure Production Firebase & Gemini Credentials
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```
Fill in your credentials:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

NEXT_PUBLIC_ADMIN_EMAIL=instructor@gmail.com
GEMINI_API_KEY=AIzaSy...
```

Deploy Firestore and Storage security rules:
```bash
firebase deploy --only firestore:rules,storage
```

---

## 🚢 Free Deployment to Vercel

1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com/).
3. Add the environment variables from `.env.local` into the Vercel Dashboard under **Project Settings > Environment Variables**.
4. Click **Deploy**. Your app is live with high-concurrency serverless scaling!
