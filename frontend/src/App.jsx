import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Upload, FileText, Link as LinkIcon, Clock, Shield, Download, Copy, Check, X, Key, Eye, Download as DownloadIcon } from 'lucide-react';
import SharePage from './SharePage';

function UploadPage() {
  const [activeTab, setActiveTab] = useState('text');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState(null);
  const [expiry, setExpiry] = useState('10m');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  // New state for additional features
  const [password, setPassword] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    setUploadError('');
    
    if (activeTab === 'text' && !textContent.trim()) {
      setUploadError('Please enter some text to upload');
      setIsUploading(false);
      return;
    }
    
    if (activeTab === 'file' && !file) {
      setUploadError('Please select a file to upload');
      setIsUploading(false);
      return;
    }
    
    try {
      let response;
      const uploadData = {
        expiry,
        ...(password && { password }),
        ...(maxViews && { maxViews: parseInt(maxViews) })
      };
      
      if (activeTab === 'text') {
        response = await fetch('http://localhost:5000/api/upload/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: textContent, 
            ...uploadData 
          })
        });
      } else {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('expiry', expiry);
        if (password) formData.append('password', password);
        if (maxViews) formData.append('maxViews', maxViews);
        if (maxDownloads) formData.append('maxDownloads', maxDownloads);
        
        response = await fetch('http://localhost:5000/api/upload/file', {
          method: 'POST',
          body: formData
        });
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      
      setGeneratedLink(data.link);
      
      // Reset form
      if (activeTab === 'text') {
        setTextContent('');
      } else {
        setFile(null);
      }
      setPassword('');
      setMaxViews('');
      setMaxDownloads('');
      
    } catch (error) {
      setUploadError(error.message || 'Upload failed. Check if backend is running.');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.size > 100 * 1024 * 1024) {
      setUploadError('File size must be less than 100MB');
      setFile(null);
    } else {
      setFile(selectedFile);
      setUploadError('');
    }
  };

  const handleReset = () => {
    setGeneratedLink('');
    setTextContent('');
    setFile(null);
    setPassword('');
    setMaxViews('');
    setMaxDownloads('');
    setUploadError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-gray-100 p-4 md:p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Shield className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                LinkVault
              </h1>
              <p className="text-gray-400 text-sm">Secure file & text sharing</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold mb-2">Share securely, access privately</h2>
              <p className="text-gray-400">
                Upload text or files and share them with a unique, expiring link.
                Only people with the link can access your content.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <Shield className="h-4 w-4 text-green-400" />
              <span>Encrypted • Private • Auto-expiring</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        {/* Upload Section */}
        {!generatedLink ? (
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700 shadow-2xl">
            <div className="mb-8">
              <div className="flex border-b border-gray-700 mb-6">
                <button
                  onClick={() => setActiveTab('text')}
                  className={`flex items-center space-x-2 px-4 py-3 font-medium transition-all ${
                    activeTab === 'text'
                      ? 'border-b-2 border-indigo-500 text-indigo-400'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <FileText className="h-5 w-5" />
                  <span>Text</span>
                </button>
                <button
                  onClick={() => setActiveTab('file')}
                  className={`flex items-center space-x-2 px-4 py-3 font-medium transition-all ${
                    activeTab === 'file'
                      ? 'border-b-2 border-indigo-500 text-indigo-400'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <Upload className="h-5 w-5" />
                  <span>File</span>
                </button>
              </div>

              <form onSubmit={handleUpload}>
                {activeTab === 'text' ? (
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-300">
                      Enter your text
                    </label>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      className="w-full h-64 bg-gray-900/70 border border-gray-700 rounded-xl p-4 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono"
                      placeholder="Paste your text here..."
                      maxLength={10000}
                    />
                    <div className="text-sm text-gray-400 text-right">
                      {textContent.length}/10000 characters
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-300">
                      Select a file
                    </label>
                    <div className="border-2 border-dashed border-gray-700 rounded-2xl p-8 text-center transition-all hover:border-indigo-500/50 hover:bg-gray-900/30">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                        <div className="space-y-2">
                          <p className="text-gray-300 font-medium">
                            {file ? file.name : 'Click to select a file'}
                          </p>
                          <p className="text-sm text-gray-400">
                            {file ? `Size: ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Maximum file size: 100MB'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Supports any file type
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Advanced Options - Password and Limits */}
                <div className="mt-8 space-y-4">
                  {/* Password Protection */}
                  <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800">
                    <div className="flex items-center space-x-2 mb-4">
                      <Key className="h-5 w-5 text-purple-400" />
                      <span className="font-medium text-gray-300">Password Protection (Optional)</span>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Set a password to protect this link"
                      className="w-full bg-gray-800/70 border border-gray-700 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Recipients will need this password to access the content
                    </p>
                  </div>

                  {/* View/Download Limits */}
                  <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800">
                    <div className="flex items-center space-x-2 mb-4">
                      <Eye className="h-5 w-5 text-blue-400" />
                      <span className="font-medium text-gray-300">Access Limits (Optional)</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Max Views - for both text and file */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Maximum Views
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={maxViews}
                          onChange={(e) => setMaxViews(e.target.value)}
                          placeholder="e.g., 5"
                          className="w-full bg-gray-800/70 border border-gray-700 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Max Downloads - only for files */}
                      {activeTab === 'file' && (
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">
                            Maximum Downloads
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={maxDownloads}
                            onChange={(e) => setMaxDownloads(e.target.value)}
                            placeholder="e.g., 3"
                            className="w-full bg-gray-800/70 border border-gray-700 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Leave empty for unlimited access
                    </p>
                  </div>
                </div>

                {/* Expiry Settings */}
                <div className="mt-8 p-5 bg-gray-900/50 rounded-xl border border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-indigo-400" />
                      <span className="font-medium text-gray-300">Expiry Settings</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { value: '10m', label: '10 minutes' },
                      { value: '1h', label: '1 hour' },
                      { value: '1d', label: '1 day' },
                      { value: '7d', label: '1 week' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setExpiry(option.value)}
                        className={`p-3 rounded-lg text-center transition-all ${
                          expiry === option.value
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-400 mt-3">
                    Content will be automatically deleted after expiry
                  </p>
                </div>

                {/* Error Message */}
                {uploadError && (
                  <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-xl flex items-center space-x-3">
                    <X className="h-5 w-5 text-red-400" />
                    <span className="text-red-300">{uploadError}</span>
                  </div>
                )}

                {/* Upload Button */}
                <div className="mt-8">
                  <button
                    type="submit"
                    disabled={isUploading}
                    className={`w-full py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center space-x-3 ${
                      isUploading
                        ? 'bg-indigo-700 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        <span>Upload & Generate Secure Link</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-gray-400 text-sm mt-3">
                    Your content is encrypted and accessible only via the generated link
                  </p>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* Success Section */
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700 shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mb-6">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Upload Successful!</h2>
              <p className="text-gray-400">Share this link with anyone you want to access your content</p>
              {password && (
                <div className="mt-2 inline-flex items-center space-x-1 bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-sm">
                  <Key className="h-3 w-3" />
                  <span>Password Protected</span>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-gray-900/70 rounded-xl p-5 border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-400">Your secure link:</span>
                  <span className="text-xs text-green-400 flex items-center">
                    <Shield className="h-3 w-3 mr-1" />
                    Active
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <LinkIcon className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={generatedLink}
                    readOnly
                    className="flex-1 bg-transparent text-gray-200 font-mono text-sm p-3 rounded-lg border border-gray-700 focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="bg-indigo-600 hover:bg-indigo-700 px-5 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                  <div className="flex items-center space-x-3 mb-2">
                    <Clock className="h-5 w-5 text-yellow-400" />
                    <span className="text-sm font-medium text-gray-300">Expires in</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {expiry === '10m' ? '10 minutes' : 
                     expiry === '1h' ? '1 hour' : 
                     expiry === '1d' ? '1 day' : '1 week'}
                  </p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                  <div className="flex items-center space-x-3 mb-2">
                    <Shield className="h-5 w-5 text-green-400" />
                    <span className="text-sm font-medium text-gray-300">Access</span>
                  </div>
                  <p className="text-lg font-semibold">Link only</p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                  <div className="flex items-center space-x-3 mb-2">
                    {activeTab === 'text' ? (
                      <FileText className="h-5 w-5 text-blue-400" />
                    ) : (
                      <DownloadIcon className="h-5 w-5 text-blue-400" />
                    )}
                    <span className="text-sm font-medium text-gray-300">Content Type</span>
                  </div>
                  <p className="text-lg font-semibold">{activeTab === 'text' ? 'Text' : 'File'}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-800">
                <a
                  href={generatedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 py-3 rounded-xl font-medium transition-all flex items-center justify-center space-x-2"
                >
                  {activeTab === 'text' ? (
                    <>
                      <FileText className="h-5 w-5" />
                      <span>View Text</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      <span>Download File</span>
                    </>
                  )}
                </a>
                <button
                  onClick={handleReset}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 py-3 rounded-xl font-medium transition-colors border border-gray-700"
                >
                  Upload Another
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/30 p-6 rounded-2xl border border-gray-800">
            <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Secure by Design</h3>
            <p className="text-gray-400 text-sm">
              No authentication needed. Content is accessible only via the generated link.
            </p>
          </div>
          <div className="bg-gray-800/30 p-6 rounded-2xl border border-gray-800">
            <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Auto-Expiry</h3>
            <p className="text-gray-400 text-sm">
              Content automatically deletes after expiry. Choose from 10 minutes to 1 week.
            </p>
          </div>
          <div className="bg-gray-800/30 p-6 rounded-2xl border border-gray-800">
            <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center mb-4">
              <LinkIcon className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Easy Sharing</h3>
            <p className="text-gray-400 text-sm">
              Share the link anywhere. No account required for uploaders or viewers.
            </p>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto mt-12 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
        <p>LinkVault • Your secure sharing solution • No tracking • No accounts • Complete privacy</p>
        <p className="mt-2">Content is encrypted and automatically deleted after expiry</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/share/:id" element={<SharePage />} />
        <Route path="/" element={<UploadPage />} />
      </Routes>
    </Router>
  );
}

export default App;