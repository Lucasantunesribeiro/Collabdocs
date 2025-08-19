'use client';

import { SessionProvider } from 'next-auth/react';
import { AuthProvider as CustomAuthProvider } from './AuthContext';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider>
      <CustomAuthProvider>
        {children}
      </CustomAuthProvider>
    </SessionProvider>
  );
}
