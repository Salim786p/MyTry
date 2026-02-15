# LinkVault

## A Secure File and Text Sharing Application

### Full Stack Development Project

**February 15, 2026**

**Tech Stack:**\
React + Vite + Tailwind --- Node.js + Express --- SQLite + Cloudinary

------------------------------------------------------------------------

# Setup Instructions

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

# API Overview

**Base URL:** `http://localhost:5000/api`

------------------------------------------------------------------------

## Health Check

``` http
GET /health
```

Response:

``` json
{
  "status": "OK",
  "database": "SQLite",
  "storage": "Cloudinary"
}
```

------------------------------------------------------------------------

## Upload Text

``` http
POST /upload/text
Content-Type: application/json
```

``` json
{
  "content": "Your text here",
  "expiry": "10m",
  "maxViews": 5,
  "password": "secret123"
}
```

Expiry options: `10m`, `1h`, `1d`, `7d`
Default expiry: `10m`

------------------------------------------------------------------------

## Upload File

``` http
POST /upload/file
Content-Type: multipart/form-data
```

FormData:

-   file: (binary file)
-   expiry: "10m"
-   maxViews: 5 (optional)
-   maxDownloads: 3 (optional)
-   password: "secret123"

------------------------------------------------------------------------

## Verify Password

``` http
POST /share/:id/verify
Content-Type: application/json
```

``` json
{
  "password": "user_input"
}
```

Responses:

-   Protected & correct:

``` json
{
  "protected": true,
  "verified": true
}
```

-   Not protected:

``` json
{
  "protected": false
}
```

-   Wrong password:

``` json
{
  "protected": true,
  "verified": false
}
```

HTTP Status: `401`

------------------------------------------------------------------------

## Get Content

``` http
GET /share/:id
```

### Text Response

``` json
{
  "type": "text",
  "content": "...",
  "expiresAt": "...",
  "isProtected": false
}
```

### File Response

``` json
{
  "type": "file",
  "fileName": "document.pdf",
  "fileSize": 1048576,
  "downloadUrl": "...",
  "expiresAt": "..."
}
```

------------------------------------------------------------------------

## Download File

``` http
GET /download/:id
```

Returns file with original filename preserved.

------------------------------------------------------------------------

## Manual Cleanup

``` http
GET /cleanup
```

Triggers deletion of expired content.

------------------------------------------------------------------------

# Design Decisions

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

------------------------------------------------------------------------

# Assumptions and Limitations

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

1.  No user accounts - cannot track uploads or manage content.
2.  100MB file size limit - due to Cloudinary free tier and server
    considerations.
3.  Cloudinary dependency - if Cloudinary fails, downloads fail.
4.  SQLite not for scale - concurrent writes become bottleneck.
5.  No HTTPS locally - production would require SSL.
6.  Passwords stored in plaintext - in production would hash with
    bcrypt.
7.  Basic rate limiting - IP-based limits only.

------------------------------------------------------------------------

# What's Not Included

-   User authentication
-   Custom URL slugs
-   Bulk upload
