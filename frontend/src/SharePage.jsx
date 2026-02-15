import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Download, Copy, Clock, AlertCircle, Home, Shield, Eye, Download as DownloadIcon, X, Key } from 'lucide-react';

function SharePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Password protection
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  // View/Download limits
  const [viewInfo, setViewInfo] = useState(null);

  // Check if password required
  useEffect(() => {
    const checkPassword = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/share/${id}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: '' })
        });
        const data = await response.json();
        
        if (data.protected && !data.verified) {
          setRequiresPassword(true);
          setLoading(false);
        } else {
          // No password required, load content
          loadContent();
        }
      } catch (err) {
        setError('Failed to check password status');
        setLoading(false);
      }
    };
    
    checkPassword();
  }, [id]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/share/${id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load content');
      }
      
      setContent(data);
      
      // Set view info if limits exist
      if (data.maxViews) {
        setViewInfo({
          type: 'view',
          current: data.currentViews || 0,
          max: data.maxViews
        });
      }
      
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const verifyPassword = async () => {
    if (!password.trim()) {
      setPasswordError('Password is required');
      return;
    }
    
    setVerifying(true);
    setPasswordError('');
    
    try {
      const response = await fetch(`http://localhost:5000/api/share/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (data.verified) {
        setRequiresPassword(false);
        loadContent();
      } else {
        setPasswordError('Incorrect password');
      }
    } catch (err) {
      setPasswordError('Verification failed');
    } finally {
      setVerifying(false);
    }
  };


  const handleCopy = () => {
    if (content.type === 'text') {
      navigator.clipboard.writeText(content.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Password protection UI
  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full border border-gray-700">
          <div className="text-center mb-6">
            <div className="inline-flex p-4 bg-indigo-600/20 rounded-full mb-4">
              <Key className="h-8 w-8 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Password Protected</h1>
            <p className="text-gray-400">This content requires a password to access</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && verifyPassword()}
                className="w-full bg-gray-900/70 border border-gray-700 rounded-xl p-4 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter password"
                autoFocus
              />
              {passwordError && (
                <p className="text-red-400 text-sm mt-2">{passwordError}</p>
              )}
            </div>
            
            <button
              onClick={verifyPassword}
              disabled={verifying}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-4 rounded-xl font-semibold transition-all disabled:opacity-50"
            >
              {verifying ? 'Verifying...' : 'Access Content'}
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-medium transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading shared content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full border border-gray-700">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              {error.includes('expired') ? 'Link Expired' : 'Unable to Load'}
            </h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl font-medium transition-colors inline-flex items-center space-x-2"
            >
              <Home className="h-5 w-5" />
              <span>Go to Home</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-4 md:p-8">
      {/* Delete Confirmation Modal */}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white flex items-center space-x-2 mb-6"
          >
            <Home className="h-5 w-5" />
            <span>Back to Home</span>
          </button>
          
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${content.type === 'text' ? 'bg-blue-600' : 'bg-green-600'}`}>
                  {content.type === 'text' ? (
                    <FileText className="h-6 w-6" />
                  ) : (
                    <Download className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-bold">
                    {content.type === 'text' ? 'Shared Text' : content.fileName}
                  </h1>
                  <p className="text-sm text-gray-400">
                    {content.type === 'text' 
                      ? `${content.content.length} characters` 
                      : `File size: ${Math.round(content.fileSize / 1024)} KB`}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {content.isProtected && (
                  <div className="flex items-center space-x-1 text-xs bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full">
                    <Shield className="h-3 w-3" />
                    <span>Password Protected</span>
                  </div>
                )}
                
                {viewInfo && (
                  <div className="flex items-center space-x-1 text-xs bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full">
                    <Eye className="h-3 w-3" />
                    <span>{viewInfo.current}/{viewInfo.max} views</span>
                  </div>
                )}
                
                <div className="flex items-center space-x-1 text-xs bg-yellow-600/20 text-yellow-400 px-3 py-1 rounded-full">
                  <Clock className="h-3 w-3" />
                  <span>Expires: {new Date(content.expiresAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700">
          {content.type === 'text' ? (
            <div className="space-y-6">
              <div className="bg-gray-900/70 rounded-xl p-6">
                <pre className="text-gray-200 whitespace-pre-wrap font-mono text-sm md:text-base">
                  {content.content}
                </pre>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleCopy}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center space-x-3 ${
                    copied 
                      ? 'bg-green-600' 
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {copied ? (
                    <>
                      <Copy className="h-5 w-5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-5 w-5" />
                      <span>Copy to Clipboard</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-medium transition-colors"
                >
                  Copy Share Link
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="p-8 border-2 border-dashed border-gray-700 rounded-2xl text-center">
                <DownloadIcon className="h-20 w-20 mx-auto text-gray-500 mb-4" />
                <h2 className="text-xl font-semibold mb-2">{content.fileName}</h2>
                <p className="text-gray-400 mb-6">
                  {Math.round(content.fileSize / 1024)} KB • Ready to download
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                  <a
                    href={`http://localhost:5000/api/download/${id}`}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 px-6 py-3 rounded-xl font-semibold transition-all inline-flex items-center justify-center space-x-2"
                    download
                  >
                    <DownloadIcon className="h-5 w-5" />
                    <span>Download File</span>
                  </a>
                  
                  <a
                    href={`http://localhost:5000/api/download/${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-semibold transition-all inline-flex items-center justify-center space-x-2"
                  >
                    <Eye className="h-5 w-5" />
                    <span>View in Browser</span>
                  </a>
                </div>
              </div>
              
              {content.maxDownloads && (
                <div className="bg-blue-600/10 border border-blue-800/30 rounded-xl p-4 text-center">
                  <p className="text-sm text-blue-400">
                    <Eye className="h-4 w-4 inline mr-1" />
                    Download limit: {content.currentDownloads || 0}/{content.maxDownloads}
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>⚠️ Content will be automatically deleted after expiry or when limits are reached</p>
        </div>
      </div>
    </div>
  );
}

export default SharePage;