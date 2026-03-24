'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { secureApiService, type Collaborator } from '@/lib/secure-api';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { Alert } from './ui/Alert';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Link, 
  Image, 
  Save,
  Users,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface CollaborativeEditorProps {
  documentId: string;
  initialContent: string;
  session: {
    user: { id: string; name: string; email: string; image?: string };
    sessionToken?: string;
  } | null;
}

function useCollaboration(documentId: string, token: string) {
  const [connectedUsers, setConnectedUsers] = useState<{ userId: string; userName: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!documentId || documentId === 'demo' || !token) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://collab-docs.collabdocs.workers.dev';
    // Pass JWT as ?token= because browsers cannot set custom headers on WS upgrades.
    // The Worker router verifies the token and injects server-trusted identity params.
    const ws = new WebSocket(
      `${wsUrl}/api/documents/${documentId}/ws?token=${encodeURIComponent(token)}`
    );

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'connected') {
          setConnectedUsers(msg.users);
        } else if (msg.type === 'join') {
          setConnectedUsers(prev => [...prev, { userId: msg.userId, userName: msg.userName }]);
        } else if (msg.type === 'leave') {
          setConnectedUsers(prev => prev.filter(u => u.userId !== msg.userId));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {}; // silent fail for demo
    wsRef.current = ws;

    return () => ws.close();
  }, [documentId, token]);

  const broadcast = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'update', documentId, content }));
    }
  }, [documentId]);

  return { connectedUsers, broadcast };
}

