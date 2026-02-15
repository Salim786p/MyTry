const fs = require('fs');

// List of dangerous extensions to BLOCK
const DANGEROUS_EXTENSIONS = [
  // Executables
  '.exe', '.msi', '.bat', '.cmd', '.sh', '.bash', '.ps1', '.vbs',
  '.jar', '.class', '.dll', '.so', '.dylib', '.bin', '.app', '.deb', '.rpm',
  
  // Scripts that can execute
  '.js', '.jsx', '.ts', '.tsx', '.vue', '.php', '.py', '.pl', '.rb',
  '.cgi', '.asp', '.aspx', '.jsp', '.cfm',
  
  // Macros in documents
  '.docm', '.xlsm', '.pptm', '.dotm', '.xlam', '.ppam',
  
  // System files
  '.sys', '.drv', '.ocx', '.scr', '.cpl', '.com',
  
  // Others
  '.swf', '.wsf', '.wsh', '.hta'
];

const validateUpload = (req, res, next) => {
  // Text upload validation
  if (req.path.includes('/upload/text')) {
    const { content, expiry } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Text content is required' });
    }
    
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return res.status(400).json({ error: 'Text cannot be empty' });
    }
    
    // 10,000 character limit
    if (trimmedContent.length > 10000) {
      return res.status(400).json({ 
        error: `Text exceeds 10,000 character limit (current: ${trimmedContent.length} characters)` 
      });
    }
    
    const validExpiry = ['10m', '1h', '1d', '7d'];
    if (expiry && !validExpiry.includes(expiry)) {
      return res.status(400).json({ error: 'Invalid expiry time. Use: 10m, 1h, 1d, or 7d' });
    }
  }
  
  // File upload validation
  if (req.path.includes('/upload/file')) {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }
    
    // 100MB file size limit
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
    if (req.file.size > MAX_FILE_SIZE) {
      // Clean up the uploaded file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        error: `File size exceeds 100MB limit (current: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB)` 
      });
    }
    
    // Check file extension for dangerous types
    const fileExtension = req.file.originalname.toLowerCase().slice(
      req.file.originalname.lastIndexOf('.')
    );
    
    if (DANGEROUS_EXTENSIONS.includes(fileExtension)) {
      // Clean up the uploaded file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        error: `File type '${fileExtension}' is not allowed for security reasons. 
                Allowed: Any file except executables and scripts (${DANGEROUS_EXTENSIONS.join(', ')})` 
      });
    }
    
    // Validate expiry
    const validExpiry = ['10m', '1h', '1d', '7d'];
    if (req.body.expiry && !validExpiry.includes(req.body.expiry)) {
      // Clean up the uploaded file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Invalid expiry time. Use: 10m, 1h, 1d, or 7d' });
    }
  }
  
  next();
};

const validateShareId = (req, res, next) => {
  const { id } = req.params;
  
  // ID must be 10 characters (nanoid default)
  if (!id || id.length !== 10) {
    return res.status(400).json({ error: 'Invalid link format' });
  }
  
  // Only allow alphanumeric and dashes/underscores (nanoid characters)
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid link format' });
  }
  
  next();
};

module.exports = { validateUpload, validateShareId, DANGEROUS_EXTENSIONS };