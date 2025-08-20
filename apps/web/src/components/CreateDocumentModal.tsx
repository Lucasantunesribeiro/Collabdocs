'use client';

import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Alert } from './ui/Alert';
import { 
  FileText,
  Plus,
  Lock, 
  Globe, 
  X
} from 'lucide-react';

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
      <Card className="max-w-md w-full mx-4 animate-slide-up">
        {/* Header */}
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Plus className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-text-900">
                Novo Documento
              </h3>
              <p className="text-text-600">
                Crie um documento colaborativo
              </p>
            </div>
          </div>
        </CardHeader>

        {/* Form */}
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Título */}
            <Input
              label="Título do Documento"
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors({ ...errors, title: undefined });
              }}
              placeholder="Digite o título do documento..."
              disabled={isSubmitting}
              error={errors.title}
              icon={FileText}
            />

            {/* Visibilidade */}
            <div>
              <label className="block text-sm font-semibold text-text-700 mb-3">
                Visibilidade
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 flex flex-col items-center gap-2 group ${
                    visibility === 'private'
                      ? 'border-warning-500 bg-warning-50 shadow-medium'
                      : 'border-text-200 bg-white hover:border-text-300 hover:shadow-soft'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    visibility === 'private'
                      ? 'bg-warning-500 text-white shadow-soft'
                      : 'bg-text-100 text-text-600 group-hover:bg-warning-100 group-hover:text-warning-600'
                  }`}>
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <div className={`font-semibold transition-colors duration-200 ${
                      visibility === 'private' ? 'text-warning-700' : 'text-text-700'
                    }`}>
                      Privado
                    </div>
                    <div className={`text-xs transition-colors duration-200 ${
                      visibility === 'private' ? 'text-warning-600' : 'text-text-500'
                    }`}>
                      Apenas você
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 flex flex-col items-center gap-2 group ${
                    visibility === 'public'
                      ? 'border-success-500 bg-success-50 shadow-medium'
                      : 'border-text-200 bg-white hover:border-text-300 hover:shadow-soft'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    visibility === 'public'
                      ? 'bg-success-500 text-white shadow-soft'
                      : 'bg-text-100 text-text-600 group-hover:bg-success-100 group-hover:text-success-600'
                  }`}>
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <div className={`font-semibold transition-colors duration-200 ${
                      visibility === 'public' ? 'text-success-700' : 'text-text-700'
                    }`}>
                      Público
                    </div>
                    <div className={`text-xs transition-colors duration-200 ${
                      visibility === 'public' ? 'text-success-600' : 'text-text-500'
                    }`}>
                      Qualquer pessoa
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Dicas */}
            <Alert type="info" title="Dica">
              {visibility === 'private' 
                ? 'Documentos privados são visíveis apenas para você e colaboradores convidados.'
                : 'Documentos públicos podem ser visualizados por qualquer pessoa com o link.'
              }
            </Alert>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancelar
              </Button>
              
              <Button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                isLoading={isSubmitting}
                icon={Plus}
                className="flex-1"
              >
                {isSubmitting ? 'Criando...' : 'Criar Documento'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}