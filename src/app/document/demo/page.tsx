'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { CollaborativeEditor } from '@/components/CollaborativeEditor';

export default function DocumentDemoPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <span className="text-white text-lg">📝</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                    CollabDocs
                  </h1>
                  <p className="text-sm text-gray-600">Documento Demo</p>
                </div>
              </a>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Status do documento */}
              <div className="flex items-center gap-2 px-3 py-2 bg-green-100 rounded-full border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-700">Online</span>
              </div>
              
              {/* Botão de edição */}
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`px-4 py-2 rounded-2xl font-medium transition-all duration-200 flex items-center gap-2 ${
                  isEditing
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                {isEditing ? (
                  <>
                    <span className="text-lg">⏸️</span>
                    Pausar Edição
                  </>
                ) : (
                  <>
                    <span className="text-lg">✏️</span>
                    Editar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Document Info */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/20 p-8 mb-8 animate-fade-in">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl shadow-2xl mb-6">
                <span className="text-3xl">📄</span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
                Documento de Demonstração
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Este é um documento de exemplo para demonstrar as funcionalidades do CollabDocs
              </p>
            </div>

            {/* Document Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl">👥</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">3</div>
                <div className="text-sm text-gray-600">Colaboradores</div>
              </div>
              
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl">📝</span>
                </div>
                <div className="text-2xl font-bold text-green-600">1.2k</div>
                <div className="text-sm text-gray-600">Palavras</div>
              </div>
              
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl">⏰</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">24h</div>
                <div className="text-sm text-gray-600">Ativo</div>
              </div>
              
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl">🔄</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">156</div>
                <div className="text-sm text-gray-600">Alterações</div>
              </div>
            </div>
          </div>

          {/* Editor Section */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/20 overflow-hidden animate-slide-up">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✏️</span>
                  <h2 className="text-xl font-bold text-white">
                    Editor Colaborativo
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 bg-white/20 rounded-full border-2 border-white flex items-center justify-center">
                      <span className="text-white text-sm">👤</span>
                    </div>
                    <div className="w-8 h-8 bg-white/20 rounded-full border-2 border-white flex items-center justify-center">
                      <span className="text-white text-sm">👤</span>
                    </div>
                    <div className="w-8 h-8 bg-white/20 rounded-full border-2 border-white flex items-center justify-center">
                      <span className="text-white text-sm">👤</span>
                    </div>
                  </div>
                  <span className="text-white/90 text-sm">3 online</span>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {isEditing ? (
                <CollaborativeEditor 
                  documentId="demo-document" 
                  initialContent="# Documento de Demonstração

## Bem-vindo ao CollabDocs! 🎉

Este é um documento de exemplo para demonstrar as funcionalidades do sistema de documentos colaborativos.

### ✨ Funcionalidades Disponíveis

- **Edição em tempo real** - Veja as alterações instantaneamente
- **Salvamento automático** - Seu trabalho é preservado automaticamente
- **Histórico de versões** - Acompanhe todas as mudanças
- **Colaboração simultânea** - Múltiplos usuários podem editar juntos

### 🚀 Como Usar

1. **Digite** no editor abaixo
2. **Clique em Salvar** para persistir suas alterações
3. **Compartilhe** o documento com sua equipe
4. **Colabore** em tempo real

### 💡 Dicas

- Use **Markdown** para formatação
- **Salve frequentemente** para não perder trabalho
- **Comunique-se** com sua equipe durante a edição

*Este documento foi criado para demonstrar as capacidades do CollabDocs. Experimente editar o conteúdo!*"
                  session={session}
                />
              ) : (
                <div className="text-center py-16">
                  <div className="text-6xl mb-6">📝</div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">
                    Editor Pausado
                  </h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Clique em "Editar" para começar a colaborar neste documento
                  </p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-2xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center gap-2 mx-auto group"
                  >
                    <span className="text-lg group-hover:scale-110 transition-transform duration-200">✏️</span>
                    Iniciar Edição
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Features Preview */}
          <div className="mt-12 grid md:grid-cols-2 gap-8">
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 border border-white/30 hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Edição em Tempo Real</h3>
              <p className="text-gray-600 leading-relaxed">
                Veja as alterações de outros colaboradores instantaneamente. 
                Múltiplos usuários podem editar simultaneamente sem conflitos.
              </p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 border border-white/30 hover:shadow-lg transition-all duration-300 group">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Controle de Acesso</h3>
              <p className="text-gray-600 leading-relaxed">
                Gerencie permissões de usuários e controle quem pode visualizar 
                e editar seus documentos.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
