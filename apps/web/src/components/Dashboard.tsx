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
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando documentos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header do Dashboard */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            📝 Dashboard
          </h2>
          <p className="text-gray-600">
            Gerencie seus documentos colaborativos
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{documents.length}</div>
          <div className="text-sm text-gray-500">Documentos</div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">{documents.length}</div>
          <div className="text-sm text-gray-500">Documentos</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-green-600">12</div>
          <div className="text-sm text-gray-500">Colaboradores</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="text-2xl font-bold text-purple-600">24h</div>
          <div className="text-sm text-gray-500">Ativo</div>
        </div>
      </div>

      {/* Botão Criar Documento */}
      <div className="text-center">
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center gap-2 mx-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          ✨ Criar Novo Documento
        </button>
      </div>

      {/* Lista de Documentos */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-800">Documentos Recentes</h3>
        
        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">📝</div>
            <p>Nenhum documento criado ainda</p>
            <p className="text-sm">Clique em "Criar Novo Documento" para começar</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onDelete={handleDeleteDocument}
                formatTimeAgo={formatTimeAgo}
              />
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
    </div>
  );
}