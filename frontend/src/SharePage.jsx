import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Download, Copy, Clock, AlertCircle, Home } from 'lucide-react';

function SharePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`http://localhost:5000/api/share/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load content');
        }
        return data;
      })
      .then(data => {
        setContent(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const handleCopy = () => {
    if (content.type === 'text') {
      navigator.clipboard.writeText(content.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
            <h1 className="text-2xl font-bold text-white mb-2">Unable to Load</h1>
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
            <div className="flex items-center justify-between">
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
                    {content.type === 'text' ? 'Text content' : `File size: ${Math.round(content.fileSize / 1024)} KB`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-yellow-400">
                <Clock className="h-4 w-4" />
                <span>Expires: {new Date(content.expiresAt).toLocaleString()}</span>
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
            <div className="text-center space-y-8">
              <div className="p-8 border-2 border-dashed border-gray-700 rounded-2xl">
                <Download className="h-20 w-20 mx-auto text-gray-500 mb-4" />
                <h2 className="text-xl font-semibold mb-2">{content.fileName}</h2>
                <p className="text-gray-400 mb-6">
                  {Math.round(content.fileSize / 1024)} KB • Ready to download
                </p>
                
                <a
                  href={`http://localhost:5000/api/download/${id}`}
                  className="inline-flex items-center space-x-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 px-8 py-4 rounded-xl font-semibold text-lg transition-all"
                  download
                >
                  <Download className="h-6 w-6" />
                  <span>Download File</span>
                </a>
              </div>
              
              <div className="text-sm text-gray-500">
                <p>⚠️ This file will be automatically deleted after expiry</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SharePage;