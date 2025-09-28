const express = require('express');
const { admin } = require('../config/firebase');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
const db = admin.firestore();

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
    const users = [];
    
    usersSnapshot.forEach(doc => {
      users.push({
        uid: doc.id,
        ...doc.data()
      });
    });
    
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all streams
router.get('/streams', adminAuth, async (req, res) => {
  try {
    const streamsSnapshot = await db.collection('streams').orderBy('createdAt', 'desc').get();
    const streams = [];
    
    for (const doc of streamsSnapshot.docs) {
      const streamData = doc.data();
      
      // Get user data
      const userDoc = await db.collection('users').doc(streamData.userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      
      streams.push({
        id: doc.id,
        ...streamData,
        userId: {
          uid: streamData.userId,
          email: userData.email || 'Unknown',
          displayName: userData.displayName || 'Unknown'
        }
      });
    }
    
    res.json({ streams });
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const streamsSnapshot = await db.collection('streams').get();
    
    const totalUsers = usersSnapshot.size;
    const totalStreams = streamsSnapshot.size;
    
    let activeStreams = 0;
    let completedStreams = 0;
    let recentUsers = 0;
    let recentStreams = 0;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Count stream statuses
    streamsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'live') activeStreams++;
      if (data.status === 'stopped') completedStreams++;
      
      if (data.createdAt && data.createdAt.toDate() >= sevenDaysAgo) {
        recentStreams++;
      }
    });
    
    // Count recent users
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdAt && data.createdAt.toDate() >= sevenDaysAgo) {
        recentUsers++;
      }
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
    
    const streamDoc = await db.collection('streams').doc(streamId).get();
    if (!streamDoc.exists) {
      return res.status(404).json({ message: 'Stream not found' });
    }

    const streamData = streamDoc.data();
    if (streamData.status !== 'live') {
      return res.status(400).json({ message: 'Stream is not currently live' });
    }

    // Update stream status
    await db.collection('streams').doc(streamId).update({
      status: 'stopping',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Here you would integrate with your FFmpeg process management
    // For now, we'll just update the status
    setTimeout(async () => {
      await db.collection('streams').doc(streamId).update({
        status: 'stopped',
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }, 2000);

    res.json({ message: 'Stream stop initiated', streamId });
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

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    await db.collection('users').doc(userId).update({
      isAdmin,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const userData = userDoc.data();
    res.json({ 
      message: `User ${isAdmin ? 'promoted to' : 'removed from'} admin`,
      user: {
        uid: userId,
        email: userData.email,
        displayName: userData.displayName,
        isAdmin
      }
    });
  } catch (error) {
    console.error('Toggle admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;