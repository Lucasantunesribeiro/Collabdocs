'use client';

import { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { CloudflareProvider } from '@collab-docs/yjs-provider';
import { JWTPayload, Document, PresenceData } from '@collab-docs/shared';
import { LoadingSpinner } from './LoadingSpinner';

interface CollaborativeEditorProps {
  documentId: string;
  token: string;
  user: JWTPayload;
}

export function CollaborativeEditor({ documentId, token, user }: CollaborativeEditorProps) {
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [presenceList, setPresenceList] = useState<PresenceData[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<CloudflareProvider | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({
        document: ydocRef.current,
      }),
      CollaborationCursor.configure({
        provider: providerRef.current,
        user: {
          name: user.name,
          color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none',
      },
    },
  }, []);

  useEffect(() => {
    const initializeEditor = async () => {
      try {
        // Fetch document metadata
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${apiUrl}/api/documents/${documentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            setError('Você não tem permissão para acessar este documento.');
          } else if (response.status === 404) {
            setError('Documento não encontrado.');
          } else {
            setError('Erro ao carregar documento.');
          }
          return;
        }

        const data = await response.json();
        setDocument(data.document);

        // Initialize Yjs document
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        // Load snapshot if exists
        if (data.document.last_snapshot_r2_key) {
          try {
            const snapshotResponse = await fetch(`${apiUrl}/api/documents/${documentId}/snapshot`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            if (snapshotResponse.ok) {
              const snapshotBuffer = await snapshotResponse.arrayBuffer();
              const snapshotData = new Uint8Array(snapshotBuffer);
              
              // Decompress if needed
              const decompressed = await decompressData(snapshotData);
              Y.applyUpdate(ydoc, decompressed);
            }
          } catch (snapshotError) {
            console.warn('Failed to load snapshot:', snapshotError);
          }
        }

        // Initialize provider
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8787';
        const provider = new CloudflareProvider(ydoc, {
          documentId,
          token,
          url: wsUrl,
          onPresence: handlePresenceUpdate,
          onComment: handleComment,
        });

        providerRef.current = provider;

        // Monitor connection status
        const checkConnection = () => {
          setIsConnected(provider.isConnected);
        };

        const connectionInterval = setInterval(checkConnection, 1000);
        
        return () => {
          clearInterval(connectionInterval);
          provider.disconnect();
        };

      } catch (error) {
        console.error('Error initializing editor:', error);
        setError('Erro ao inicializar editor.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeEditor();
  }, [documentId, token]);

  const handlePresenceUpdate = (data: PresenceData[]) => {
    setPresenceList(data);
  };

  const handleComment = (data: any) => {
    // TODO: Handle comments
    console.log('New comment:', data);
  };

  const decompressData = async (compressedData: Uint8Array): Promise<Uint8Array> => {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    writer.write(compressedData);
    writer.close();

    const chunks: Uint8Array[] = [];
    let result = await reader.read();

    while (!result.done) {
      chunks.push(result.value);
      result = await reader.read();
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const decompressed = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      decompressed.set(chunk, offset);
      offset += chunk.length;
    }

    return decompressed;
  };

  const goBack = () => {
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner className="mb-4" />
          <p className="text-gray-600">Carregando documento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.958-.833-2.728 0L3.086 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Erro</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={goBack} className="btn btn-primary">
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={goBack}
                className="btn btn-ghost text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                {document?.title}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>

              {/* Presence Indicators */}
              {presenceList.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {presenceList.slice(0, 5).map((presence, index) => (
                      <div
                        key={presence.userId}
                        className="presence-indicator online"
                        title={presence.name}
                        style={{ zIndex: presenceList.length - index }}
                      >
                        {presence.avatar_url ? (
                          <img
                            src={presence.avatar_url}
                            alt={presence.name}
                            className="w-full h-full rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-medium">
                            {presence.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {presenceList.length > 5 && (
                    <span className="text-sm text-gray-500">
                      +{presenceList.length - 5}
                    </span>
                  )}
                </div>
              )}

              {/* User Avatar */}
              <div className="presence-indicator">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-full h-full rounded-full"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Editor */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white min-h-[600px]">
          <EditorContent editor={editor} />
        </div>
      </main>
    </div>
  );
}