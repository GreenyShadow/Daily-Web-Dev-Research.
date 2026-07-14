import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'deskline.session';

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    const next = { token: data.token, username: data.username, role: data.role };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    if (session?.token) {
      try {
        await api.logout(session.token);
      } catch {
        // session may already be invalid server-side; clear locally regardless
      }
    }
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, [session]);

  // Called when a request comes back 401 (expired/invalid session)
  const forceLogout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, login, logout, forceLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
