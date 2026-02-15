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
require('dotenv').config();

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

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: 'SQLite',
    storage: 'Cloudinary',
    timestamp: new Date() 
  });
});

// 2. Upload text
app.post('/api/upload/text', validateUpload, async (req, res) => {
  try {
    const { content, expiry = '10m', maxViews, password } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    const id = generateId();
    const expiresAt = getExpiryDate(expiry);
    
    const stmt = db.prepare(`
      INSERT INTO shares (id, type, content, expires_at, max_views, current_views, password)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);

    stmt.run(id, 'text', content.trim(), expiresAt.toISOString(), maxViews || null, password || null);
    
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
app.post('/api/upload/file', upload.single('file'), validateUpload, async (req, res) => {
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
    
    // Store in SQLite
    const stmt = db.prepare(`
      INSERT INTO shares (id, type, cloudinary_url, cloudinary_public_id, original_name, file_size, expires_at, max_views, max_downloads, current_views, current_downloads, password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
    `);

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
      password || null
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
app.get('/api/share/:id', validateShareId, async (req, res) => { 
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
    
    // Return data based on type
    const response = {
      id: share.id,
      type: share.type,
      createdAt: share.created_at,
      expiresAt: share.expires_at,
      isProtected: !!share.password
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