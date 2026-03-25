'use client'

import { useState, useEffect } from 'react'
import { secureApiService, type Collaborator } from '@/lib/secure-api'

interface ShareModalProps {
  documentId: string
  session: {
    user: { id: string; name: string; email: string }
    sessionToken?: string
  } | null
  onClose: () => void
}

export function ShareModal({ documentId, session, onClose }: ShareModalProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePermission, setInvitePermission] = useState<'read' | 'write'>('write')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCollaborators()
  }, [documentId, session])

  const loadCollaborators = async () => {
    if (!session) return
    try {
      setLoading(true)
      const resp = await secureApiService.getDocumentCollaborators(documentId, session)
      setCollaborators(resp.collaborators || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session || !inviteEmail.trim()) return
    try {
      setInviting(true)
      setError(null)
      // addCollaborator signature: (documentId, email, session, permission)
      await secureApiService.addCollaborator(documentId, inviteEmail.trim(), session, invitePermission)
      setInviteEmail('')
      await loadCollaborators()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao convidar')
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (collaboratorEmail: string) => {
    if (!session) return
    try {
      // removeCollaborator signature: (documentId, email, session)
      await secureApiService.removeCollaborator(documentId, collaboratorEmail, session)
      await loadCollaborators()
    } catch {
      // ignore
    }
  }

  const permissionLabel = (p: string) => {
    if (p === 'owner') return 'Proprietário'
    if (p === 'write') return 'Editor'
    return 'Visualizador'
  }

  const modalContent = (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg text-on-surface">Compartilhar Documento</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-high transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Invite form */}
      <form onSubmit={handleInvite} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-on-surface-variant">Convidar por email</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@exemplo.com"
            required
            className="flex-1 bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-colors"
          />
          <select
            value={invitePermission}
            onChange={(e) => setInvitePermission(e.target.value as 'read' | 'write')}
            className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
          >
            <option value="write">Editor</option>
            <option value="read">Visualizador</option>
          </select>
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
        <button
          type="submit"
          disabled={inviting || !inviteEmail}
          className="btn-primary text-sm py-2.5 flex items-center justify-center gap-2"
        >
          {inviting ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span className="material-symbols-outlined text-lg">person_add</span>
          )}
          {inviting ? 'Convidando...' : 'Convidar'}
        </button>
      </form>

      {/* Collaborators list */}
      <div>
        <p className="text-sm font-medium text-on-surface-variant mb-3">
          Colaboradores ({collaborators.length})
        </p>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-surface-container animate-pulse" />)}
          </div>
        ) : collaborators.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-4">Nenhum colaborador ainda</p>
        ) : (
          <div className="space-y-2">
            {collaborators.map((c) => {
              const isCurrentUser = session?.user && (
                c.user_id === session.user.id || c.user_email === session.user.email
              )
              const isOwner = c.permission === 'owner'
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container">
                  <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-secondary">
                      {c.user_email?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface truncate">
                      {c.user_email}
                      {isCurrentUser && <span className="ml-2 text-xs text-secondary">(Você)</span>}
                    </p>
                    <p className="text-xs text-on-surface-variant">{permissionLabel(c.permission)}</p>
                  </div>
                  {!isOwner && !isCurrentUser && (
                    <button
                      onClick={() => handleRemove(c.user_email)}
                      className="p-1.5 rounded-lg text-error/70 hover:bg-error-container hover:text-error transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_remove</span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop modal */}
      <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative glass rounded-3xl p-6 w-full max-w-md animate-fade-in">
          {modalContent}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <div className="md:hidden fixed inset-0 z-50 flex items-end">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative w-full bg-surface-low rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto animate-sheet-up">
          <div className="w-12 h-1 rounded-full bg-outline-variant mx-auto mb-4" />
          {modalContent}
        </div>
      </div>
    </>
  )
}
