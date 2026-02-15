\# LinkVault Database Schema



\## Overview

I'm using SQLite for this project because it's simple and doesn't require a separate database server. The entire database is just one file (`linkvault.db`) .



\## Database Table:



This is the only table in the database. It stores all uploaded content - both text and files.



| Column | Type | Description |

|--------|------|-------------|

| `id` | TEXT (PRIMARY KEY) | Unique 10-character identifier for each share (generated using nanoid) |

| `type` | TEXT | Either 'text' or 'file' - tells us what kind of content this is |

| `content` | TEXT | For text uploads, this stores the actual text content |

| `cloudinary\_url` | TEXT | For files, this is the Cloudinary URL where the file is stored |

| `cloudinary\_public\_id` | TEXT | Cloudinary's internal ID (needed to delete files later) |

| `original\_name` | TEXT | Original filename (e.g., "my-photo.jpg") |

| `file\_size` | INTEGER | File size in bytes |

| `expires\_at` | DATETIME | When this content should be automatically deleted |

| `created\_at` | DATETIME | When the content was uploaded (auto-set to current time) |

| `max\_views` | INTEGER | Optional: maximum number of times text can be viewed |

| `current\_views` | INTEGER | Counter for how many times text has been viewed |

| `max\_downloads` | INTEGER | Optional: maximum number of times file can be downloaded |

| `current\_downloads` | INTEGER | Counter for how many times file has been downloaded |

| `password` | TEXT | Optional: password to protect the content |



\## Example Records



\### Text Upload (with password)

```json

{

&nbsp; "id": "abc123xyz",

&nbsp; "type": "text",

&nbsp; "content": "This is my secret message",

&nbsp; "expires\_at": "2026-02-15T16:30:00.000Z",

&nbsp; "created\_at": "2026-02-15T16:20:00.000Z",

&nbsp; "max\_views": 5,

&nbsp; "current\_views": 2,

&nbsp; "password": "secret123"

}

