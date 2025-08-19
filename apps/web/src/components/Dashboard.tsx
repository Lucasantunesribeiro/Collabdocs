'use client';

import { useState, useEffect } from 'react';
import { DocumentCard } from './DocumentCard';
import { CreateDocumentModal } from './CreateDocumentModal';

interface Document {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  visibility: 'private' | 'public';
  owner_id: string;
}

interface DashboardProps {
  user?: any;
}

export function Dashboard({ user }: DashboardProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dados de exemplo para demonstração
  const demoDocuments: Document[] = [
    {
      id: 'doc-1',
      title: '📋 Documento de Exemplo 1',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      visibility: 'private' as const,
      owner_id: 'demo-user'
    },
    {
      id: 'doc-2',
      title: '📝 Documento de Exemplo 2',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      visibility: 'public' as const,
      owner_id: 'demo-user'
    },
    {
      id: 'doc-3',
      title: '📊 Documento de Exemplo 3',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      visibility: 'private' as const,
      owner_id: 'demo-user'
    }
  ];

  useEffect(() => {
    // Simular carregamento de documentos
    const loadDocuments = async () => {
      try {
        // Se tivermos uma API real, aqui faríamos a chamada
        // const response = await fetch('https://collab-docs.collabdocs.workers.dev/api/documents', {
        //   headers: { 'Authorization': `Bearer ${token}` }
        // });
        // const data = await response.json();
        // setDocuments(data.documents);
        
        // Por enquanto, usar dados de exemplo
        setTimeout(() => {
          setDocuments(demoDocuments);
          setIsLoading(false);
        }, 1000);
      } catch (err) {
        setError('Erro ao carregar documentos');
        setIsLoading(false);
      }
    };

    loadDocuments();
  }, []);

  const handleCreateDocument = async (title: string, visibility: 'private' | 'public') => {
    try {
      // Se tivermos uma API real, aqui faríamos a chamada
      // const response = await fetch('https://collab-docs.collabdocs.workers.dev/api/documents', {
      //   method: 'POST',
      //   headers: { 
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${token}` 
      //   },
      //   body: JSON.stringify({ title, visibility })
      // });
      // const data = await response.json();
      
      // Por enquanto, criar documento localmente
      const newDoc: Document = {
        id: `doc-${Date.now()}`,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        visibility,
        owner_id: user?.id || 'demo-user'
      };
      
      setDocuments(prev => [newDoc, ...prev]);
      setShowCreateModal(false);
    } catch (err) {
      setError('Erro ao criar documento');
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      // Se tivermos uma API real, aqui faríamos a chamada
      // await fetch(`https://collab-docs.collabdocs.workers.dev/api/documents/${documentId}`, {
      //   method: 'DELETE',
      //   headers: { 'Authorization': `Bearer ${token}` }
      // });
      
      // Por enquanto, remover localmente
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    } catch (err) {
      setError('Erro ao deletar documento');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    } else if (diffHours > 0) {
      return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else {
      return 'há alguns minutos';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="relative">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-ping opacity-20"></div>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Carregando documentos...</h3>
        <p className="text-gray-600">Preparando seu workspace</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header do Dashboard */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl shadow-2xl mb-6">
          <span className="text-3xl">📊</span>
        </div>
        <h2 className="text-4xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
          Dashboard
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Gerencie seus documentos colaborativos e acompanhe as estatísticas
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <span className="text-xl">📝</span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">{documents.length}</div>
              <div className="text-sm text-gray-500">Documentos</div>
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000" style={{ width: `${Math.min((documents.length / 10) * 100, 100)}%` }}></div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <span className="text-xl">👥</span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600">12</div>
              <div className="text-sm text-gray-500">Colaboradores</div>
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-1000" style={{ width: '60%' }}></div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <span className="text-xl">⏰</span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600">24h</div>
              <div className="text-sm text-gray-500">Ativo</div>
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-1000 animate-pulse" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>

      {/* Botão Criar Documento */}
      <div className="text-center">
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-3xl transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 flex items-center gap-3 mx-auto group"
        >
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          ✨ Criar Novo Documento
        </button>
      </div>

      {/* Lista de Documentos */}
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Documentos Recentes</h3>
          <p className="text-gray-600">Seus documentos colaborativos em um só lugar</p>
        </div>
        
        {documents.length === 0 ? (
          <div className="text-center py-16 bg-white/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-gray-300 animate-fade-in">
            <div className="text-6xl mb-4">📝</div>
            <h4 className="text-xl font-semibold text-gray-800 mb-2">Nenhum documento criado ainda</h4>
            <p className="text-gray-600 mb-6">Clique em "Criar Novo Documento" para começar sua jornada</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-2xl font-medium hover:shadow-lg transition-all duration-200"
            >
              🚀 Criar Primeiro Documento
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {documents.map((doc, index) => (
              <div key={doc.id} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                <DocumentCard
                  document={doc}
                  onDelete={handleDeleteDocument}
                  formatTimeAgo={formatTimeAgo}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Criação */}
      {showCreateModal && (
        <CreateDocumentModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateDocument}
        />
      )}

      {/* Mensagem de Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}