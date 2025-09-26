const express = require('express');
const User = require('../models/User');
const Stream = require('../models/Stream');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all streams
router.get('/streams', adminAuth, async (req, res) => {
  try {
    const streams = await Stream.find({})
      .populate('userId', 'username email')
      .sort({ createdAt: -1 });
    res.json({ streams });
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStreams = await Stream.countDocuments();
    const activeStreams = await Stream.countDocuments({ status: 'live' });
    const completedStreams = await Stream.countDocuments({ status: 'stopped' });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUsers = await User.countDocuments({ 
      createdAt: { $gte: sevenDaysAgo } 
    });
    const recentStreams = await Stream.countDocuments({ 
      createdAt: { $gte: sevenDaysAgo } 
    });

    res.json({
      stats: {
        totalUsers,
        totalStreams,
        activeStreams,
        completedStreams,
        recentUsers,
        recentStreams
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Stop a specific stream
router.post('/streams/:streamId/stop', adminAuth, async (req, res) => {
  try {
    const { streamId } = req.params;
    
    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ message: 'Stream not found' });
    }

    if (stream.status !== 'live') {
      return res.status(400).json({ message: 'Stream is not currently live' });
    }

    // Update stream status
    stream.status = 'stopping';
    await stream.save();

    // Here you would integrate with your FFmpeg process management
    // For now, we'll just update the status
    setTimeout(async () => {
      stream.status = 'stopped';
      stream.endedAt = new Date();
      await stream.save();
    }, 2000);

    res.json({ message: 'Stream stop initiated', stream });
  } catch (error) {
    console.error('Stop stream error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle user admin status
router.put('/users/:userId/admin', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isAdmin } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isAdmin = isAdmin;
    await user.save();

    res.json({ 
      message: `User ${isAdmin ? 'promoted to' : 'removed from'} admin`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Toggle admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;