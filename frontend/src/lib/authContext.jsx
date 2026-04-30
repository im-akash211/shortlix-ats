import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, clearAuth } from './api';
import { queryClient } from '../main';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = auth.getUser();
    // Stale session saved before RBAC was added — no permissions array.
    // Clear it so the user gets a fresh login with permissions included.
    if (stored && !Array.isArray(stored.permissions)) {
      clearAuth();
      return null;
    }
    return stored;
  });

  useEffect(() => {
    const handler = () => {
      setUser(null);
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    auth.logout().catch(() => {});
    clearAuth();
    queryClient.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, handleLogin, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
