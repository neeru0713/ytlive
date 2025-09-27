const express = require('express');
const Stream = require('../models/Stream');
const auth = require('../middleware/auth');

const router = express.Router();

// Get user's stream history
router.get('/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const streams = await Stream.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-streamKey'); // Don't send stream key for security

    const totalStreams = await Stream.countDocuments({ userId: req.user._id });
    const totalPages = Math.ceil(totalStreams / limit);

    res.json({
      streams,
      pagination: {
        currentPage: page,
        totalPages,
        totalStreams,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get stream history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current stream status for user
router.get('/current', auth, async (req, res) => {
  try {
    const currentStream = await Stream.findOne({ 
      userId: req.user._id, 
      status: { $in: ['starting', 'live', 'stopping'] }
    }).select('-streamKey');

    res.json({
      currentStream,
      hasActiveStream: !!currentStream
    });
  } catch (error) {
    console.error('Get current stream error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;