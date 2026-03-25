import type { Metadata } from 'next';
import './globals.css';
import ClientSessionProvider from '@/components/ClientSessionProvider';

export const metadata: Metadata = {
  title: 'CollabDocs - Editor Colaborativo',
  description: 'Editor de documentos colaborativo em tempo real',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <ClientSessionProvider>
          {children}
        </ClientSessionProvider>
      </body>
    </html>
  );
}
