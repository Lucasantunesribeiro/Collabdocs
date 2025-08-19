'use client';

import { useState } from 'react';

interface CreateDocumentModalProps {
  onClose: () => void;
  onCreate: (title: string, visibility: 'private' | 'public') => void;
}

export function CreateDocumentModal({ onClose, onCreate }: CreateDocumentModalProps) {
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação
    const newErrors: { title?: string } = {};
    if (!title.trim()) {
      newErrors.title = 'O título é obrigatório';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate(title.trim(), visibility);
      onClose();
    } catch (err) {
      console.error('Erro ao criar documento:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 max-w-md w-full mx-4 animate-slide-up">
        {/* Header */}
        <div className="p-6 border-b border-gray-200/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">✨</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                Novo Documento
              </h3>
              <p className="text-gray-600">
                Crie um documento colaborativo
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Título */}
          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-2">
              Título do Documento
            </label>
            <div className="relative">
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors({ ...errors, title: undefined });
                }}
                className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/80 backdrop-blur-sm ${
                  errors.title ? 'border-red-300 focus:ring-red-500 bg-red-50/50' : 'border-gray-300'
                }`}
                placeholder="Digite o título do documento..."
                disabled={isSubmitting}
              />
              {errors.title && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-sm">⚠️</span>
                  </div>
                </div>
              )}
            </div>
            {errors.title && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                {errors.title}
              </p>
            )}
          </div>

          {/* Visibilidade */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Visibilidade
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-2 group ${
                  visibility === 'private'
                    ? 'border-purple-500 bg-purple-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                }`}
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                  visibility === 'private'
                    ? 'bg-purple-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 group-hover:bg-purple-100 group-hover:text-purple-600'
                }`}>
                  <span className="text-xl">🔒</span>
                </div>
                <div className="text-center">
                  <div className={`font-semibold transition-colors duration-200 ${
                    visibility === 'private' ? 'text-purple-700' : 'text-gray-700'
                  }`}>
                    Privado
                  </div>
                  <div className={`text-xs transition-colors duration-200 ${
                    visibility === 'private' ? 'text-purple-600' : 'text-gray-500'
                  }`}>
                    Apenas você
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-2 group ${
                  visibility === 'public'
                    ? 'border-green-500 bg-green-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                }`}
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                  visibility === 'public'
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 group-hover:bg-green-100 group-hover:text-green-600'
                }`}>
                  <span className="text-xl">🌐</span>
                </div>
                <div className="text-center">
                  <div className={`font-semibold transition-colors duration-200 ${
                    visibility === 'public' ? 'text-green-700' : 'text-gray-700'
                  }`}>
                    Público
                  </div>
                  <div className={`text-xs transition-colors duration-200 ${
                    visibility === 'public' ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    Qualquer pessoa
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Dicas */}
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 text-sm">💡</span>
              </div>
              <div>
                <h4 className="font-medium text-blue-800 mb-1">Dica</h4>
                <p className="text-sm text-blue-700">
                  {visibility === 'private' 
                    ? 'Documentos privados são visíveis apenas para você e colaboradores convidados.'
                    : 'Documentos públicos podem ser visualizados por qualquer pessoa com o link.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
            >
              Cancelar
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Criando...
                </>
              ) : (
                <>
                  <span className="text-lg">✨</span>
                  Criar Documento
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}