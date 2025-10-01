import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  sendEmailVerification
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

interface User {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  streamKey?: string;
  streamUrl?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  updateStreamSettings: (streamKey: string, streamUrl: string) => Promise<void>;
  loading: boolean;
  needsEmailVerification: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  const API_URL = import.meta.env.PROD ? import.meta.env.VITE_BACKEND_URL : '';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        if (!firebaseUser.emailVerified) {
          setNeedsEmailVerification(true);
          setUser(null);
          setLoading(false);
          return;
        }

        setNeedsEmailVerification(false);
        
        try {
          // Get Firebase ID token
          const token = await firebaseUser.getIdToken(true); // Force refresh token
          
          // Get user profile from backend
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else if (response.status === 404) {
            // User profile doesn't exist, create it
            await createUserProfile(token, firebaseUser.displayName || '');
          } else {
            console.error('Auth error:', response.status, await response.text());
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUser(null);
        setNeedsEmailVerification(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const createUserProfile = async (token: string, displayName: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/create-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        console.error('Create profile error:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  };

  const login = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      if (!result.user.emailVerified) {
        await sendEmailVerification(result.user);
        setNeedsEmailVerification(true);
        return;
      }

      // Profile will be created/fetched in the auth state change listener
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
      setNeedsEmailVerification(false);
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error(error.message || 'Logout failed');
    }
  };

  const sendVerificationEmail = async () => {
    if (firebaseUser && !firebaseUser.emailVerified) {
      try {
        await sendEmailVerification(firebaseUser);
      } catch (error: any) {
        console.error('Error sending verification email:', error);
        throw new Error(error.message || 'Failed to send verification email');
      }
    }
  };

  const updateStreamSettings = async (streamKey: string, streamUrl: string) => {
    if (!firebaseUser) throw new Error('Not authenticated');

    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`${API_URL}/api/auth/stream-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ streamKey, streamUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update stream settings');
      }

      setUser(data.user);
    } catch (error: any) {
      console.error('Update stream settings error:', error);
      throw new Error(error.message || 'Failed to update stream settings');
    }
  };

  const value = {
    user,
    firebaseUser,
    login,
    logout,
    sendVerificationEmail,
    updateStreamSettings,
    loading,
    needsEmailVerification,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};