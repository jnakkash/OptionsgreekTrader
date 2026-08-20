import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from './services/firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authError: null,
  signIn: async () => {},
  logOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Validate connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('unauthorized-domain')) {
        setAuthError('Sign-in blocked: add this domain to Firebase Console → Authentication → Authorized Domains.');
      } else if (msg.includes('popup-closed')) {
        setAuthError(null); // user dismissed — not an error
      } else {
        setAuthError('Sign-in failed. Check Firebase configuration.');
      }
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
      setAuthError(null);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
};
