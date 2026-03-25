import type { Document } from '@/types/shared'

interface DocumentCardProps {
  document: Document
  onOpen: () => void
  onEdit: () => void
  onDelete: (id: string) => void
}

export default function DocumentCard({ document, onOpen, onEdit, onDelete }: DocumentCardProps) {
  const isPublic = document.visibility === 'public'
  const accentColor = isPublic ? '#335cff' : '#cbc2ff'

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return '—'
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden hover:border-outline transition-all group flex flex-col">
      {/* Accent bar */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />

      <div className="p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-display font-semibold text-base text-on-surface leading-snug line-clamp-2">
            {document.title}
          </h3>
          <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
            isPublic
              ? 'bg-primary-container text-secondary'
              : 'bg-surface-highest text-on-surface-variant'
          }`}>
            {isPublic ? 'Público' : 'Privado'}
          </span>
        </div>

        {/* Content preview */}
        {document.content && (
          <p className="text-sm text-on-surface-variant line-clamp-2 mb-4 leading-relaxed">
            {document.content.replace(/^#+\s*/gm, '').trim()}
          </p>
        )}

        {/* Dates */}
        <div className="flex items-center gap-3 text-xs text-on-surface-variant mb-4">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
            {formatDate(document.created_at)}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>update</span>
            {formatDate(document.updated_at)}
          </span>
        </div>

        {/* Owner */}
        <div className="flex items-center gap-2 mb-5">
          <div className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
            {document.owner_avatar_url ? (
              <img src={document.owner_avatar_url} alt="" className="w-6 h-6 rounded-full" />
            ) : (
              <span className="text-xs font-semibold text-secondary">
                {document.owner_name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <span className="text-xs text-on-surface-variant truncate">
            {document.is_owner ? 'Você' : (document.owner_name || 'Desconhecido')}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={onOpen}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
            Abrir
          </button>
          <button
            onClick={onEdit}
            className="text-xs px-3 py-1.5 rounded-xl border border-outline text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
            Editar
          </button>
          {document.is_owner && (
            <button
              onClick={() => onDelete(document.id)}
              className="ml-auto text-xs p-1.5 rounded-xl text-error/70 hover:bg-error-container hover:text-error transition-colors"
              title="Deletar"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
