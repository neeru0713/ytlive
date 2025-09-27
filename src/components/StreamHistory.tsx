import React, { useState, useEffect } from 'react';
import { 
  History, 
  Play, 
  Square, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  Calendar,
  Timer,
  Video,
  Link,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Stream {
  _id: string;
  streamUrl: string;
  videoSource: 'file' | 'url';
  videoPath?: string;
  loopVideo: boolean;
  status: 'starting' | 'live' | 'stopping' | 'stopped' | 'error';
  startedAt: string;
  endedAt?: string;
  duration?: number;
  errorMessage?: string;
  createdAt: string;
}

interface StreamHistoryData {
  streams: Stream[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalStreams: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface CurrentStreamData {
  currentStream: Stream | null;
  hasActiveStream: boolean;
}

const StreamHistory: React.FC = () => {
  const { token } = useAuth();
  const [historyData, setHistoryData] = useState<StreamHistoryData | null>(null);
  const [currentStream, setCurrentStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const API_URL = import.meta.env.VITE_BACKEND_URL;

  const fetchStreamHistory = async (page = 1) => {
    try {
      const response = await fetch(`${API_URL}/api/streams/history?page=${page}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHistoryData(data);
        setCurrentPage(page);
        setError('');
      } else {
        setError('Failed to fetch stream history');
      }
    } catch (err) {
      setError('Network error occurred');
    }
  };

  const fetchCurrentStream = async () => {
    try {
      const response = await fetch(`${API_URL}/api/streams/current`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: CurrentStreamData = await response.json();
        setCurrentStream(data.currentStream);
      }
    } catch (err) {
      console.error('Failed to fetch current stream:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchStreamHistory(currentPage),
      fetchCurrentStream()
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchStreamHistory(1),
        fetchCurrentStream()
      ]);
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 30 seconds if there's an active stream
    const interval = setInterval(() => {
      if (currentStream && ['starting', 'live', 'stopping'].includes(currentStream.status)) {
        fetchCurrentStream();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [token]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'starting':
      case 'stopping':
        return <Clock className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'stopped':
        return <Square className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'error':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'starting':
      case 'stopping':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'stopped':
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getVideoSourceIcon = (source: string) => {
    return source === 'file' ? <Video className="w-4 h-4" /> : <Link className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-white">Loading stream history...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          Stream History
        </h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Current Stream Status */}
      {currentStream && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
            <Play className="w-4 h-4 text-green-400" />
            Current Stream
          </h3>
          <div className={`rounded-xl border p-4 ${getStatusColor(currentStream.status)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(currentStream.status)}
                <div>
                  <p className="font-medium capitalize">{currentStream.status}</p>
                  <p className="text-sm opacity-80">
                    Started: {formatDate(currentStream.startedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  {getVideoSourceIcon(currentStream.videoSource)}
                  <span className="capitalize">{currentStream.videoSource}</span>
                </div>
                {currentStream.loopVideo && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                    <RotateCcw className="w-3 h-3" />
                    <span className="text-xs">LOOP</span>
                  </div>
                )}
              </div>
            </div>
            {currentStream.errorMessage && (
              <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
                Error: {currentStream.errorMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stream History */}
      <div className="space-y-4">
        {historyData?.streams.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No stream history found</p>
            <p className="text-sm">Your completed streams will appear here</p>
          </div>
        ) : (
          <>
            {historyData?.streams.map((stream) => (
              <div key={stream._id} className="p-4 bg-gray-700/30 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(stream.status)}
                    <div>
                      <p className="font-medium capitalize">{stream.status}</p>
                      <p className="text-sm text-gray-400">
                        {formatDate(stream.startedAt)}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(stream.status)}`}>
                    {stream.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-gray-400">Duration</p>
                      <p className="text-white">{formatDuration(stream.duration)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getVideoSourceIcon(stream.videoSource)}
                    <div>
                      <p className="text-gray-400">Source</p>
                      <p className="text-white capitalize">{stream.videoSource}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-gray-400">Ended</p>
                      <p className="text-white">
                        {stream.endedAt ? formatDate(stream.endedAt) : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-gray-400">Loop</p>
                      <p className="text-white">{stream.loopVideo ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>

                {stream.errorMessage && (
                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
                    Error: {stream.errorMessage}
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {historyData && historyData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-gray-400">
                  Showing {historyData.streams.length} of {historyData.pagination.totalStreams} streams
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchStreamHistory(currentPage - 1)}
                    disabled={!historyData.pagination.hasPrev}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 bg-gray-600 text-white rounded text-sm">
                    {historyData.pagination.currentPage} / {historyData.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => fetchStreamHistory(currentPage + 1)}
                    disabled={!historyData.pagination.hasNext}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StreamHistory;