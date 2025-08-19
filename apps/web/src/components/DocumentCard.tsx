'use client';

import { useState } from 'react';

interface Document {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  visibility: 'private' | 'public';
  owner_id: string;
}

interface DocumentCardProps {
  document: Document;
  onDelete: (documentId: string) => void;
  formatTimeAgo: (dateString: string) => string;
}

export function DocumentCard({ document, onDelete, formatTimeAgo }: DocumentCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpen = () => {
    // Redirecionar para o editor do documento
    window.location.href = `/document/${document.id}`;
  };

  const handleEdit = () => {
    // Por enquanto, redirecionar para o editor
    // No futuro, pode abrir um modal de edição
    window.location.href = `/document/${document.id}`;
  };

  const handleDelete = async () => {
    if (confirm(`Tem certeza que deseja deletar "${document.title}"?`)) {
      setIsDeleting(true);
      try {
        await onDelete(document.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const getVisibilityIcon = () => {
    return document.visibility === 'private' ? '🔒' : '🌐';
  };

  const getVisibilityText = () => {
    return document.visibility === 'private' ? 'Privado' : 'Público';
  };

  const getCardColor = () => {
    const colors = {
      private: 'bg-blue-50 border-blue-200',
      public: 'bg-green-50 border-green-200'
    };
    return colors[document.visibility];
  };

  const getTextColor = () => {
    const colors = {
      private: 'text-blue-900',
      public: 'text-green-900'
    };
    return colors[document.visibility];
  };

  return (
    <div className={`${getCardColor()} border rounded-lg p-4 transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className={`font-medium ${getTextColor()}`}>
              {document.title}
            </h4>
            <span className="text-sm opacity-75">
              {getVisibilityIcon()} {getVisibilityText()}
            </span>
          </div>
          <p className={`text-sm ${getTextColor()} opacity-75`}>
            Criado {formatTimeAgo(document.created_at)}
          </p>
          <p className={`text-sm ${getTextColor()} opacity-75`}>
            Atualizado {formatTimeAgo(document.updated_at)}
          </p>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={handleOpen}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            Abrir
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="text-gray-500 hover:text-gray-700 p-1 rounded transition-colors"
              aria-label="Mais ações"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            {showActions && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={handleEdit}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg transition-colors"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg transition-colors disabled:opacity-50"
                >
                  {isDeleting ? '🗑️ Deletando...' : '🗑️ Deletar'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}