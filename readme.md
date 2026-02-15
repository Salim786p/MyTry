# LinkVault

## Secure File & Text Sharing — Updated

This repository contains LinkVault — a small, self-hosted secure sharing app that lets users upload text or files and share short-lived links. The project now includes optional user accounts (registration/login), ownership of uploads, and a "My Records" view for logged-in users.

Last updated: February 15, 2026

Tech Stack: React + Vite + Tailwind CSS — Node.js + Express — SQLite + Cloudinary

## Setup Instructions

## Prerequisites

-   Node.js (v18 or higher) -- https://nodejs.org
-   npm (comes with Node.js)
-   Cloudinary account (free) -- https://cloudinary.com
-   Git (optional)

------------------------------------------------------------------------

## Step 1: Clone Repository

``` bash
git clone https://github.com/Salim786p/25CS60R86_LinkValut.git
cd 25CS60R86_LinkValut
```

------------------------------------------------------------------------

## Step 2: Backend Setup

``` bash
cd backend
npm install
```

Create `.env` file in backend folder:

``` env
PORT=5000
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Get these from: **Cloudinary Dashboard → Settings → API Keys**

Start backend:

``` bash
npm run dev
# Server runs on http://localhost:5000
```

------------------------------------------------------------------------

## Step 3: Frontend Setup

Open a new terminal:

``` bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

------------------------------------------------------------------------

## Step 4: Using the Application

1.  Open http://localhost:5173
2.  Choose Text or File tab
3.  Enter content or select file
4.  (Optional) Set password or access limits
5.  Choose expiry time (10m, 1h, 1d, 7d)
6.  Click **Upload & Generate Secure Link**
7.  Copy and share the generated link

------------------------------------------------------------------------

## API Overview

Base URL: `http://localhost:5000/api`

- `POST /auth/register` — Register a user. Body: `{ email, password }`. Email format validated and duplicates rejected.
- `POST /auth/login` — Login. Body: `{ email, password }`. Returns JWT token (7d).
- `POST /upload/text` — Upload text. Optional auth; include `Authorization: Bearer <token>` to attach ownership.
- `POST /upload/file` — Upload file (multipart/form-data). Optional auth.
- `POST /share/:id/verify` — Verify content password (if set).
- `GET /share/:id` — Get share metadata and content (respects expiry and view limits).
- `GET /download/:id` — Download file (respects download limits and expiry).
- `DELETE /share/:id` — Delete a share (requires authentication; only owner).
- `GET /user/shares` — (Authenticated) list of active shares owned by the user.
- `GET /cleanup` — Manual trigger for cleanup (also runs hourly via cron job).

------------------------------------------------------------------------

## Design Decisions

## SQLite over MongoDB

I started with MongoDB Atlas but had connection issues. So I switched to SQLite. If something breaks, I delete the
file and it recreates.

## Cloudinary for File Storage

Storing files in SQLite would make the database huge. Cloudinary gives
10GB free, handles file optimizations, and provides CDN delivery. The
API is simple: upload file → get URL.

## Password Protection Flow

Content is only fetched after password verification. The `/verify`
endpoint checks password first. If wrong, the actual content is never
requested from database.

## Separate View and Download Limits

For text, "views" makes sense. For files, "downloads" makes more sense.
Having both gives flexibility.\
One-time view = `maxViews:1`\
One-time download = `maxDownloads:1`

## Automatic Cleanup

Content expires based on `expiryAt` column. A cron job runs every hour
deleting expired records from both SQLite and Cloudinary.

## 403 for Invalid Links

The requirement specifies 403 (Forbidden) for invalid links, not 404.
This indicates the resource exists but can't be accessed.

## Rate Limiting

Prevents brute force guessing of links: 100 requests per 15 minutes per
IP for share/download endpoints.

## File Type Validation

Blocks dangerous extensions: `.exe`, `.bat`, `.sh`, `.js`, `.jar`,
`.php`. Only safe files allowed.

## User Accounts & "My Records"

Authentication is optional: users can register and log in to the app. When authenticated, uploads are recorded with an `owner_id` and the frontend exposes a **My Records** view where the user can see their active (non-expired) uploads and delete them. Share pages remain guest-first (visiting a link does not auto-apply your session) to avoid accidental management access when opening shared links.

------------------------------------------------------------------------

## Assumptions and Limitations

## Assumptions

1.  Links are shared responsibly - anyone with the link can access
	content
2.  Filenames are safe - dangerous extensions blocked but filenames
	assumed non-malicious
3.  10-character IDs are sufficient - 58 possible characters
	(A-Za-z0-9-) gives 4.3 quadrillion combinations
4.  10-minute default expiry works - users can change it if needed
5.  Passwords are case-sensitive - "Secret123" ≠ "secret123".

------------------------------------------------------------------------

## Limitations

This project is designed as a functional prototype and has a few deliberate constraints:

* **Storage & Upload Limits:** File uploads are capped at 100MB and rely entirely on Cloudinary availability. Executable files are blocked for security, and text snippets are limited to 10,000 characters.
* **Security & Auth:** The authentication system is minimal (no email verification, no password resets, single-session only). While user passwords use `bcrypt`, *share-level* passwords are currently stored in plaintext. 
* **Scalability:** SQLite and IP-based rate-limiting are used for simplicity. This is not designed for high write-concurrency, and extreme simultaneous access may cause view/download counters to be off by ±1.
* **Background Tasks & UI:** Expired content is purged via an hourly background cron job, meaning deletion is not strictly instantaneous. Additionally, the user dashboard currently lacks search or filtering features.

------------------------------------------------------------------------
