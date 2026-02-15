# LinkVault Database Schema

## Overview

I'm using SQLite for this project because it's simple and doesn't
require a separate database server. The entire database is just one file
(`linkvault.db`) . 

------------------------------------------------------------------------

## Database Table

This is the only table in the database. It stores all uploaded content - both text and files.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (PRIMARY KEY) | Unique 10-character identifier for each share (generated using nanoid) |
| `type` | TEXT | Either 'text' or 'file' - tells us what kind of content this is |
| `content` | TEXT | For text uploads, this stores the actual text content |
| `cloudinary_url` | TEXT | For files, this is the Cloudinary URL where the file is stored |
| `cloudinary_public_id` | TEXT | Cloudinary's internal ID (needed to delete files later) |
| `original_name` | TEXT | Original filename (e.g., "my-photo.jpg") |
| `file_size` | INTEGER | File size in bytes |
| `expires_at` | DATETIME | When this content should be automatically deleted |
| `created_at` | DATETIME | When the content was uploaded (auto-set to current time) |
| `max_views` | INTEGER | Optional: maximum number of times text can be viewed |
| `current_views` | INTEGER | Counter for how many times text has been viewed |
| `max_downloads` | INTEGER | Optional: maximum number of times file can be downloaded |
| `current_downloads` | INTEGER | Counter for how many times file has been downloaded |
| `password` | TEXT | Optional: password to protect the content |

## Example Records

### Text Upload (with password)

``` json
{
  "id": "abc123xyz",
  "type": "text",
  "content": "This is my secret message",
  "expires_at": "2026-02-15T16:30:00.000Z",
  "created_at": "2026-02-15T16:20:00.000Z",
  "max_views": 5,
  "current_views": 2,
  "password": "secret123"
}
```

### File Upload

``` json
{
  "id": "def456uvw",
  "type": "file",
  "cloudinary_url": "https://res.cloudinary.com/.../file.pdf",
  "cloudinary_public_id": "linkvault/def456uvw_123456789",
  "original_name": "document.pdf",
  "file_size": 1048576,
  "expires_at": "2026-02-15T17:00:00.000Z",
  "created_at": "2026-02-15T16:50:00.000Z",
  "max_downloads": 3,
  "current_downloads": 1
}
```

------------------------------------------------------------------------

## Why This Design?

-   **Single table** -- Keeps things simple since there's no user
    authentication.
-   **Separate columns for text/file** -- Different content types need
    different fields.
-   **Expiry as DATETIME** -- Easy to compare with current time for
    cleanup.
-   **Counters for views/downloads** -- Lets me implement access limits
    without complex logic.
-   **Password optional** -- `NULL` means no password, simple to check.

------------------------------------------------------------------------

## Indexes

SQLite automatically indexes the PRIMARY KEY (`id`). This is enough
since all lookups are by ID.
