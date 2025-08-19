'use client';

import { useEffect, useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface CollaborativeEditorProps {
  documentId: string;
}

export function CollaborativeEditor({ documentId }: CollaborativeEditorProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simular carregamento
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Documento: {documentId}
        </h2>
        <p className="text-gray-600">
          Editor colaborativo em desenvolvimento...
        </p>
      </div>
      
      <div className="border border-gray-300 rounded-lg p-4 min-h-[400px] bg-gray-50">
        <div className="text-center text-gray-500 py-20">
          <div className="text-4xl mb-4">📝</div>
          <p className="text-lg font-medium">Editor Colaborativo</p>
          <p className="text-sm">Funcionalidade em desenvolvimento</p>
        </div>
      </div>
      
      <div className="mt-4 text-center">
        <button 
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          onClick={() => alert('Funcionalidade em desenvolvimento!')}
        >
          Testar Funcionalidade
        </button>
      </div>
    </div>
  );
}