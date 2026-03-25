'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { secureApiService } from '@/lib/secure-api'
import type { Document } from '@/types/shared'
import DocumentCard from '@/components/DocumentCard'
import { CreateDocumentModal } from '@/components/CreateDocumentModal'

type NavItem = 'all' | 'mine' | 'public' | 'shared'

export default function Dashboard() {
  const { data: session } = useSession()
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeNav, setActiveNav] = useState<NavItem>('all')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (session) loadDocuments()
  }, [session])

  const loadDocuments = async () => {
    if (!session) return
    try {
      setLoading(true)
      setError(null)
      const response = await secureApiService.getDocuments(session)
      setDocuments(response.documents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar documentos')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDocument = async (title: string, visibility: 'private' | 'public') => {
    if (!session) return
    try {
      await secureApiService.createDocument({
        title,
        content: `# ${title}\n\nComece a escrever aqui...`,
        visibility,
      }, session)
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar documento')
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!session) return
    if (!confirm('Tem certeza que deseja deletar este documento?')) return
    try {
      await secureApiService.deleteDocument(documentId, session)
    } catch {
      // API returned an error. The deletion may have committed anyway (Lambda/Neon
      // can drop the connection after a successful DB commit). Reload to check reality.
      const response = await secureApiService.getDocuments(session).catch(() => null)
      if (response) {
        setDocuments(response.documents)
        // If the document is gone from the reloaded list, treat deletion as successful
        if (!response.documents.some(d => d.id === documentId)) return
      }
      setError('Erro ao deletar documento. Por favor, tente novamente.')
      return
    }
    await loadDocuments()
  }

  const filteredDocs = documents.filter((doc) => {
    const matchesNav =
      activeNav === 'mine'   ? doc.is_owner :
      activeNav === 'public' ? doc.visibility === 'public' :
      activeNav === 'shared' ? !doc.is_owner :
      true
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesNav && matchesSearch
  })

  const navItems = [
    { id: 'all' as NavItem, icon: 'home', label: 'Início' },
    { id: 'mine' as NavItem, icon: 'description', label: 'Meus Docs' },
    { id: 'public' as NavItem, icon: 'public', label: 'Públicos' },
    { id: 'shared' as NavItem, icon: 'group', label: 'Compartilhados' },
  ]

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-outline-variant">
        <span className="font-display font-bold text-xl gradient-text">CollabDocs</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { setActiveNav(item.id); setMobileSidebarOpen(false) }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeNav === item.id
                ? 'bg-primary-container text-secondary'
                : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{
                fontVariationSettings: activeNav === item.id
                  ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20"
                  : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20"
              }}
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-outline-variant">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
          {session?.user?.image ? (
            <img src={session.user.image} alt="" className="w-8 h-8 rounded-full ring-2 ring-outline" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-secondary font-semibold text-sm">
              {session?.user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-on-surface truncate">{session?.user?.name}</p>
            <p className="text-xs text-on-surface-variant truncate">{session?.user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors"
            title="Sair"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-surface-low border-r border-outline-variant fixed h-full z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-surface-low flex flex-col animate-slide-up">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur-glass border-b border-outline-variant px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-xl text-on-surface-variant hover:bg-surface-high transition-colors"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-surface-container rounded-xl px-4 py-2 border border-outline-variant w-64">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">search</span>
              <input
                type="text"
                placeholder="Buscar documentos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm text-on-surface placeholder-on-surface-variant outline-none w-full"
              />
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span className="hidden sm:inline">Novo Documento</span>
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 md:px-6 py-6 pb-24 md:pb-6">
          {/* Page title */}
          <div className="mb-6">
            <h1 className="font-display font-bold text-2xl text-on-surface">
              {navItems.find(n => n.id === activeNav)?.label}
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {filteredDocs.length} documento{filteredDocs.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Total', value: documents.length, icon: 'description' },
              { label: 'Meus', value: documents.filter(d => d.is_owner).length, icon: 'person' },
              { label: 'Públicos', value: documents.filter(d => d.visibility === 'public').length, icon: 'public' },
              { label: 'Compartilhados', value: documents.filter(d => !d.is_owner).length, icon: 'group' },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-2xl p-4 flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-primary text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  {stat.icon}
                </span>
                <div>
                  <p className="font-display font-bold text-xl text-on-surface">{stat.value}</p>
                  <p className="text-xs text-on-surface-variant">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-error-container border border-error/30 flex items-center gap-3">
              <span className="material-symbols-outlined text-error">error</span>
              <p className="text-sm text-on-surface flex-1">{error}</p>
              <button onClick={loadDocuments} className="text-sm text-secondary underline">
                Tentar novamente
              </button>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="glass rounded-2xl h-48 animate-pulse" />
              ))}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant block mb-4">folder_open</span>
              <h3 className="font-display font-semibold text-lg text-on-surface mb-2">Nenhum documento aqui</h3>
              <p className="text-on-surface-variant text-sm mb-6">Crie seu primeiro documento para começar.</p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary px-6 py-2.5 text-sm">
                Criar Documento
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onDelete={handleDeleteDocument}
                  onOpen={() => router.push(`/document/${doc.id}`)}
                  onEdit={() => router.push(`/document/${doc.id}?edit=true`)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface-low border-t border-outline-variant flex">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveNav(item.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              activeNav === item.id ? 'text-secondary' : 'text-on-surface-variant'
            }`}
          >
            <span
              className="material-symbols-outlined text-2xl"
              style={{
                fontVariationSettings: activeNav === item.id
                  ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                  : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"
              }}
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      {showCreateModal && (
        <CreateDocumentModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateDocument}
        />
      )}
    </div>
  )
}
