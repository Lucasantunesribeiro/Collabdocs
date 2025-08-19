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
  onDelete: (id: string) => void;
  formatTimeAgo: (dateString: string) => string;
}

export function DocumentCard({ document, onDelete, formatTimeAgo }: DocumentCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja deletar este documento?')) {
      onDelete(document.id);
    }
    setShowDropdown(false);
  };

  const handleOpen = () => {
    // Redirecionar para a página do documento
    window.location.href = `/document/${document.id}`;
  };

  const handleEdit = () => {
    // Redirecionar para a página de edição do documento
    window.location.href = `/document/${document.id}?edit=true`;
  };

  const getVisibilityIcon = () => {
    return document.visibility === 'private' ? '🔒' : '🌐';
  };

  const getVisibilityColor = () => {
    return document.visibility === 'private' 
      ? 'bg-purple-100 text-purple-800 border-purple-200' 
      : 'bg-green-100 text-green-800 border-green-200';
  };

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
      <div className="p-6">
        {/* Header do Card */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-white text-lg">📄</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                  {document.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getVisibilityColor()}`}>
                    {getVisibilityIcon()} {document.visibility === 'private' ? 'Privado' : 'Público'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Menu de ações */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 group-hover:scale-110"
              title="Mais ações"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-200/50 backdrop-blur-md z-10 animate-slide-up">
                <div className="py-2">
                  <button
                    onClick={handleOpen}
                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-200 flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-200">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <span className="font-medium">Abrir</span>
                  </button>
                  
                  <button
                    onClick={handleEdit}
                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors duration-200 flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors duration-200">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <span className="font-medium">Editar</span>
                  </button>
                  
                  <div className="border-t border-gray-200/50 my-1"></div>
                  
                  <button
                    onClick={handleDelete}
                    className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors duration-200 flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors duration-200">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <span className="font-medium">Deletar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informações do documento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Criado</p>
                <p className="text-sm text-gray-600">{formatTimeAgo(document.created_at)}</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Atualizado</p>
                <p className="text-sm text-gray-600">{formatTimeAgo(document.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer do Card */}
        <div className="mt-6 pt-4 border-t border-gray-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">👤</span>
              </div>
              <span className="text-sm text-gray-600">Proprietário</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-500">Online</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}