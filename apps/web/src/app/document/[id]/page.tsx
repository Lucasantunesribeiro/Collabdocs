'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { CollaborativeEditor } from '@/components/CollaborativeEditor';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function DocumentPage() {
  const { id } = useParams();
  const { user, token, isLoading } = useAuth();
  const documentId = Array.isArray(id) ? id[0] : id;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user || !token) {
    window.location.href = '/';
    return null;
  }

  if (!documentId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Documento não encontrado
          </h1>
          <p className="text-gray-600 mb-4">
            O documento que você está procurando não existe ou foi removido.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="btn btn-primary"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <CollaborativeEditor 
      documentId={documentId} 
      token={token} 
      user={user}
    />
  );
}