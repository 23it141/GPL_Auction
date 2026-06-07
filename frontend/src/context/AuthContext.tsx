import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  loginAdmin: (username: string, password: string) => Promise<void>;
  loginCaptain: (teamCode: string, pin: string) => Promise<void>;
  logout: () => void;
  updatePurse: (newPurse: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('gpl_auth_token'));
  const [loading, setLoading] = useState(true);

  // Sync user profile on mount or token change
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          // Token expired or invalid
          logout();
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, [token]);

  const loginAdmin = async (username: string, password: string) => {
    const res = await fetch('/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to login as admin');
    }

    localStorage.setItem('gpl_auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const loginCaptain = async (teamCode: string, pin: string) => {
    const res = await fetch('/api/auth/captain/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamCode, pin }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to login as captain');
    }

    localStorage.setItem('gpl_auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('gpl_auth_token');
    setToken(null);
    setUser(null);
  };

  const updatePurse = (newPurse: number) => {
    if (user && user.role === 'captain') {
      setUser({ ...user, purse: newPurse });
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginAdmin, loginCaptain, logout, updatePurse }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
