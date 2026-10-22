# TalentScope UI (Frontend)

The TalentScope web interface is built with **Next.js 14 (App Router)**, **React 18**, **TypeScript**, and **TailwindCSS**.

It acts as the single-origin client interface for candidates, employees, and administrators. All API requests under `/api/*` are transparently reverse-proxied by Next.js to the Python FastAPI backend (`BACKEND_URL`, default `http://127.0.0.1:8000`).

---

## 🏗️ Architecture & Features

### 1. Portals & Workflows
- **Candidate Screening Portal (`/`)**:
  - Drag-and-drop resume upload (PDF, DOC, DOCX).
  - Client-side heuristic analysis and ATS compatibility scoring.
  - Interactive radar charts, weakness detection, and bullet point enhancement suggestions.
  - Technical interview questions and candidate audio/video proctored assessments.
- **Admin Screening & Talent Management Console (`/admin`)**:
  - 📋 **Requirements (BR / JD)**: Ingest, preview, and edit JDs and Auto Req IDs.
  - 👥 **Corp Pool**: Employee roster viewer with instant JD-to-employee percentage match scoring.
  - ✅ **Suitable / Non-Suitable Candidates**: Filtered candidate pool by requirement threshold.
  - 🎓 **Employee Assessment Portal**: Monitor employee progress, review test question assignments, and playback proctoring recordings.
  - ✉️ **Email Outbox**: Real-time log of dispatched candidate invitation emails.
- **Employee Portal (`/employee`)**:
  - Internal skill assessments, MCQ learning quizzes, video proctoring, and SAML 2.0 Single Sign-On.

### 2. Single Origin API Proxy
All client calls target `/api/...` on origin `http://localhost:3000`. The rewrite destination is captured when Next.js starts or builds, so set `BACKEND_URL` before starting the dev server or building. In this workspace, `next.config.mjs` loads it from the root `.env.local`; Docker Compose passes `http://python:8000` as a build argument. Local development defaults to `http://127.0.0.1:8000` only when no `BACKEND_URL` is configured. Restart the dev server after changing the value. Configured in `next.config.mjs`:
```javascript
async rewrites() {
  const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
  return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
}
```

---

## 🚀 Running the UI

### 1. Install Dependencies
```powershell
cd UI
npm install
```

### 2. Start Development Server
```powershell
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Type-Checking & Linting
```powershell
npm run typecheck
npm run lint
```

### 4. Build Skill-Match Engine
If changes are made to [`src/lib/skill-match.ts`](file:///src/lib/skill-match.ts), rebuild the compiled commonjs bundle used by the Python backend:
```powershell
npm run build:skill-match
```

---

## 🛠️ Frontend Troubleshooting

### 1. `Fetch failed / 502 Bad Gateway on /api/*`
- **Cause**: The FastAPI backend is not running on port 8000.
- **Fix**: Start the backend in a separate terminal:
  ```powershell
  cd python
  .\venv\Scripts\uvicorn.exe main:app --port 8000 --reload
  ```

### 2. Admin Login: "Admin password not setup"
- **Cause**: `ADMIN_PASSWORD` or `SCREENING_ADMIN_PASSWORD` is blank in root `.env.local`.
- **Fix**: Open `.env.local`, set non-empty passwords, and restart the backend.

### 3. Stale State / Blank Screen / Build Cache
- **Fix**: Clear `.next` build cache:
  ```powershell
  Remove-Item -Recurse -Force .next
  npm run dev
  ```

### 4. Video Recording / Proctoring Not Starting
- **Cause**: Browser permissions for Camera / Microphone / Screen Share were denied.
- **Fix**: Grant Camera, Microphone, and Display Capture permissions in your browser address bar settings.