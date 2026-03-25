'use client';

import { useState } from 'react';

interface CreateDocumentModalProps {
  onClose: () => void;
  onCreate: (title: string, visibility: 'private' | 'public') => Promise<void> | void;
}

export function CreateDocumentModal({ onClose, onCreate }: CreateDocumentModalProps) {
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setTitleError('O título é obrigatório');
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
    if (!isSubmitting) onClose();
  };

  const modalContent = (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center">
            <span
              className="material-symbols-outlined text-secondary text-xl"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
            >
              add
            </span>
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-on-surface">Novo Documento</h3>
            <p className="text-xs text-on-surface-variant">Crie um documento colaborativo</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-high transition-colors"
          disabled={isSubmitting}
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Title input */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doc-title" className="text-sm font-medium text-on-surface-variant">
            Título do Documento
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-xl">
              description
            </span>
            <input
              id="doc-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(null);
              }}
              placeholder="Digite o título do documento..."
              disabled={isSubmitting}
              className={`w-full bg-surface-container border rounded-xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-colors ${
                titleError ? 'border-error' : 'border-outline-variant'
              }`}
            />
          </div>
          {titleError && (
            <p className="text-xs text-error flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
              {titleError}
            </p>
          )}
        </div>

        {/* Visibility */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-on-surface-variant">Visibilidade</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                visibility === 'private'
                  ? 'border-secondary bg-secondary-container'
                  : 'border-outline-variant bg-surface-container hover:border-outline'
              }`}
            >
              <span
                className={`material-symbols-outlined text-2xl ${visibility === 'private' ? 'text-secondary' : 'text-on-surface-variant'}`}
                style={{ fontVariationSettings: visibility === 'private' ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                lock
              </span>
              <div className="text-center">
                <p className={`text-sm font-semibold font-display ${visibility === 'private' ? 'text-secondary' : 'text-on-surface'}`}>
                  Privado
                </p>
                <p className="text-xs text-on-surface-variant">Apenas você</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                visibility === 'public'
                  ? 'border-primary bg-primary-container'
                  : 'border-outline-variant bg-surface-container hover:border-outline'
              }`}
            >
              <span
                className={`material-symbols-outlined text-2xl ${visibility === 'public' ? 'text-secondary' : 'text-on-surface-variant'}`}
                style={{ fontVariationSettings: visibility === 'public' ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                public
              </span>
              <div className="text-center">
                <p className={`text-sm font-semibold font-display ${visibility === 'public' ? 'text-secondary' : 'text-on-surface'}`}>
                  Público
                </p>
                <p className="text-xs text-on-surface-variant">Qualquer pessoa</p>
              </div>
            </button>
          </div>
        </div>

        {/* Hint */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-container border border-outline-variant">
          <span className="material-symbols-outlined text-on-surface-variant text-lg flex-shrink-0 mt-0.5">info</span>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {visibility === 'private'
              ? 'Documentos privados são visíveis apenas para você e colaboradores convidados.'
              : 'Documentos públicos podem ser visualizados por qualquer pessoa com o link.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-outline text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors text-sm font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="flex-1 btn-primary text-sm py-2.5 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-lg">add</span>
            )}
            {isSubmitting ? 'Criando...' : 'Criar Documento'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      {/* Desktop modal */}
      <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative glass rounded-3xl p-6 w-full max-w-md animate-fade-in">
          {modalContent}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <div className="md:hidden fixed inset-0 z-50 flex items-end">
        <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
        <div className="relative w-full bg-surface-low rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto animate-sheet-up">
          <div className="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-4" />
          {modalContent}
        </div>
      </div>
    </>
  );
}
