'use client';

import { useState, useEffect } from 'react';
import { DocumentCard } from './DocumentCard';
import { CreateDocumentModal } from './CreateDocumentModal';
import { apiService, Document } from '@/lib/api';
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
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
            </div>
            <h3 className="text-xl font-semibold text-text-800 mb-2">Carregando documentos...</h3>
            <p className="text-text-600">Preparando seu workspace</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      {/* Header Mobile */}
      <div className="lg:hidden bg-white border-b border-text-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-900">CollabDocs</h1>
          <Button
            variant="ghost"
            size="sm"
            icon={sidebarOpen ? X : Menu}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {' '}
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-text-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 border-b border-text-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-semibold text-text-900">CollabDocs</h1>
              </div>
            </div>

            {/* Navegação */}
            <nav className="flex-1 p-4 space-y-2">
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-text-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-colors">
                <FolderOpen className="w-5 h-5" />
                <span>Meus Documentos</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-text-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-colors">
                <Users className="w-5 h-5" />
                <span>Compartilhados</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-text-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-colors">
                <BarChart3 className="w-5 h-5" />
                <span>Estatísticas</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-text-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
                <span>Configurações</span>
              </a>
            </nav>

            {/* User Info */}
            <div className="p-4 border-t border-text-200">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900" data-user-name={user?.name || ''}>
                      {user?.name || 'Usuário'}
                    </div>
                    <div className="text-sm text-gray-500" data-user-email={user?.email || ''}>
                      {user?.email || 'no-email@example.com'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overlay para mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Área de Conteúdo Principal */}
        <div className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header do Dashboard */}
            <div className="text-center">
              <h2 className="text-3xl font-semibold text-text-900 mb-3">
                Dashboard
              </h2>
              <p className="text-text-600 max-w-2xl mx-auto">
                Gerencie seus documentos colaborativos e acompanhe as estatísticas
              </p>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card hover>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary-600" />
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-primary-600">{documents.length}</div>
                      <div className="text-sm text-text-500">Documentos</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card hover>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-success-600" />
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-success-600">12</div>
                      <div className="text-sm text-text-500">Colaboradores</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card hover>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-warning-600" />
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-warning-600">24h</div>
                      <div className="text-sm text-text-500">Ativo</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-text-800 mb-2">Documentos Recentes</h3>
                <p className="text-text-600">Seus documentos colaborativos em um só lugar</p>
                
                {/* Mensagem de segurança */}
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-info-50 border border-info-200 rounded-lg">
                  <div className="w-5 h-5 bg-info-100 rounded-full flex items-center justify-center">
                    <span className="text-info-600 text-sm">🔒</span>
                  </div>
                  <span className="text-sm text-info-700 font-medium">
                    Documentos privados são visíveis apenas para seus criadores
                  </span>
                </div>
              </div>
              
              {documents.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-16">
                    <div className="w-16 h-16 bg-text-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-text-400" />
                    </div>
                    <h4 className="text-xl font-semibold text-text-800 mb-2">Nenhum documento criado ainda</h4>
                    <p className="text-text-600 mb-6">Clique em "Criar Novo Documento" para começar sua jornada</p>
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      size="lg"
                    >
                      Criar Primeiro Documento
                    </Button>
                  </CardContent>
                </Card>
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
              <Alert type="error">
                {error}
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}