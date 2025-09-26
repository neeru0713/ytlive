import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Video, 
  Activity, 
  Shield, 
  StopCircle, 
  Play, 
  Clock, 
  AlertCircle,
  CheckCircle,
  UserCheck,
  UserX,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface User {
  _id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
}

interface Stream {
  _id: string;
  userId: {
    _id: string;
    username: string;
    email: string;
  };
  streamKey: string;
  streamUrl: string;
  videoSource: string;
  videoPath?: string;
  status: 'starting' | 'live' | 'stopping' | 'stopped' | 'error';
  startedAt: string;
  endedAt?: string;
  duration?: number;
  errorMessage?: string;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalStreams: number;
  activeStreams: number;
  completedStreams: number;
  recentUsers: number;
  recentStreams: number;
}

interface AdminDashboardProps {
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'streams'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

const API_URL = import.meta.env.VITE_API_URL


  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes, streamsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/admin/streams`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (statsRes.ok && usersRes.ok && streamsRes.ok) {
        const [statsData, usersData, streamsData] = await Promise.all([
          statsRes.json(),
          usersRes.json(),
          streamsRes.json()
        ]);

        setStats(statsData.stats);
        setUsers(usersData.users);
        setStreams(streamsData.streams);
        setError('');
      } else {
        setError('Failed to fetch admin data');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const stopStream = async (streamId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/streams/${streamId}/stop`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchData(); // Refresh data
      } else {
        const error = await response.text();
        alert(`Failed to stop stream: ${error}`);
      }
    } catch (err) {
      alert('Network error occurred');
    }
  };

  const toggleUserAdmin = async (userId: string, isAdmin: boolean) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/admin`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isAdmin })
      });

      if (response.ok) {
        fetchData(); // Refresh data
      } else {
        const error = await response.text();
        alert(`Failed to update user: ${error}`);
      }
    } catch (err) {
      alert('Network error occurred');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'starting':
      case 'stopping':
        return <Clock className="w-4 h-4 text-yellow-400 animate-spin" />;
      default:
        return <StopCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'text-green-400 bg-green-400/10';
      case 'error':
        return 'text-red-400 bg-red-400/10';
      case 'starting':
      case 'stopping':
        return 'text-yellow-400 bg-yellow-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <div className="bg-black/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-purple-500" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex bg-gray-700/30 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === 'overview'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === 'users'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Users
                </button>
                <button
                  onClick={() => setActiveTab('streams')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === 'streams'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Streams
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && stats && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-8 h-8 text-blue-400" />
                  <h3 className="text-lg font-semibold">Total Users</h3>
                </div>
                <p className="text-3xl font-bold text-blue-400">{stats.totalUsers}</p>
                <p className="text-sm text-gray-400 mt-2">
                  +{stats.recentUsers} this week
                </p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Video className="w-8 h-8 text-green-400" />
                  <h3 className="text-lg font-semibold">Active Streams</h3>
                </div>
                <p className="text-3xl font-bold text-green-400">{stats.activeStreams}</p>
                <p className="text-sm text-gray-400 mt-2">
                  {stats.totalStreams} total streams
                </p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Activity className="w-8 h-8 text-purple-400" />
                  <h3 className="text-lg font-semibold">Completed</h3>
                </div>
                <p className="text-3xl font-bold text-purple-400">{stats.completedStreams}</p>
                <p className="text-sm text-gray-400 mt-2">
                  +{stats.recentStreams} this week
                </p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
              <h3 className="text-xl font-semibold mb-6">Recent Streams</h3>
              <div className="space-y-4">
                {streams.slice(0, 5).map((stream) => (
                  <div key={stream._id} className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(stream.status)}
                      <div>
                        <p className="font-medium">{stream.userId.username}</p>
                        <p className="text-sm text-gray-400">
                          {new Date(stream.startedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(stream.status)}`}>
                        {stream.status}
                      </span>
                      {stream.status === 'live' && (
                        <button
                          onClick={() => stopStream(stream._id)}
                          className="p-2 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <StopCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
            <h3 className="text-xl font-semibold mb-6">User Management</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4">User</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Joined</th>
                    <th className="text-left py-3 px-4">Role</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id} className="border-b border-gray-700/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-sm font-bold">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{user.username}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400">{user.email}</td>
                      <td className="py-3 px-4 text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.isAdmin 
                            ? 'text-purple-400 bg-purple-400/10' 
                            : 'text-gray-400 bg-gray-400/10'
                        }`}>
                          {user.isAdmin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleUserAdmin(user._id, !user.isAdmin)}
                          className={`p-2 rounded-lg transition-colors ${
                            user.isAdmin
                              ? 'text-red-400 hover:text-red-300 hover:bg-red-400/10'
                              : 'text-green-400 hover:text-green-300 hover:bg-green-400/10'
                          }`}
                          title={user.isAdmin ? 'Remove admin' : 'Make admin'}
                        >
                          {user.isAdmin ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'streams' && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
            <h3 className="text-xl font-semibold mb-6">Stream Management</h3>
            <div className="space-y-4">
              {streams.map((stream) => (
                <div key={stream._id} className="p-4 bg-gray-700/30 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(stream.status)}
                      <div>
                        <p className="font-medium">{stream.userId.username}</p>
                        <p className="text-sm text-gray-400">{stream.userId.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(stream.status)}`}>
                        {stream.status}
                      </span>
                      {stream.status === 'live' && (
                        <button
                          onClick={() => stopStream(stream._id)}
                          className="flex items-center gap-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                        >
                          <StopCircle className="w-4 h-4" />
                          Stop Stream
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Started</p>
                      <p className="text-white">{new Date(stream.startedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Duration</p>
                      <p className="text-white">{formatDuration(stream.duration)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Source</p>
                      <p className="text-white capitalize">{stream.videoSource}</p>
                    </div>
                  </div>

                  {stream.errorMessage && (
                    <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
                      Error: {stream.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;