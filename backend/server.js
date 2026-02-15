const cron = require('node-cron');
const { validateUpload, validateShareId } = require('./validation');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { nanoid } = require('nanoid');
const multer = require('multer');
const cloudinary = require('./cloudinary');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_prod';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// SQLite Database
const db = new Database('linkvault.db');

// Create tables with all columns
db.exec(`
  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    type TEXT CHECK(type IN ('text', 'file')),
    content TEXT,
    cloudinary_url TEXT,
    cloudinary_public_id TEXT,
    original_name TEXT,
    file_size INTEGER,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    max_views INTEGER,
    current_views INTEGER DEFAULT 0,
    max_downloads INTEGER,
    current_downloads INTEGER DEFAULT 0,
    password TEXT
    , owner_id TEXT
  )
`);

console.log('✅ Database initialized with all columns');

// Auto cleanup job - runs every hour
cron.schedule('0 * * * *', async () => {
  console.log('🔄 Running automatic cleanup of expired content...');
  
  try {
    const now = new Date().toISOString();
    
    // Get expired files
    const expiredFiles = db.prepare(`
      SELECT * FROM shares 
      WHERE expires_at < ? AND type = 'file' AND cloudinary_public_id IS NOT NULL
    `).all(now);
    
    // Delete from Cloudinary
    for (const file of expiredFiles) {
      try {
        await cloudinary.uploader.destroy(file.cloudinary_public_id);
        console.log(`🗑️ Deleted from Cloudinary: ${file.cloudinary_public_id}`);
      } catch (err) {
        console.error(`Failed to delete ${file.cloudinary_public_id}:`, err.message);
      }
    }
    
    // Delete all expired from database
    const result = db.prepare('DELETE FROM shares WHERE expires_at < ?').run(now);
    
    if (result.changes > 0) {
      console.log(`✅ Auto-cleanup: ${result.changes} expired items removed`);
    }
  } catch (error) {
    console.error('❌ Auto-cleanup error:', error);
  }
});

console.log('⏰ Auto-cleanup scheduled (runs every hour)');

// Ensure `owner_id` column exists (for older DBs)
(() => {
  try {
    const cols = db.prepare("PRAGMA table_info('shares')").all();
    const hasOwner = cols.some(c => c.name === 'owner_id');
    if (!hasOwner) {
      db.exec('ALTER TABLE shares ADD COLUMN owner_id TEXT');
      console.log('🔧 Added owner_id column to shares table');
    }
  } catch (err) {
    console.error('Failed to ensure owner_id column:', err.message);
  }
})();

// File upload setup (temporary storage for Cloudinary)
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Helper function to calculate expiry
const getExpiryDate = (expiryOption) => {
  const now = new Date();
  const options = {
    '10m': 10 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };
  return new Date(now.getTime() + (options[expiryOption] || 10 * 60 * 1000));
};

// Helper to generate unique ID
const generateId = () => {
  let id;
  let exists = true;
  
  while (exists) {
    id = nanoid(10);
    const stmt = db.prepare('SELECT id FROM shares WHERE id = ?');
    exists = !!stmt.get(id);
  }
  
  return id;
};

// --- Authentication helpers ---
const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
};

const authenticateToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return next(); // allow anonymous for public endpoints

  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, email: payload.email };
  } catch (err) {
    // invalid token - ignore and continue as anonymous
    console.warn('Invalid token provided');
  }
  next();
};

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
};

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: 'SQLite',
    storage: 'Cloudinary',
    timestamp: new Date() 
  });
});

