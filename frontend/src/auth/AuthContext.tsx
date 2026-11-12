'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, refreshAccessToken, setAccessToken, setSessionExpiredHandler } from '../api/client';
import { usePathname } from 'next/navigation';
export interface User {

  id: string;
  name: string;
  email: string;
  role: string;
}

interface SessionResponse {
  accessToken: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  establishSession: (session: SessionResponse) => void;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const PUBLIC_ROUTES = ['/', '/login', '/register-restaurant', '/branch-details'];  // Add any other public routes here

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = (data: SessionResponse) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    if (PUBLIC_ROUTES.includes(pathname)) {
      setLoading(false);
      return;
    }
    let active = true;

    (async () => {
      try {
        await refreshAccessToken();
        const { data } = await api.get<User>('/auth/me');
        if (active) setUser(data);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<SessionResponse>('/auth/login', { email, password });
    applySession(data);
  };

  const signup = async (name: string, email: string, password: string) => {
    const { data } = await api.post<SessionResponse>('/auth/signup', { name, email, password });
    applySession(data);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const logoutAll = async () => {
    try {
      await api.post('/auth/logout-all');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const { data } = await api.post<SessionResponse>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    applySession(data);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      signup,
      establishSession: applySession,
      logout,
      logoutAll,
      changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
