'use client';

import { useState, useEffect } from 'react';
import { DocumentCard } from './DocumentCard';
import { CreateDocumentModal } from './CreateDocumentModal';
import { apiService } from '@/lib/api';
import type { Document } from '@/types/shared';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Alert } from './ui/Alert';
import { 
  FileText, 
  Users, 
  Clock, 
  Plus, 
  FolderOpen, 
  Settings, 
  BarChart3,
  Menu,
  X
} from 'lucide-react';

interface DashboardProps {
  user?: any;
}

export function Dashboard({ user }: DashboardProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await apiService.getDocuments();
        setDocuments(response.documents);
        setIsLoading(false);
      } catch (err) {
        console.error('Erro ao carregar documentos:', err);
        setError('Erro ao carregar documentos');
        setIsLoading(false);
      }
    };

    loadDocuments();
  }, []);

  const handleCreateDocument = async (title: string, visibility: 'private' | 'public') => {
    try {
      const response = await apiService.createDocument({ title, visibility });
      
      setDocuments(prev => [response.document, ...prev]);
      setShowCreateModal(false);
    } catch (err) {
      console.error('Erro ao criar documento:', err);
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Carregando documentos</h3>
          <p className="text-gray-600 text-sm">Preparando seu workspace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header do Dashboard */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Dashboard
        </h2>
        <p className="text-gray-600">
          Gerencie seus documentos colaborativos
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-gray-700" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-gray-900">{documents.length}</div>
              <div className="text-sm text-gray-600">Documentos</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-gray-700" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-gray-900">1</div>
              <div className="text-sm text-gray-600">Colaboradores</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-gray-700" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-gray-900">Hoje</div>
              <div className="text-sm text-gray-600">Última atividade</div>
            </div>
          </div>
        </div>
      </div>

      {/* Botão Criar Documento */}
      <div className="text-center">
        <Button
          onClick={() => setShowCreateModal(true)}
          size="lg"
          icon={Plus}
          className="px-8"
        >
          Criar Novo Documento
        </Button>
      </div>

      {/* Lista de Documentos */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Documentos Recentes</h3>
          <p className="text-gray-600">Seus documentos em um só lugar</p>
        </div>
        
        {documents.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Nenhum documento criado</h4>
            <p className="text-gray-600 mb-6">Comece criando seu primeiro documento</p>
            <Button
              onClick={() => setShowCreateModal(true)}
              size="lg"
            >
              Criar Primeiro Documento
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
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
        <Alert type="error">
          {error}
        </Alert>
      )}
    </div>
  );
}