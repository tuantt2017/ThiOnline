'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  demoLogin: (role: string) => Promise<User>;
  register: (email: string, fullName: string, password: string, grade?: number) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Inactivity timeout threshold: 30 minutes (30 * 60 * 1000 ms)
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Record user active timestamp
  const updateActivityTimestamp = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('last_activity', Date.now().toString());
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('last_activity');
    }
    router.push('/login');
  };

  // 1. Initial auth & inactivity verification on mount/page load
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const lastActivity = localStorage.getItem('last_activity');
    const now = Date.now();

    // Check if user was inactive for more than 30 minutes before page load/reload
    if (lastActivity) {
      const elapsed = now - Number(lastActivity);
      if (elapsed > INACTIVITY_TIMEOUT_MS) {
        console.warn('[Auth] Phiên làm việc đã hết hạn do không hoạt động >30 phút');
        logout();
        setIsLoading(false);
        return;
      }
    }

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user', e);
      }

      updateActivityTimestamp();

      // Verify token freshness against backend
      api.getMe()
        .then((freshUser) => {
          setUser(freshUser);
          localStorage.setItem('user', JSON.stringify(freshUser));
        })
        .catch((err: any) => {
          // Only logout if token is expired or invalid (401/403)
          if (err?.status === 401 || err?.status === 403) {
            logout();
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  // 2. Idle timer and interaction listener for active session
  useEffect(() => {
    if (!token) return;

    let lastRecorded = Date.now();
    updateActivityTimestamp();

    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle timestamp updates to once every 10 seconds
      if (now - lastRecorded > 10000) {
        lastRecorded = now;
        updateActivityTimestamp();
      }
    };

    // User interaction event listeners
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Periodic check every 30 seconds for inactivity timeout
    const interval = setInterval(() => {
      const lastActivity = localStorage.getItem('last_activity');
      if (lastActivity) {
        const elapsed = Date.now() - Number(lastActivity);
        if (elapsed > INACTIVITY_TIMEOUT_MS) {
          console.warn('[Auth] Auto-logging out due to 30 mins inactivity');
          logout();
          alert('Phiên đăng nhập của bạn đã tự động hết hạn do không hoạt động trong 30 phút. Vui lòng đăng nhập lại.');
        }
      }
    }, 30000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      clearInterval(interval);
    };
  }, [token]);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const response = await api.login(email, password);
      setToken(response.access_token);
      setUser(response.user);
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      updateActivityTimestamp();
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async (role: string): Promise<User> => {
    setIsLoading(true);
    try {
      const response = await api.demoLogin(role);
      setToken(response.access_token);
      setUser(response.user);
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      updateActivityTimestamp();
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, fullName: string, password: string, grade?: number): Promise<void> => {
    setIsLoading(true);
    try {
      await api.register(email, fullName, password, grade);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const freshUser = await api.getMe();
      setUser(freshUser);
      localStorage.setItem('user', JSON.stringify(freshUser));
      updateActivityTimestamp();
    } catch (err) {
      console.error('Could not refresh user', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        demoLogin,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

