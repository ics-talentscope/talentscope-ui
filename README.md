# TalentScope UI (Frontend)

The TalentScope web interface is built with **Next.js (App Router)**, **React 18**, **TypeScript**, and **TailwindCSS**.

It acts as the single-origin client interface for candidates, employees, and administrators. All API requests under `/api/*` are reverse-proxied by Next.js to the Python FastAPI backend. Set `BACKEND_URL` to the Render API URL when building for Vercel; local development defaults to `http://127.0.0.1:8000`.

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
All client calls target `/api/...` on the UI origin. The rewrite destination is captured when Next.js builds, so set `BACKEND_URL` during the build. Docker Compose passes `http://python:8000` as a build argument; Vercel builds require `BACKEND_URL`; local development defaults to `http://127.0.0.1:8000`. Configured in `next.config.mjs`:
```javascript
async rewrites() {
  const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
  return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
}
```

### Deploy to Vercel

Push the contents of this folder as the UI repository and import that repository into Vercel. Use the repository root as the project root, keep the Next.js build command (`npm run build`), and add `BACKEND_URL` to the Vercel build environment variables with the Python Render service's HTTPS URL. The build fails explicitly if `BACKEND_URL` is missing on Vercel. Do not use a `NEXT_PUBLIC_` prefix; the API URL is used by the server-side rewrite.

---

## 🚀 Running the UI

### 1. Install Dependencies
```powershell
cd ui
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

### 4. Refresh the Python skill-match bundle (combined checkout only)
The Python service includes a compiled Node bundle for server-side skill matching. From the combined workspace, if the shared matching logic changes:
```powershell
npm run build:skill-match
```
This optional development command expects the `python` folder beside `ui`; it is not part of the Vercel build.

---

## 🛠️ Frontend Troubleshooting

### 1. `Fetch failed / 502 Bad Gateway on /api/*`
- **Cause**: The FastAPI backend is not running on port 8000.
- **Fix**: Start the backend in a separate terminal:
  ```powershell
  cd ..\python
  .\.venv\Scripts\uvicorn.exe main:app --port 8000 --reload
  ```

### 2. Admin Login: "Admin password not setup"
- **Cause**: `ADMIN_PASSWORD` or `SCREENING_ADMIN_PASSWORD` is blank in the Python service environment.
- **Fix**: Set non-empty values in the Python service's environment and restart the backend.

### 3. Stale State / Blank Screen / Build Cache
- **Fix**: Clear `.next` build cache:
  ```powershell
  Remove-Item -Recurse -Force .next
  npm run dev
  ```

### 4. Video Recording / Proctoring Not Starting
- **Cause**: Browser permissions for Camera / Microphone / Screen Share were denied.
- **Fix**: Grant Camera, Microphone, and Display Capture permissions in your browser address bar settings.