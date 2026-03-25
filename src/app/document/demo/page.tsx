'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { CollaborativeEditor } from '@/components/CollaborativeEditor';

const DEMO_CONTENT = `# Documento de Demonstração

## Bem-vindo ao CollabDocs!

Este é um documento de exemplo para demonstrar as funcionalidades do sistema de documentos colaborativos.

### Funcionalidades Disponíveis

- **Edição em tempo real** - Veja as alterações instantaneamente
- **Salvamento automático** - Seu trabalho é preservado automaticamente
- **Histórico de versões** - Acompanhe todas as mudanças
- **Colaboração simultânea** - Múltiplos usuários podem editar juntos

### Como Usar

1. **Digite** no editor abaixo
2. **Clique em Salvar** para persistir suas alterações
3. **Compartilhe** o documento com sua equipe
4. **Colabore** em tempo real

### Dicas

- Use **Markdown** para formatação
- **Salve frequentemente** para não perder trabalho
- **Comunique-se** com sua equipe durante a edição

*Este documento foi criado para demonstrar as capacidades do CollabDocs. Experimente editar o conteúdo!*`;

export default function DocumentDemoPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { data: session } = useSession();

  if (isEditing) {
    return (
      <CollaborativeEditor
        documentId="demo"
        initialContent={DEMO_CONTENT}
        session={session}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-outline-variant">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-primary-container rounded-xl flex items-center justify-center">
              <span className="font-display font-bold text-sm gradient-text">CD</span>
            </div>
            <div>
              <p className="font-display font-bold text-sm text-on-surface group-hover:text-secondary transition-colors">
                CollabDocs
              </p>
              <p className="text-xs text-on-surface-variant">Documento Demo</p>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 rounded-full border border-success/20">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-xs font-medium text-success">Online</span>
            </div>

            <button
              onClick={() => setIsEditing(true)}
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
            <h1 className="font-display font-bold text-4xl text-on-surface mb-4">
              Documento de Demonstração
            </h1>
            <p className="text-on-surface-variant max-w-xl mx-auto">
              Este é um documento de exemplo para demonstrar as funcionalidades do CollabDocs
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: 'group', label: 'Colaboradores', value: '3' },
              { icon: 'description', label: 'Palavras', value: '1.2k' },
              { icon: 'schedule', label: 'Ativo', value: '24h' },
              { icon: 'change_history', label: 'Alterações', value: '156' },
            ].map((item) => (
              <div key={item.label} className="bg-surface-container rounded-xl p-4 text-center">
                <span
                  className="material-symbols-outlined text-primary text-2xl block mb-2"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  {item.icon}
                </span>
                <p className="font-display font-bold text-lg text-on-surface">{item.value}</p>
                <p className="text-xs text-on-surface-variant">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Editor prompt */}
        <div className="glass rounded-3xl overflow-hidden animate-slide-up">
          <div className="bg-primary-gradient px-6 py-4">
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
              Clique em "Editar" para explorar o editor colaborativo em tempo real
            </p>
            <button
              onClick={() => setIsEditing(true)}
              className="btn-primary text-base px-8 py-3 flex items-center gap-2 mx-auto"
            >
              <span className="material-symbols-outlined text-xl">edit</span>
              Iniciar Edição
            </button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {[
            {
              icon: 'bolt',
              title: 'Edição em Tempo Real',
              desc: 'Veja as alterações de outros colaboradores instantaneamente. Múltiplos usuários podem editar simultaneamente.',
            },
            {
              icon: 'lock',
              title: 'Controle de Acesso',
              desc: 'Gerencie permissões de usuários e controle quem pode visualizar e editar seus documentos.',
            },
          ].map((item) => (
            <div key={item.title} className="glass rounded-2xl p-6 flex gap-4 hover:border-outline transition-all">
              <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center flex-shrink-0">
                <span
                  className="material-symbols-outlined text-secondary text-xl"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
                >
                  {item.icon}
                </span>
              </div>
              <div>
                <h3 className="font-display font-semibold text-base text-on-surface mb-1">{item.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
