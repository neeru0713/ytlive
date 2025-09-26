import React, { useState, useRef } from 'react';
import { Upload, Play, Square, AlertCircle, CheckCircle, Clock, Video, Link, Youtube, LogOut, Settings } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthForm from './components/AuthForm';

interface StreamingStatus {
  status: 'idle' | 'uploading' | 'starting' | 'live' | 'stopping' | 'error';
  message?: string;
  progress?: number;
}

function StreamingApp() {
  const { user, logout, updateStreamSettings, token } = useAuth();
  const [streamUrl, setStreamUrl] = useState('rtmp://a.rtmp.youtube.com/live2/');
  const [streamKey, setStreamKey] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoLink, setVideoLink] = useState('');
  const [useFile, setUseFile] = useState(true);
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>({ status: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Initialize user settings
  React.useEffect(() => {
    if (user) {
      setStreamUrl(user.streamUrl || 'rtmp://a.rtmp.youtube.com/live2/');
      setStreamKey(user.streamKey || '');
    }
  }, [user]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
    }
  };

  const handleGoLive = async () => {
    if (!streamKey.trim()) {
      setStreamingStatus({ status: 'error', message: 'Stream key is required' });
      return;
    }

    if (useFile && !videoFile) {
      setStreamingStatus({ status: 'error', message: 'Please select a video file' });
      return;
    }

    if (!useFile && !videoLink.trim()) {
      setStreamingStatus({ status: 'error', message: 'Please provide a video link' });
      return;
    }

    try {
      setStreamingStatus({ status: useFile ? 'uploading' : 'starting', progress: 0 });

      const formData = new FormData();
      formData.append('streamUrl', streamUrl);
      formData.append('streamKey', streamKey);
      
      if (useFile && videoFile) {
        formData.append('videoFile', videoFile);
      } else {
        formData.append('videoLink', videoLink);
      }

      const response = await fetch('http://localhost:3001/api/go-live', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        setStreamingStatus({ status: 'live', message: 'Stream is now live!' });
      } else {
        const error = await response.text();
        setStreamingStatus({ status: 'error', message: error || 'Failed to start stream' });
      }
    } catch (error) {
      setStreamingStatus({ status: 'error', message: 'Network error occurred' });
    }
  };

  const handleStopStream = async () => {
    try {
      setStreamingStatus({ status: 'stopping', message: 'Stopping stream...' });
      
      const response = await fetch('http://localhost:3001/api/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setStreamingStatus({ status: 'idle', message: 'Stream stopped successfully' });
      } else {
        setStreamingStatus({ status: 'error', message: 'Failed to stop stream' });
      }
    } catch (error) {
      setStreamingStatus({ status: 'error', message: 'Network error occurred' });
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateStreamSettings(streamKey, streamUrl);
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const getStatusIcon = () => {
    switch (streamingStatus.status) {
      case 'live':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'uploading':
      case 'starting':
      case 'stopping':
        return <Clock className="w-5 h-5 text-yellow-400 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (streamingStatus.status) {
      case 'live':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'error':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'uploading':
      case 'starting':
      case 'stopping':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <div className="bg-black/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            <Youtube className="w-8 h-8 text-red-500" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">
              YouTube Live Streamer
            </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">Welcome, {user?.username}</span>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-6">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-white mb-4">Stream Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Stream URL
                </label>
                <input
                  type="text"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Stream Key
                </label>
                <input
                  type="password"
                  value={streamKey}
                  onChange={(e) => setStreamKey(e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveSettings}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Streaming Configuration */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-400" />
              Stream Configuration
            </h2>

            <div className="space-y-6">
              {/* Stream URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Stream URL (saved in settings)
                </label>
                <input
                  type="text"
                  value={streamUrl}
                  readOnly
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="rtmp://a.rtmp.youtube.com/live2/"
                />
              </div>

              {/* Stream Key */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Stream Key * (saved in settings)
                </label>
                <input
                  type="password"
                  value={streamKey}
                  readOnly
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Your YouTube stream key"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use the settings button to update your stream key
                </p>
              </div>

              {/* Video Source Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Video Source
                </label>
                <div className="flex bg-gray-700/30 rounded-lg p-1">
                  <button
                    onClick={() => setUseFile(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                      useFile
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    Upload File
                  </button>
                  <button
                    onClick={() => setUseFile(false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                      !useFile
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Link className="w-4 h-4" />
                    Video URL
                  </button>
                </div>
              </div>

              {/* Video Input */}
              {useFile ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Video File *
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-gray-700/20 transition-all duration-200"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    {videoFile ? (
                      <div>
                        <p className="text-white font-medium">{videoFile.name}</p>
                        <p className="text-sm text-gray-400">
                          {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-400">Click to select a video file</p>
                        <p className="text-xs text-gray-500 mt-1">MP4, AVI, MOV supported</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Video URL *
                  </label>
                  <input
                    type="url"
                    value={videoLink}
                    onChange={(e) => setVideoLink(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="https://example.com/video.mp4"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Stream Control & Status */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Play className="w-5 h-5 text-green-400" />
              Stream Control
            </h2>

            {/* Status Display */}
            <div className={`rounded-xl border p-4 mb-6 ${getStatusColor()}`}>
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <div>
                  <p className="font-medium capitalize">
                    {streamingStatus.status === 'idle' ? 'Ready to Stream' : streamingStatus.status}
                  </p>
                  {streamingStatus.message && (
                    <p className="text-sm opacity-80 mt-1">{streamingStatus.message}</p>
                  )}
                </div>
              </div>
              
              {streamingStatus.progress !== undefined && (
                <div className="mt-3">
                  <div className="bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${streamingStatus.progress}%` }}
                    />
                  </div>
                  <p className="text-xs mt-1">{streamingStatus.progress}% complete</p>
                </div>
              )}
            </div>

            {/* Control Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleGoLive}
                disabled={streamingStatus.status === 'live' || streamingStatus.status === 'uploading' || streamingStatus.status === 'starting'}
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
              >
                <Play className="w-5 h-5" />
                Go Live
              </button>

              <button
                onClick={handleStopStream}
                disabled={streamingStatus.status !== 'live'}
                className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 disabled:from-gray-800 disabled:to-gray-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Square className="w-4 h-4" />
                Stop Stream
              </button>
            </div>

            {/* Instructions */}
            <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h3 className="text-sm font-medium text-blue-300 mb-2">Instructions:</h3>
              <ul className="text-xs text-blue-200 space-y-1">
                <li>• Update your stream key in settings (from YouTube Studio)</li>
                <li>• Upload a video file or provide a direct video URL</li>
                <li>• Click "Go Live" to start streaming</li>
                <li>• Monitor the status for real-time updates</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  return (
    <AuthProvider>
      <AuthContent authMode={authMode} setAuthMode={setAuthMode} />
    </AuthProvider>
  );
}

function AuthContent({ authMode, setAuthMode }: { authMode: 'login' | 'register', setAuthMode: (mode: 'login' | 'register') => void }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthForm 
        mode={authMode} 
        onToggleMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} 
      />
    );
  }

  return <StreamingApp />;
}

export default App;