// --- User auth ---
// Create users table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const userId = nanoid(10);
    const stmt = db.prepare('INSERT INTO users (id, email, password) VALUES (?, ?, ?)');
    stmt.run(userId, email, hashed);

    const token = generateToken({ id: userId, email });
    res.json({ success: true, token, user: { id: userId, email } });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken({ id: user.id, email: user.email });
    res.json({ success: true, token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 7. List current user's shares (records)
app.get('/api/user/shares', authenticateToken, requireAuth, async (req, res) => {
  try {
    const ownerId = req.user.id;
    const now = new Date().toISOString();

    // Get all shares for the user
    const stmt = db.prepare('SELECT * FROM shares WHERE owner_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(ownerId);

    const activeShares = [];

    for (const share of rows) {
      // If expired, clean up (delete cloudinary and DB row)
      if (share.expires_at && new Date(share.expires_at) <= new Date()) {
        if (share.cloudinary_public_id) {
          try { await cloudinary.uploader.destroy(share.cloudinary_public_id); } catch (e) { console.error('Cleanup delete error:', e.message); }
        }
        db.prepare('DELETE FROM shares WHERE id = ?').run(share.id);
        continue; // skip expired
      }

      activeShares.push({
        id: share.id,
        type: share.type,
        createdAt: share.created_at,
        expiresAt: share.expires_at,
        isProtected: !!share.password,
        fileName: share.original_name || null,
        fileSize: share.file_size || null,
        link: `http://localhost:5173/share/${share.id}`
      });
    }

    res.json({ success: true, shares: activeShares });
  } catch (err) {
    console.error('User shares error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user shares' });
  }
});

// 2. Upload text
app.post('/api/upload/text', authenticateToken, validateUpload, async (req, res) => {
  try {
    const { content, expiry = '10m', maxViews, password } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    const id = generateId();
    const expiresAt = getExpiryDate(expiry);

    const stmt = db.prepare(`
      INSERT INTO shares (id, type, content, expires_at, max_views, current_views, password, owner_id)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const ownerId = req.user ? req.user.id : null;
    stmt.run(id, 'text', content.trim(), expiresAt.toISOString(), maxViews || null, password || null, ownerId);

    res.json({
      success: true,
      id,
      link: `http://localhost:5173/share/${id}`,
      expiresAt,
      type: 'text',
      isProtected: !!password
    });

  } catch (error) {
    console.error('Text upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Upload file to Cloudinary
app.post('/api/upload/file', authenticateToken, upload.single('file'), validateUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }
    
    const { expiry = '10m', maxViews, maxDownloads, password } = req.body;
    const id = generateId();
    const expiresAt = getExpiryDate(expiry);
    
    // Determine resource type based on file extension
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const isImage = imageExtensions.includes(fileExt);
    
    // Upload to Cloudinary with correct resource type
    const uploadOptions = {
      folder: 'linkvault',
      public_id: `${id}_${Date.now()}`,
      resource_type: isImage ? 'image' : 'raw'
    };
    
    const result = await cloudinary.uploader.upload(req.file.path, uploadOptions);
    
    // For raw files (PDFs, docs, etc.), use raw URL format
    let fileUrl = result.secure_url;
    if (!isImage) {
      fileUrl = result.secure_url.replace('/image/upload/', '/raw/upload/');
    }
    
    // Remove temp file
    fs.unlinkSync(req.file.path);
    
    // Store in SQLite (include owner_id)
    const stmt = db.prepare(`
      INSERT INTO shares (id, type, cloudinary_url, cloudinary_public_id, original_name, file_size, expires_at, max_views, max_downloads, current_views, current_downloads, password, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `);

    const ownerId = req.user ? req.user.id : null;

    stmt.run(
      id,
      'file',
      fileUrl,
      result.public_id,
      req.file.originalname,
      req.file.size,
      expiresAt.toISOString(),
      maxViews || null,
      maxDownloads || null,
      password || null,
      ownerId
    );
    
    res.json({
      success: true,
      id,
      link: `http://localhost:5173/share/${id}`,
      expiresAt,
      type: 'file',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      cloudinaryUrl: fileUrl,
      isProtected: !!password
    });
    
  } catch (error) {
    console.error('File upload error:', error);
    // Clean up temp file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'File upload failed: ' + error.message });
  }
});

// 4. Verify password for protected links
app.post('/api/share/:id/verify', validateShareId, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    const share = db.prepare('SELECT password FROM shares WHERE id = ?').get(id);
    
    if (!share) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!share.password) {
      return res.json({ protected: false });
    }
    
    if (password === share.password) {
      return res.json({ protected: true, verified: true });
    } else {
      return res.status(401).json({ protected: true, verified: false });
    }
    
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// 5. Get content by ID
app.get('/api/share/:id', authenticateToken, validateShareId, async (req, res) => { 
  try {
    const { id } = req.params;
    
    const stmt = db.prepare('SELECT * FROM shares WHERE id = ?');
    const share = stmt.get(id);
    
    if (!share) {
      return res.status(403).json({ error: 'Access denied' }); 
    }
    
    // Check view limit
    if (share.max_views !== null) {
      const currentViews = share.current_views || 0;
      if (currentViews >= share.max_views) {
        // Delete content
        if (share.cloudinary_public_id) {
          await cloudinary.uploader.destroy(share.cloudinary_public_id);
        }
        db.prepare('DELETE FROM shares WHERE id = ?').run(id);
        return res.status(410).json({ error: 'View limit exceeded' });
      }
      
      // Increment view count
      db.prepare('UPDATE shares SET current_views = current_views + 1 WHERE id = ?').run(id);
    }

    // Check expiry
    if (new Date() > new Date(share.expires_at)) {
      // Delete from Cloudinary if it's a file
      if (share.type === 'file' && share.cloudinary_public_id) {
        cloudinary.uploader.destroy(share.cloudinary_public_id)
          .catch(err => console.error('Cloudinary delete error:', err));
      }
      
      db.prepare('DELETE FROM shares WHERE id = ?').run(id);
      return res.status(410).json({ error: 'Link has expired' });
    }
    
    // Determine owner flag
    let isOwner = false;
    if (req.user && share && share.owner_id && req.user.id === share.owner_id) {
      isOwner = true;
    }

    // Return data based on type
    const response = {
      id: share.id,
      type: share.type,
      createdAt: share.created_at,
      expiresAt: share.expires_at,
      isProtected: !!share.password,
      isOwner
    };
    
    if (share.type === 'text') {
      response.content = share.content;
    } else {
      response.fileName = share.original_name;
      response.fileSize = share.file_size;
      response.downloadUrl = share.cloudinary_url;
      response.directLink = `http://localhost:5000/api/download/${id}`;
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('Get share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Download file with proper headers
app.get('/api/download/:id', validateShareId, async (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare(`
      SELECT cloudinary_url, expires_at, type, original_name, max_downloads, current_downloads 
      FROM shares WHERE id = ?
    `);
    const share = stmt.get(id);

    if (!share || share.type !== 'file') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check download limit
    if (share.max_downloads !== null) {
      const currentDownloads = share.current_downloads || 0;
      if (currentDownloads >= share.max_downloads) {
        return res.status(410).json({ error: 'Download limit exceeded' });
      }
    }
    
    // Check expiry
    if (new Date() > new Date(share.expires_at)) {
      return res.status(410).json({ error: 'Link has expired' });
    }
    
    // Fetch file from Cloudinary
    const response = await fetch(share.cloudinary_url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch file from storage');
    }
    
    // Get file buffer
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Increment download count
    db.prepare('UPDATE shares SET current_downloads = current_downloads + 1 WHERE id = ?').run(id);
    
    // Set proper headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${share.original_name}"`);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    
    // Send file
    res.send(buffer);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed: ' + error.message });
  }
});


// 8. Cleanup endpoint (manual trigger)
app.get('/api/cleanup', async (req, res) => {
  try {
    const now = new Date().toISOString();
    
    // Get expired files
    const stmt = db.prepare(`
      SELECT * FROM shares 
      WHERE expires_at < ? AND type = 'file' AND cloudinary_public_id IS NOT NULL
    `);
    const expiredFiles = stmt.all(now);
    
    // Delete from Cloudinary
    for (const file of expiredFiles) {
      try {
        await cloudinary.uploader.destroy(file.cloudinary_public_id);
        console.log(`Deleted from Cloudinary: ${file.cloudinary_public_id}`);
      } catch (err) {
        console.error(`Failed to delete ${file.cloudinary_public_id}:`, err.message);
      }
    }
    
    // Delete all expired entries from database
    const deleteStmt = db.prepare('DELETE FROM shares WHERE expires_at < ?');
    const result = deleteStmt.run(now);
    
    res.json({
      success: true,
      deletedFromCloudinary: expiredFiles.length,
      deletedFromDatabase: result.changes,
      message: 'Cleanup completed'
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📁 Database: linkvault.db`);
  console.log(`☁️  Storage: Cloudinary`);
  console.log(`🔒 Password protection: Enabled`);
  console.log(`👁️ View/Download limits: Enabled`);
  console.log(`🗑️ Manual delete: Enabled`);
  
  // Create uploads directory if not exists
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }
});

// Delete a share (owner only)
app.delete('/api/share/:id', authenticateToken, requireAuth, validateShareId, async (req, res) => {
  try {
    const { id } = req.params;
    const share = db.prepare('SELECT * FROM shares WHERE id = ?').get(id);
    if (!share) return res.status(404).json({ error: 'Not found' });

    if (!share.owner_id || share.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the uploader can delete this share' });
    }

    if (share.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(share.cloudinary_public_id);
      } catch (err) {
        console.error('Cloudinary delete error:', err.message);
      }
    }

    db.prepare('DELETE FROM shares WHERE id = ?').run(id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    console.error('Delete share error:', err.message);
    res.status(500).json({ error: 'Delete failed' });
  }
});