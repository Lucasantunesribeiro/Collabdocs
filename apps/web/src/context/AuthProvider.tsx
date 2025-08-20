'use client';

import { AuthProvider as CustomAuthProvider } from './AuthContext';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <CustomAuthProvider>
      {children}
    </CustomAuthProvider>
  );
}
