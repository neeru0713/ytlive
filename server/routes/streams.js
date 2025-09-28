const express = require('express');
const { admin } = require('../config/firebase');
const auth = require('../middleware/auth');

const router = express.Router();
const db = admin.firestore();

// Get user's stream history
router.get('/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const streamsQuery = db.collection('streams')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset);

    const streamsSnapshot = await streamsQuery.get();
    const streams = [];
    
    streamsSnapshot.forEach(doc => {
      const data = doc.data();
      streams.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings
        startedAt: data.startedAt?.toDate?.()?.toISOString() || data.startedAt,
        endedAt: data.endedAt?.toDate?.()?.toISOString() || data.endedAt,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      });
    });

    // Get total count for pagination
    const totalQuery = db.collection('streams').where('userId', '==', req.user.uid);
    const totalSnapshot = await totalQuery.get();
    const totalStreams = totalSnapshot.size;
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
    const currentStreamQuery = db.collection('streams')
      .where('userId', '==', req.user.uid)
      .where('status', 'in', ['starting', 'live', 'stopping'])
      .orderBy('createdAt', 'desc')
      .limit(1);

    const currentStreamSnapshot = await currentStreamQuery.get();
    let currentStream = null;

    if (!currentStreamSnapshot.empty) {
      const doc = currentStreamSnapshot.docs[0];
      const data = doc.data();
      currentStream = {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings
        startedAt: data.startedAt?.toDate?.()?.toISOString() || data.startedAt,
        endedAt: data.endedAt?.toDate?.()?.toISOString() || data.endedAt,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    }

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