import { Inter } from 'next/font/google';
import { AuthProvider } from '@/context/AuthProvider';
import './globals.css';
import { Metadata } from 'next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CollabDocs - Editor Colaborativo',
  description: 'Editor de documentos colaborativo em tempo real com CRDT',
  icons: {
    icon: '/favicon.svg',
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}