'use client';

import { useState, useEffect } from 'react';

interface DocumentData {
  id: string;
  content: string;
  lastSaved: Date;
  isDirty: boolean;
}

export function CollaborativeEditor() {
  const [content, setContent] = useState(`# Documento de Demonstração

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

*Este documento foi criado para demonstrar as capacidades do CollabDocs. Experimente editar o conteúdo!*`);

  const [isTyping, setIsTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Simular salvamento automático
  useEffect(() => {
    if (isDirty && !isTyping) {
      const timer = setTimeout(() => {
        handleAutoSave();
      }, 2000); // Salvar automaticamente após 2 segundos sem digitação

      return () => clearTimeout(timer);
    }
  }, [content, isTyping, isDirty]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsTyping(true);
    setIsDirty(true);

    // Simular indicador de digitação
    setTimeout(() => setIsTyping(false), 1000);
  };

  const handleAutoSave = async () => {
    if (!isDirty) return;
    
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      // Simular salvamento automático
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setLastSaved(new Date());
      setIsDirty(false);
      setSaveStatus('saved');
      
      // Salvar no localStorage para persistência
      localStorage.setItem('collabdocs_document_content', content);
      localStorage.setItem('collabdocs_document_last_saved', new Date().toISOString());
      
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
      // Simular salvamento manual
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setLastSaved(new Date());
      setIsDirty(false);
      setSaveStatus('saved');
      
      // Salvar no localStorage para persistência
      localStorage.setItem('collabdocs_document_content', content);
      localStorage.setItem('collabdocs_document_last_saved', new Date().toISOString());
      
      // Mostrar feedback visual
      setTimeout(() => setSaveStatus('saved'), 2000);
      
    } catch (error) {
      setSaveStatus('error');
      console.error('Erro ao salvar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Carregar conteúdo salvo ao inicializar
  useEffect(() => {
    const savedContent = localStorage.getItem('collabdocs_document_content');
    const savedLastSaved = localStorage.getItem('collabdocs_document_last_saved');
    
    if (savedContent) {
      setContent(savedContent);
      setIsDirty(false);
    }
    
    if (savedLastSaved) {
      setLastSaved(new Date(savedLastSaved));
    }
  }, []);

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

  const getSaveStatusColor = () => {
    switch (saveStatus) {
      case 'saved': return 'text-green-600';
      case 'saving': return 'text-blue-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saved': return '✅';
      case 'saving': return '⏳';
      case 'error': return '❌';
      default: return '💾';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a2 2 0 004 4z" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Indicador de digitação */}
            {isTyping && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span>Digitando...</span>
              </div>
            )}

            {/* Status de salvamento */}
            <div className={`flex items-center gap-2 text-sm ${getSaveStatusColor()}`}>
              <span className="text-lg">{getSaveStatusIcon()}</span>
              <span>
                {saveStatus === 'saved' && 'Salvo'}
                {saveStatus === 'saving' && 'Salvando...'}
                {saveStatus === 'error' && 'Erro ao salvar'}
              </span>
            </div>

            {/* Botão de salvar manual */}
            <button
              onClick={handleManualSave}
              disabled={isSaving || !isDirty}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                isDirty && !isSaving
                  ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <span className="text-lg">💾</span>
                  Salvar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <textarea
          value={content}
          onChange={handleContentChange}
          className="w-full min-h-[600px] p-6 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none font-mono text-gray-800 leading-relaxed"
          placeholder="Comece a digitar seu documento..."
        />

        {/* Overlay de colaboração */}
        <div className="absolute top-4 right-4">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Colaboradores Online</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">👤</span>
                </div>
                <div className="text-xs">
                  <div className="font-medium text-gray-800">Você</div>
                  <div className="text-gray-500">Editando...</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">👤</span>
                </div>
                <div className="text-xs">
                  <div className="font-medium text-gray-800">João Silva</div>
                  <div className="text-gray-500">Visualizando</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">👤</span>
                </div>
                <div className="text-xs">
                  <div className="font-medium text-gray-800">Maria Santos</div>
                  <div className="text-gray-500">Editando...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer do Editor */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>📝 {content.length} caracteres</span>
            <span>📊 {content.split(' ').length} palavras</span>
            <span>📄 {content.split('\n').length} linhas</span>
          </div>

          <div className="flex items-center gap-4">
            <span className={`flex items-center gap-2 ${isDirty ? 'text-orange-600' : 'text-green-600'}`}>
              {isDirty ? '🔄' : '💾'} {isDirty ? 'Não salvo' : 'Salvo'}
            </span>
            <span>🕒 Último salvamento: {formatTimeAgo(lastSaved)}</span>
          </div>
        </div>
      </div>

      {/* Dicas de Colaboração */}
      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 text-sm">💡</span>
          </div>
          <div>
            <h4 className="font-semibold text-blue-800 mb-2">Dicas para Colaboração Eficiente</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Use o botão "Salvar" para persistir suas alterações</li>
              <li>• O salvamento automático acontece após 2 segundos sem digitação</li>
              <li>• Comunique-se com sua equipe sobre mudanças significativas</li>
              <li>• Use Markdown para formatação avançada</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}