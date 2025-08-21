'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { secureApiService } from '@/lib/secure-api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import type { Document } from '@/types/shared'

export default function SecureDashboard() {
  const { data: session, status } = useSession()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && session) {
      loadDocuments()
    }
  }, [status, session])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('[Dashboard] Carregando documentos para usuário:', {
        name: session?.user?.name,
        email: session?.user?.email,
        provider: session?.user?.provider
      })
      
      const response = await secureApiService.getDocuments()
      setDocuments(response.documents)
      
      console.log('[Dashboard] Documentos carregados:', response.documents.length)
    } catch (error) {
      console.error('[Dashboard] Erro ao carregar documentos:', error)
      setError(error instanceof Error ? error.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDocument = async () => {
    try {
      console.log('[Dashboard] Criando novo documento...')
      
      const newDoc = await secureApiService.createDocument({
        title: 'Novo Documento',
        content: '# Novo Documento\n\nComece a escrever aqui...',
        visibility: 'private'
      })
      
      console.log('[Dashboard] Documento criado:', newDoc.document.id)
      
      // Recarregar lista
      await loadDocuments()
    } catch (error) {
      console.error('[Dashboard] Erro ao criar documento:', error)
      setError(error instanceof Error ? error.message : 'Erro ao criar documento')
    }
  }

  const handleSignOut = () => {
    console.log('[Dashboard] Fazendo logout...')
    signOut({ callbackUrl: '/auth/signin' })
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold mb-4">Acesso Negado</h1>
          <p className="text-gray-600 mb-4">Você precisa estar logado para acessar esta página.</p>
          <Button onClick={() => window.location.href = '/auth/signin'}>
            Fazer Login
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">CollabDocs</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Bem-vindo, <strong>{session?.user?.name}</strong>
              </div>
              
              <div className="flex items-center space-x-2">
                {session?.user?.image && (
                  <img 
                    src={session.user.image} 
                    alt={session.user.name || 'Avatar'}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div className="text-xs text-gray-500">
                  {session?.user?.email}
                </div>
              </div>
              
              <Button 
                onClick={handleSignOut}
                variant="outline"
                size="sm"
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Meus Documentos</h2>
              <p className="text-gray-600">Gerencie seus documentos colaborativos</p>
            </div>
            
            <Button onClick={handleCreateDocument}>
              Criar Novo Documento
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-2">{documents.length}</h3>
              <p className="text-gray-600">Documentos</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-2">1</h3>
              <p className="text-gray-600">Colaboradores</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-2">Hoje</h3>
              <p className="text-gray-600">Última atividade</p>
            </Card>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600">{error}</p>
            <Button 
              onClick={loadDocuments} 
              variant="outline" 
              size="sm" 
              className="mt-2"
            >
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          /* Documents Grid */
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Documentos Recentes</h3>
            <p className="text-gray-600">Seus documentos em um só lugar</p>
            
            {documents.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-600 mb-4">Nenhum documento encontrado</p>
                <Button onClick={handleCreateDocument}>
                  Criar Primeiro Documento
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4">
                {documents.map((document) => (
                  <Card key={document.id} className="p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold mb-2">{document.title}</h4>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            document.visibility === 'private' 
                              ? 'bg-gray-100 text-gray-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {document.visibility === 'private' ? 'Privado' : 'Público'}
                          </span>
                          
                          <span>Criado {new Date(document.created_at).toLocaleDateString('pt-BR')}</span>
                          <span>Atualizado {new Date(document.updated_at).toLocaleDateString('pt-BR')}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          {session?.user?.image && (
                            <img 
                              src={session.user.image} 
                              alt="Proprietário"
                              className="w-6 h-6 rounded-full"
                            />
                          )}
                          <span className="text-sm text-gray-600">
                            Proprietário: <strong>{session?.user?.name}</strong>
                          </span>
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <Button 
                          onClick={() => window.location.href = `/document/${document.id}`}
                          size="sm"
                        >
                          Abrir
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}