'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { secureApiService, type Collaborator } from '@/lib/secure-api';
import { useRouter } from 'next/navigation';
import { ShareModal } from './ShareModal';

interface CollaborativeEditorProps {
  documentId: string;
  initialContent: string;
  session: {
    user: { id: string; name: string; email: string; image?: string };
    sessionToken?: string;
  } | null;
}

function useCollaboration(
  documentId: string,
  token: string,
  onRemoteUpdate: (content: string) => void
) {
  const [connectedUsers, setConnectedUsers] = useState<{ userId: string; userName: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  useEffect(() => { onRemoteUpdateRef.current = onRemoteUpdate; });

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
        if (msg.type === 'connected') setConnectedUsers(msg.users);
        else if (msg.type === 'join') setConnectedUsers(prev => [...prev, { userId: msg.userId, userName: msg.userName }]);
        else if (msg.type === 'leave') setConnectedUsers(prev => prev.filter(u => u.userId !== msg.userId));
        else if (msg.type === 'update' && typeof msg.content === 'string') onRemoteUpdateRef.current(msg.content);
      } catch { /* ignore malformed messages */ }
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
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [isTyping, setIsTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);

  const { connectedUsers, broadcast } = useCollaboration(
    documentId,
    session?.sessionToken || '',
    (remoteContent) => setContent(remoteContent)
  );

  // Auto-save: trigger 2s after last keystroke when document is dirty
  useEffect(() => {
    if (isDirty && !isTyping) {
      const timer = setTimeout(() => handleAutoSave(), 2000);
      return () => clearTimeout(timer);
    }
  }, [content, isTyping, isDirty, documentId]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsTyping(true);
    setIsDirty(true);
    broadcast(newContent);
    setTimeout(() => setIsTyping(false), 1000);
  };

  const handleAutoSave = async () => {
    if (!isDirty || !session) return;
    setIsSaving(true);
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await secureApiService.updateDocument(documentId, { content }, session);
      setLastSaved(new Date());
      setIsDirty(false);
      setSaveStatus('saved');
      localStorage.setItem(`collabdocs_document_${documentId}_content`, content);
      localStorage.setItem(`collabdocs_document_${documentId}_last_saved`, new Date().toISOString());
    } catch (err) {
      setSaveStatus('error');
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
        setSaveError('Você não tem permissão para editar este documento. Apenas o proprietário ou colaboradores com acesso de escrita podem salvar alterações.');
      } else {
        setSaveError('Não foi possível salvar o documento. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSave = async () => {
    if (!session) return;
    setIsSaving(true);
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await secureApiService.updateDocument(documentId, { content }, session);
      setLastSaved(new Date());
      setIsDirty(false);
      setSaveStatus('saved');
      localStorage.setItem(`collabdocs_document_${documentId}_content`, content);
      localStorage.setItem(`collabdocs_document_${documentId}_last_saved`, new Date().toISOString());
      setTimeout(() => setSaveStatus('saved'), 2000);
    } catch (err) {
      setSaveStatus('error');
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
        setSaveError('Você não tem permissão para editar este documento. Apenas o proprietário ou colaboradores com acesso de escrita podem salvar alterações.');
      } else {
        setSaveError('Não foi possível salvar o documento. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const loadCollaborators = async () => {
    if (!session) return;
    try {
      setIsLoadingCollaborators(true);
      const response = await secureApiService.getDocumentCollaborators(documentId, session);
      setCollaborators(response.collaborators || []);
    } catch {
      // Fallback: minimal collaborator entry for the current user
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

  // Restore from localStorage on mount
  useEffect(() => {
    const savedContent = localStorage.getItem(`collabdocs_document_${documentId}_content`);
    const savedLastSaved = localStorage.getItem(`collabdocs_document_${documentId}_last_saved`);
    if (savedContent) { setContent(savedContent); setIsDirty(false); }
    if (savedLastSaved) setLastSaved(new Date(savedLastSaved));
  }, [documentId]);

  useEffect(() => {
    if (session && documentId) loadCollaborators();
  }, [session, documentId]);

  const formatTimeAgo = (date: Date) => {
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `há ${diffMins}min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    return `há ${Math.floor(diffHours / 24)}d`;
  };

  const saveStatusConfig = {
    saved: { icon: 'check_circle', color: 'text-success', text: 'Salvo' },
    saving: { icon: 'sync', color: 'text-primary', text: 'Salvando...' },
    error: { icon: 'error', color: 'text-error', text: 'Erro ao salvar' },
  }[saveStatus];

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Permission / save error banner */}
      {saveError && (
        <div className="sticky top-0 z-50 flex items-start gap-3 bg-error-container border-b border-error/30 px-4 md:px-6 py-3">
          <span
            className="material-symbols-outlined text-error flex-shrink-0 mt-0.5"
            style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
          >
            lock
          </span>
          <p className="text-sm text-error flex-1">{saveError}</p>
          <button
            onClick={() => setSaveError(null)}
            className="text-error/60 hover:text-error transition-colors flex-shrink-0"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>
      )}

      {/* Editor Header */}
      <header className="sticky top-0 z-40 glass border-b border-outline-variant px-4 md:px-6 py-3">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          {/* Back */}
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-high transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>

          {/* Title + save status */}
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-sm text-on-surface truncate">
              {documentId === 'demo' ? 'Documento Demo' : `Documento ${documentId.slice(0, 8)}...`}
            </p>
            <div className={`flex items-center gap-1 text-xs ${saveStatusConfig.color}`}>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '12px',
                  animation: saveStatus === 'saving' ? 'spin 1s linear infinite' : 'none'
                }}
              >
                {saveStatusConfig.icon}
              </span>
              {saveStatusConfig.text}
              {saveStatus === 'saved' && (
                <span className="text-on-surface-variant"> · {formatTimeAgo(lastSaved)}</span>
              )}
            </div>
          </div>

          {/* Connected users strip */}
          {connectedUsers.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {connectedUsers.slice(0, 3).map((u) => (
                <div
                  key={u.userId}
                  className="w-7 h-7 rounded-full bg-primary-container border-2 border-surface flex items-center justify-center"
                  title={u.userName}
                >
                  <span className="text-xs font-semibold text-secondary">
                    {u.userName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              ))}
              {connectedUsers.length > 3 && (
                <span className="text-xs text-on-surface-variant ml-1">+{connectedUsers.length - 3}</span>
              )}
            </div>
          )}

          {/* Format toolbar (desktop) */}
          <div className="hidden md:flex items-center gap-1 px-2 py-1 glass rounded-xl">
            {['format_bold', 'format_italic', 'format_list_bulleted', 'link'].map((icon) => (
              <button
                key={icon}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
              </button>
            ))}
          </div>

          {/* Share */}
          <button
            onClick={() => setShowShareModal(true)}
            className="p-2 rounded-xl border border-outline text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors flex-shrink-0"
            title="Compartilhar"
          >
            <span className="material-symbols-outlined">share</span>
          </button>

          {/* Save */}
          <button
            onClick={handleManualSave}
            disabled={isSaving || !isDirty}
            className={`btn-primary text-sm px-4 py-2 flex items-center gap-2 flex-shrink-0 ${(!isDirty || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="material-symbols-outlined text-lg">save</span>
            <span className="hidden sm:inline">Salvar</span>
          </button>
        </div>
      </header>

      {/* Editor body */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Main textarea */}
        <div className="flex-1 flex flex-col">
          {/* Mobile format toolbar */}
          <div className="md:hidden flex items-center gap-1 px-4 py-2 border-b border-outline-variant">
            {['format_bold', 'format_italic', 'format_list_bulleted', 'link', 'format_quote'].map((icon) => (
              <button
                key={icon}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-high transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
              </button>
            ))}
          </div>

          <textarea
            value={content}
            onChange={handleContentChange}
            className="flex-1 w-full p-6 md:p-10 bg-transparent text-on-surface font-mono text-base leading-relaxed resize-none focus:outline-none placeholder:text-on-surface-variant"
            placeholder="Comece a escrever seu documento..."
            style={{ minHeight: 'calc(100vh - 200px)' }}
          />

          {/* Bottom status bar */}
          <div className="px-6 md:px-10 py-3 border-t border-outline-variant flex items-center gap-4 text-xs text-on-surface-variant">
            <span>{content.length} caracteres</span>
            <span>{content.trim().split(/\s+/).filter(Boolean).length} palavras</span>
            <span>{content.split('\n').length} linhas</span>
            {isTyping && (
              <span className="flex items-center gap-1 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Digitando...
              </span>
            )}
          </div>
        </div>

        {/* Right sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col w-72 border-l border-outline-variant p-4 gap-4">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
              Colaboradores ({collaborators.length})
            </p>
            {isLoadingCollaborators ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-10 rounded-xl bg-surface-container animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {collaborators.map((c) => {
                  const isCurrentUser = session?.user && (
                    c.user_id === session.user.id || c.user_email === session.user.email
                  );
                  const isOnline = connectedUsers.some(u => u.userId === c.user_id);
                  return (
                    <div key={c.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-container transition-colors">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
                          <span className="text-xs font-semibold text-secondary">
                            {c.user_email?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        {(isOnline || isCurrentUser) && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success border-2 border-surface" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-on-surface truncate">
                          {isCurrentUser ? 'Você' : c.user_email}
                        </p>
                        <p className="text-xs text-on-surface-variant capitalize">{c.permission}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-auto">
            <button
              onClick={() => setShowShareModal(true)}
              className="w-full btn-primary text-sm py-2.5 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              Adicionar Colaborador
            </button>
          </div>
        </aside>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          documentId={documentId}
          session={session}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
