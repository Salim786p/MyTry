const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { nanoid } = require('nanoid');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Create database (single file)
const db = new Database('linkvault.db');

// Create tables (runs only once)
db.exec(`
  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    type TEXT CHECK(type IN ('text', 'file')),
    content TEXT,
    file_path TEXT,
    original_name TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// API Endpoints
app.post('/api/upload/text', (req, res) => {
  const { content, expiry } = req.body;
  const id = nanoid(10);
  
  // Calculate expiry
  const expiresAt = new Date(Date.now() + 10*60*1000); // 10 minutes
  
  // Insert into database
  const stmt = db.prepare(`
    INSERT INTO shares (id, type, content, expires_at) 
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, 'text', content, expiresAt.toISOString());
  
  res.json({
    success: true,
    id,
    link: `http://localhost:5000/share/${id}`,
    expiresAt
  });
});

app.get('/api/share/:id', (req, res) => {
  const { id } = req.params;
  
  const stmt = db.prepare('SELECT * FROM shares WHERE id = ?');
  const share = stmt.get(id);
  
  if (!share) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  // Check expiry
  if (new Date() > new Date(share.expires_at)) {
    db.prepare('DELETE FROM shares WHERE id = ?').run(id);
    return res.status(410).json({ error: 'Expired' });
  }
  
  res.json(share);
});

app.listen(5000, () => {
  console.log('✅ SQLite server running on http://localhost:5000');
  console.log('📁 Database file: linkvault.db');
});