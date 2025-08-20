'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, JWTPayload } from '../types/shared';

interface AuthContextType {
  user: JWTPayload | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<JWTPayload | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar localStorage (modo demo ou usuário logado)
    const savedToken = localStorage.getItem('collabdocs_token');
    if (savedToken) {
      try {
        const payload = parseJWT(savedToken);
        if (payload && payload.exp > Date.now() / 1000) {
          setUser(payload);
          setToken(savedToken);
        } else {
          localStorage.removeItem('collabdocs_token');
        }
      } catch (error) {
        console.error('Error parsing saved token:', error);
        localStorage.removeItem('collabdocs_token');
      }
    }
    setIsLoading(false);
  }, []);

  const parseJWT = (token: string): JWTPayload | null => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]!));
      return payload as JWTPayload;
    } catch {
      return null;
    }
  };

  const login = (newToken: string) => {
    try {
      const payload = parseJWT(newToken);
      if (payload && payload.exp > Date.now() / 1000) {
        setUser(payload);
        setToken(newToken);
        localStorage.setItem('collabdocs_token', newToken);
      } else {
        throw new Error('Invalid or expired token');
      }
    } catch (error) {
      console.error('Login error:', error);
      logout();
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('collabdocs_token');
    localStorage.removeItem('collabdocs_user');
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}