# PDF Merger Application - Premium SaaS

A production-ready, modern, responsive, and professional web-based PDF Merger application. This application allows users to upload multiple PDF files, automatically preserves their upload order, enables drag-and-drop reordering with Framer Motion, renders client-side page previews via PDF.js, and merges them securely on an Express backend using `pdf-lib`.

Inspired by the design aesthetics of Stripe, Vercel, Linear, and Apple, the user interface features clean glassmorphism styling, micro-animations, a responsive statistics dashboard, a custom save-filename facility, and fully responsive layouts with automatic light/dark mode theme synchronization.

---

## Technical Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, React Dropzone, Lucide Icons, PDF.js (Client-side rendering).
- **Backend**: Node.js, Express, TypeScript, Multer, `pdf-lib` (Preserves text quality, vectors, and layouts).
- **Orchestration / Deployment**: Docker, Docker Compose, Nginx.

---

## Core Features

1. **Multi-PDF Upload**: Drag-and-drop or file browser uploads up to 100 PDFs, supporting up to 100MB per file.
2. **Local Preview Generation**: Instantly renders the first page of each PDF as a thumbnail canvas directly in the browser to avoid server load and network delay.
3. **Upload Progress Indicators**: Interactive individual upload percentage trackers driven by XMLHttpRequests.
4. **Sequence Preservation & Drag-and-Drop Reordering**: Preserves file upload order natively. Reorders easily using Framer Motion's `Reorder` component with smooth animations.
5. **PDF Modification Controls**: Easily duplicate a PDF reference (re-uses backend file with no extra upload cost), delete entries, or replace cards in-place.
6. **Statistics Dashboard**: Real-time aggregated statistics for total files, pages, size, and estimated output size.
7. **Custom Merging Engine**: Performs sequential page compilation on the backend using disk storage (safe against large file memory leaks). Preserves links, form fields, vectors, fonts, and orientations.
8. **Rename & Download Screen**: Interactive final page with custom filename input, success state confetti, and quick reset.
9. **Dark Mode Theme Sync**: Automatic system preference detection with support for manual toggles.

---

## Project Directory Structure

```
pdf-merger/
├── backend/
│   ├── src/
│   │   ├── index.ts        # Express server entry point
│   │   ├── routes.ts       # API router with file upload & cleanup endpoints
│   │   └── merger.ts       # pdf-lib PDF merging logic
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile          # Production multi-stage node builder
├── frontend/
│   ├── src/
│   │   ├── components/     
│   │   │   ├── Dropzone.tsx         # Drag & drop glassmorphism area
│   │   │   ├── FileCard.tsx         # Draggable PDF card with metadata & actions
│   │   │   ├── StatsDashboard.tsx   # Aggregated metrics grid
│   │   │   └── ThemeToggle.tsx      # Light/Dark/System switcher
│   │   ├── utils/          
│   │   │   └── pdf.ts               # PDF.js client thumbnail renderer
│   │   ├── App.tsx                  # Main controller & workflow state coordinator
│   │   ├── index.css                # Stylesheet with custom animations & scrollbars
│   │   └── main.tsx                 # React DOM mount root
│   ├── index.html                   # HTML entry point loading Inter font
│   ├── nginx.conf                   # Nginx config for SPA routing & API forwarding
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile                   # Vite build + Nginx deployment
├── docker-compose.yml               # Container orchestrator
└── README.md                        # Documentation
```

---

## Getting Started

You can run this project either using **Docker Compose** (recommended for production testing) or **Locally on your machine** (for development).

### Method 1: Using Docker Compose (Recommended)

1. Ensure you have **Docker** and **Docker Compose** installed on your system.
2. In the root directory (where `docker-compose.yml` is located), run:
   ```bash
   docker-compose up --build
   ```
3. Docker will build the frontend and backend services:
   - **Frontend App**: accessible at `http://localhost:3000`
   - **Backend API**: accessible at `http://localhost:3001`
4. Use the app! All calls to `/api/*` from the frontend container are automatically forwarded to the backend container via Nginx.

---

### Method 2: Running Locally

To run the application locally without Docker, you will need **Node.js (v18+)** installed.

#### 1. Setup Backend
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Express development server:
   ```bash
   npm run dev
   ```
   The backend server will run on `http://localhost:3001`.

#### 2. Setup Frontend
1. Open a second terminal window and navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   The frontend application will start on `http://localhost:5173`.
4. Open your browser and navigate to `http://localhost:5173`. All backend calls are proxied automatically to `http://localhost:3001` by Vite.

---

## Environment Configuration

- **Backend Port**: Customizable by adding a `.env` file in the `backend/` directory:
  ```env
  PORT=3001
  NODE_ENV=development
  ```

---

## Security and Performance Optimizations

1. **Memory Safety**: Multer utilizes disk storage for uploads, ensuring the server doesn't run out of memory (OOM crash) when merging huge or high-volume PDF files.
2. **Auto-Cleanup**: A background task deletes temporary files that are older than 30 minutes on a cron-like interval. File deletion is also triggered when users clear lists or replace documents.
3. **Client-Side Virtual Previews**: Thumbnail renders are computed inside the user's browser, preventing CPU and memory strain on the Node.js API server.
4. **MIME Validations**: Express enforces extensions (`.pdf`) and MIME types (`application/pdf`) checks, avoiding arbitrary file uploads.