export function CollaborativeEditor({ documentId, initialContent, session }: CollaborativeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isTyping, setIsTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(true);

  // Real-time collaboration via WebSocket (JWT passed as ?token= query param)
  const { connectedUsers, broadcast } = useCollaboration(
    documentId,
    session?.sessionToken || ''
  );

  // Salvamento automático
  useEffect(() => {
    if (isDirty && !isTyping) {
      const timer = setTimeout(() => {
        handleAutoSave();
      }, 2000); // Salvar automaticamente após 2 segundos sem digitação

      return () => clearTimeout(timer);
    }
  }, [content, isTyping, isDirty, documentId]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsTyping(true);
    setIsDirty(true);

    // Broadcast content change to other collaborators in real-time
    broadcast(newContent);

    // Simular indicador de digitação
    setTimeout(() => setIsTyping(false), 1000);
  };

  const handleAutoSave = async () => {
    if (!isDirty) return;
    
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      // Salvar na API
      await secureApiService.updateDocument(documentId, { content }, session);
      
      setLastSaved(new Date());
      setIsDirty(false);
      setSaveStatus('saved');
      
      // Salvar no localStorage como backup
      localStorage.setItem(`collabdocs_document_${documentId}_content`, content);
      localStorage.setItem(`collabdocs_document_${documentId}_last_saved`, new Date().toISOString());
      
    } catch (error) {
      setSaveStatus('error');
      console.error('Erro ao salvar automaticamente:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      // Salvar na API
      await secureApiService.updateDocument(documentId, { content }, session);
      
      setLastSaved(new Date());
      setIsDirty(false);
      setSaveStatus('saved');
      
      // Salvar no localStorage como backup
      localStorage.setItem(`collabdocs_document_${documentId}_content`, content);
      localStorage.setItem(`collabdocs_document_${documentId}_last_saved`, new Date().toISOString());
      
      // Mostrar feedback visual
      setTimeout(() => setSaveStatus('saved'), 2000);
      
    } catch (error) {
      setSaveStatus('error');
      console.error('Erro ao salvar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Carregar colaboradores
  const loadCollaborators = async () => {
    try {
      setIsLoadingCollaborators(true);
      const response = await secureApiService.getDocumentCollaborators(documentId, session);
      setCollaborators(response.collaborators || []);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
      // Fallback: minimal collaborator entry for the current user (only if session is available)
      if (session?.user) {
        setCollaborators([{
          id: `user-${session.user.id}`,
          document_id: documentId,
          user_id: session.user.id,
          user_email: session.user.email,
          permission: 'owner',
          added_by: session.user.id,
          created_at: new Date().toISOString(),
        }]);
      }
    } finally {
      setIsLoadingCollaborators(false);
    }
  };

  // Carregar conteúdo salvo ao inicializar
  useEffect(() => {
    const savedContent = localStorage.getItem(`collabdocs_document_${documentId}_content`);
    const savedLastSaved = localStorage.getItem(`collabdocs_document_${documentId}_last_saved`);
    
    if (savedContent) {
      setContent(savedContent);
      setIsDirty(false);
    }
    
    if (savedLastSaved) {
      setLastSaved(new Date(savedLastSaved));
    }
  }, [documentId]);

  // Carregar colaboradores ao inicializar
  useEffect(() => {
    if (session && documentId) {
      loadCollaborators();
    }
  }, [session, documentId]);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  };

  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saved': return <CheckCircle className="w-4 h-4" />;
      case 'saving': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getSaveStatusColor = () => {
    switch (saveStatus) {
      case 'saved': return 'text-success-600';
      case 'saving': return 'text-primary-600';
      case 'error': return 'text-error-600';
      default: return 'text-text-600';
    }
  };

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saved': return 'Salvo';
      case 'saving': return 'Salvando...';
      case 'error': return 'Erro ao salvar';
      default: return 'Não salvo';
    }
  };

  return (
    <div className="min-h-screen bg-background-50">
      {/* Toolbar Fixa */}
      <div className="sticky top-0 z-40 bg-white border-b border-text-200 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Ferramentas de Formatação */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" icon={Bold}>
                {' '}
              </Button>
              <Button variant="ghost" size="sm" icon={Italic}>
                {' '}
              </Button>
              <div className="w-px h-6 bg-text-200 mx-2"></div>
              <Button variant="ghost" size="sm" icon={List}>
                {' '}
              </Button>
              <Button variant="ghost" size="sm" icon={ListOrdered}>
                {' '}
              </Button>
              <div className="w-px h-6 bg-text-200 mx-2"></div>
              <Button variant="ghost" size="sm" icon={Quote}>
                {' '}
              </Button>
              <Button variant="ghost" size="sm" icon={Code}>
                {' '}
              </Button>
              <Button variant="ghost" size="sm" icon={Link}>
                {' '}
              </Button>
              <Button variant="ghost" size="sm" icon={Image}>
                {' '}
              </Button>
            </div>

            {/* Status e Ações */}
            <div className="flex items-center gap-4">
              {/* Indicador de digitação */}
              {isTyping && (
                <div className="flex items-center gap-2 text-sm text-text-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>Digitando...</span>
                </div>
              )}

              {/* Status de salvamento */}
              <div className={`flex items-center gap-2 text-sm ${getSaveStatusColor()}`}>
                {getSaveStatusIcon()}
                <span>{getSaveStatusText()}</span>
              </div>

              {/* Botão de salvar manual */}
              <Button
                onClick={handleManualSave}
                disabled={isSaving || !isDirty}
                variant={isDirty && !isSaving ? 'primary' : 'secondary'}
                size="sm"
                icon={Save}
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Área de Edição */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Editor Principal */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-0">
                <textarea
                  value={content}
                  onChange={handleContentChange}
                  className="w-full min-h-[calc(100vh-300px)] p-8 bg-white border-0 rounded-xl focus:outline-none focus:ring-0 resize-none font-mono text-text-800 leading-relaxed text-base"
                  placeholder="Comece a digitar seu documento..."
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar de Colaboração */}
          <div className="lg:col-span-1 space-y-6">
            {/* Colaboradores Online */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-text-600" />
                  <h4 className="font-medium text-text-900">Colaboradores</h4>
                  {connectedUsers.length > 0 && (
                    <span className="ml-auto text-xs font-medium text-success-600 bg-success-50 px-2 py-0.5 rounded-full">
                      {connectedUsers.length + 1} online
                    </span>
                  )}
                  {isLoadingCollaborators && (
                    <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                  )}
                </div>
                <div className="space-y-3">
                  {collaborators.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-text-500">Carregando colaboradores...</p>
                    </div>
                  ) : (
                    collaborators.map((collaborator) => {
                      const isCurrentUser = session?.user && (collaborator.user_id === session.user.id || collaborator.user_email === session.user.email);
                      const isOwner = collaborator.permission === 'owner';
                      return (
                        <div key={collaborator.id} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCurrentUser ? 'bg-primary-100' : isOwner ? 'bg-warning-100' : 'bg-success-100'
                          }`}>
                            <span className={`text-sm font-medium ${
                              isCurrentUser ? 'text-primary-600' : isOwner ? 'text-warning-600' : 'text-success-600'
                            }`}>
                              {collaborator.user_email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-900 truncate">
                              {collaborator.user_email}
                              {isCurrentUser && <span className="ml-2 text-xs text-primary-600">(Você)</span>}
                              {isOwner && <span className="ml-2 text-xs text-warning-600">(Proprietário)</span>}
                            </p>
                            <p className="text-xs text-text-500 capitalize">{collaborator.permission}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas do Documento */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-text-600" />
                  <h4 className="font-medium text-text-900">Estatísticas</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-600">Caracteres:</span>
                    <span className="font-medium text-text-900">{content.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-600">Palavras:</span>
                    <span className="font-medium text-text-900">{content.split(' ').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-600">Linhas:</span>
                    <span className="font-medium text-text-900">{content.split('\n').length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status de Salvamento */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-text-600" />
                  <h4 className="font-medium text-text-900">Status</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-600">Status:</span>
                    <span className={`font-medium ${isDirty ? 'text-warning-600' : 'text-success-600'}`}>
                      {isDirty ? 'Não salvo' : 'Salvo'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-600">Último salvamento:</span>
                    <span className="font-medium text-text-900">{formatTimeAgo(lastSaved)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer do Editor */}
      <div className="bg-white border-t border-text-200 py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between text-sm text-text-600">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {content.length} caracteres
              </span>
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {content.split(' ').length} palavras
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {content.split('\n').length} linhas
              </span>
            </div>

            <div className="flex items-center gap-6">
              <span className={`flex items-center gap-2 ${isDirty ? 'text-warning-600' : 'text-success-600'}`}>
                {isDirty ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                {isDirty ? 'Não salvo' : 'Salvo'}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Último salvamento: {formatTimeAgo(lastSaved)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dicas de Colaboração */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Alert type="info" title="Dicas para Colaboração Eficiente">
          <ul className="text-sm space-y-1 mt-2">
            <li>• Use o botão "Salvar" para persistir suas alterações</li>
            <li>• O salvamento automático acontece após 2 segundos sem digitação</li>
            <li>• Comunique-se com sua equipe sobre mudanças significativas</li>
            <li>• Use Markdown para formatação avançada</li>
          </ul>
        </Alert>
      </div>
    </div>
  );
}