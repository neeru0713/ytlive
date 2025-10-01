const { admin } = require('../config/firebase');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    console.log('Verifying token:', token.substring(0, 20) + '...');

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token, true); // Check if revoked
    
    console.log('Token verified for user:', decodedToken.uid);
    
    // Get user data from Firebase Auth
    const userRecord = await admin.auth().getUser(decodedToken.uid);
    
    // Check if email is verified
    if (!userRecord.emailVerified) {
      console.log('Email not verified for user:', decodedToken.uid);
      return res.status(401).json({ message: 'Email not verified' });
    }

    // Get additional user data from Firestore
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    req.user = {
      uid: decodedToken.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      emailVerified: userRecord.emailVerified,
      ...userData
    };
    
    console.log('Auth successful for user:', req.user.email);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid', error: error.message });
  }
};

module.exports = auth;