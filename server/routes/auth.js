const express = require('express');
const { admin } = require('../config/firebase');
const auth = require('../middleware/auth');

const router = express.Router();
const db = admin.firestore();

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      user: {
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.displayName,
        emailVerified: req.user.emailVerified,
        streamKey: req.user.streamKey || '',
        streamUrl: req.user.streamUrl || 'rtmp://a.rtmp.youtube.com/live2/',
        isAdmin: req.user.isAdmin || false
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user stream settings
router.put('/stream-settings', auth, async (req, res) => {
  try {
    const { streamKey, streamUrl } = req.body;
    
    const updateData = {};
    if (streamKey !== undefined) updateData.streamKey = streamKey;
    if (streamUrl !== undefined) updateData.streamUrl = streamUrl;
    
    await db.collection('users').doc(req.user.uid).set(updateData, { merge: true });
    
    res.json({
      message: 'Stream settings updated successfully',
      user: {
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.displayName,
        streamKey: streamKey || req.user.streamKey,
        streamUrl: streamUrl || req.user.streamUrl,
        isAdmin: req.user.isAdmin || false
      }
    });
  } catch (error) {
    console.error('Update stream settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create user profile (called after Firebase Auth registration)
router.post('/create-profile', auth, async (req, res) => {
  try {
    const { displayName } = req.body;
    
    const userData = {
      email: req.user.email,
      displayName: displayName || req.user.displayName || '',
      streamKey: '',
      streamUrl: 'rtmp://a.rtmp.youtube.com/live2/',
      isAdmin: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(req.user.uid).set(userData, { merge: true });
    
    res.json({
      message: 'Profile created successfully',
      user: {
        uid: req.user.uid,
        email: req.user.email,
        displayName: userData.displayName,
        streamKey: userData.streamKey,
        streamUrl: userData.streamUrl,
        isAdmin: userData.isAdmin
      }
    });
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;