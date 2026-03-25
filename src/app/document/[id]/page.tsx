'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CollaborativeEditor } from '@/components/CollaborativeEditor';
import { secureApiService } from '@/lib/secure-api';
import type { Document } from '@/types/shared';

export default function DocumentPage() {
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const params = useParams();
  const { data: session, status } = useSession();
  const editMode = searchParams.get('edit') === 'true';

  useEffect(() => {
    const loadDocument = async () => {
      try {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
          setError('Usuário não autenticado');
          setIsLoading(false);
          return;
        }

        if (!session) return;

        const documentId = params?.id as string;
        if (!documentId) {
          throw new Error('ID do documento não encontrado');
        }

        const response = await secureApiService.getDocument(documentId, session);
        setDocument(response.document);
        setIsEditing(editMode);
        setIsLoading(false);
      } catch (err) {
        console.error('Erro ao carregar documento:', err);
        setError('Erro ao carregar documento');
        setIsLoading(false);
      }
    };

    if (params?.id && session) {
      loadDocument();
    }
  }, [params?.id, editMode, session, status]);

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center mx-auto mb-6">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <h2 className="font-display font-bold text-xl text-on-surface mb-2">CollabDocs</h2>
          <p className="text-sm text-on-surface-variant">Carregando documento...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="glass rounded-3xl p-12 text-center max-w-sm w-full animate-fade-in">
          <span
            className="material-symbols-outlined text-6xl text-error block mb-4"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48" }}
          >
            error
          </span>
          <h2 className="font-display font-bold text-xl text-on-surface mb-2">Erro</h2>
          <p className="text-sm text-on-surface-variant mb-6">{error || 'Documento não encontrado'}</p>
          <a
            href="/dashboard"
            className="btn-primary text-sm px-6 py-2.5 inline-block"
          >
            Voltar ao Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <CollaborativeEditor
        documentId={document.id}
        initialContent={document.content}
        session={session}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-outline-variant">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-primary-container rounded-xl flex items-center justify-center">
                <span className="font-display font-bold text-sm gradient-text">CD</span>
              </div>
              <div>
                <p className="font-display font-bold text-sm text-on-surface group-hover:text-secondary transition-colors">
                  CollabDocs
                </p>
                <p className="text-xs text-on-surface-variant truncate max-w-[200px]">{document.title}</p>
              </div>
            </a>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 rounded-full border border-success/20">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-xs font-medium text-success">Online</span>
            </div>

            <button
              onClick={handleToggleEdit}
              className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
              Editar
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Document header */}
        <div className="glass rounded-3xl p-8 mb-8 animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span
                className="material-symbols-outlined text-secondary text-3xl"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 32" }}
              >
                description
              </span>
            </div>
            <h1 className="font-display font-bold text-4xl text-on-surface mb-4">{document.title}</h1>
            <p className="text-on-surface-variant">Documento colaborativo em tempo real</p>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: 'visibility', label: 'Visibilidade', value: document.visibility === 'public' ? 'Público' : 'Privado' },
              { icon: 'person', label: 'Proprietário', value: document.owner_name || 'Desconhecido' },
              { icon: 'calendar_today', label: 'Criado', value: new Date(document.created_at).toLocaleDateString('pt-BR') },
              { icon: 'update', label: 'Atualizado', value: new Date(document.updated_at).toLocaleDateString('pt-BR') },
            ].map((item) => (
              <div key={item.label} className="bg-surface-container rounded-xl p-4 text-center">
                <span
                  className="material-symbols-outlined text-primary text-2xl block mb-2"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  {item.icon}
                </span>
                <p className="text-xs text-on-surface-variant mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-on-surface">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Editor prompt */}
        <div className="glass rounded-3xl overflow-hidden animate-slide-up">
          <div className="bg-primary-gradient px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-white text-2xl">edit_note</span>
              <h2 className="font-display font-bold text-lg text-white">Editor Colaborativo</h2>
            </div>
          </div>

          <div className="p-12 text-center">
            <span
              className="material-symbols-outlined text-6xl text-on-surface-variant block mb-6"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 48" }}
            >
              edit_note
            </span>
            <h3 className="font-display font-bold text-xl text-on-surface mb-3">
              Editor Pausado
            </h3>
            <p className="text-on-surface-variant text-sm mb-8 max-w-sm mx-auto">
              Clique em "Editar" para começar a colaborar neste documento em tempo real
            </p>
            <button
              onClick={handleToggleEdit}
              className="btn-primary text-base px-8 py-3 flex items-center gap-2 mx-auto"
            >
              <span className="material-symbols-outlined text-xl">edit</span>
              Iniciar Edição
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
