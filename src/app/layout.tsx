import { Inter } from 'next/font/google';
import './globals.css';
import { Metadata } from 'next';
import ClientSessionProvider from '@/components/ClientSessionProvider';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

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
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">
        <ClientSessionProvider>
          {children}
        </ClientSessionProvider>
      </body>
    </html>
  );
}