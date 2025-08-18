'use client';

import { Document } from '@collab-docs/shared';

interface DocumentCardProps {
  document: Document;
  onRefresh: () => void;
}

export function DocumentCard({ document, onRefresh }: DocumentCardProps) {
  const handleClick = () => {
    window.location.href = `/document/${document.id}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getVisibilityIcon = (visibility: string) => {
    if (visibility === 'public') {
      return (
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    );
  };

  return (
    <div
      onClick={handleClick}
      className="card p-6 hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2">
          {document.title}
        </h3>
        <div className="flex items-center gap-2 ml-2">
          {getVisibilityIcon(document.visibility)}
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Atualizado em {formatDate(document.updated_at)}
        </span>
        <span className="capitalize">
          {document.visibility}
        </span>
      </div>

      {/* Progress indicator */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Criado em {formatDate(document.created_at)}
          </span>
          <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}