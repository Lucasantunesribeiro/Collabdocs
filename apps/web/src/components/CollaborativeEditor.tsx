'use client';

import { useState } from 'react';

export function CollaborativeEditor() {
  const [content, setContent] = useState(`# Documento de Demonstração

## Bem-vindo ao CollabDocs! 🎉

Este é um documento de exemplo que demonstra as funcionalidades do nosso sistema de documentos colaborativos.

### ✨ Funcionalidades Principais

- **Edição em Tempo Real**: Múltiplos usuários podem editar simultaneamente
- **Sincronização Automática**: Todas as alterações são sincronizadas instantaneamente
- **Controle de Versões**: Histórico completo de todas as mudanças
- **Comentários**: Adicione comentários e feedback em qualquer parte do documento

### 🚀 Como Usar

1. **Digite** no editor abaixo para ver as mudanças em tempo real
2. **Compartilhe** o link com seus colaboradores
3. **Colabore** em tempo real com sua equipe

### 📝 Exemplo de Conteúdo

Aqui você pode escrever qualquer tipo de conteúdo:

- Listas com marcadores
- **Texto em negrito**
- *Texto em itálico*
- \`código inline\`

\`\`\`javascript
// Exemplo de código
function helloWorld() {
  console.log("Olá, CollabDocs!");
}
\`\`\`

### 🎯 Próximos Passos

- [ ] Implementar autenticação OAuth
- [ ] Adicionar suporte a arquivos
- [ ] Criar sistema de comentários
- [ ] Implementar histórico de versões

---

*Este documento foi criado para demonstrar as capacidades do CollabDocs. Experimente editar o conteúdo!*`);

  const [isTyping, setIsTyping] = useState(false);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsTyping(true);
    
    // Simular indicador de digitação
    setTimeout(() => setIsTyping(false), 1000);
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4z" />
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
            
            {/* Status de sincronização */}
            <div className="flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Sincronizado</span>
            </div>
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
            <span>💾 Auto-salvo</span>
            <span>🔄 Última sincronização: agora</span>
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
              <li>• Use comentários para discutir mudanças específicas</li>
              <li>• Salve versões importantes antes de grandes alterações</li>
              <li>• Comunique-se com sua equipe sobre mudanças significativas</li>
              <li>• Use o histórico para reverter alterações quando necessário</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}