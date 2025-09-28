const { admin } = require('../config/firebase');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Get user data from Firebase Auth
    const userRecord = await admin.auth().getUser(decodedToken.uid);
    
    // Check if email is verified
    if (!userRecord.emailVerified) {
      return res.status(401).json({ message: 'Email not verified' });
    }

    // Get additional user data from Firestore
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Check if user is admin
    if (!userData.isAdmin) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    req.user = {
      uid: decodedToken.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      emailVerified: userRecord.emailVerified,
      ...userData
    };
    
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = adminAuth;