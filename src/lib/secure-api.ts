// Secure API service using NextAuth session
import type { Document } from '../types/shared'

// Interface para sessão NextAuth
interface NextAuthSession {
  user: {
    id: string
    name: string
    email: string
    provider?: string
    image?: string
  }
  accessToken?: string
}

// Tipo para sessão NextAuth que pode ser null
type NextAuthSessionOrNull = NextAuthSession | null

export interface CreateDocumentRequest {
  title: string
  content?: string
  visibility?: 'private' | 'public'
}

export interface UpdateDocumentRequest {
  content: string
  title?: string
}

class SecureApiService {
  private baseUrl: string

  constructor() {
    // Determinar URL da API baseado no ambiente
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      this.baseUrl = 'https://collab-docs.collabdocs.workers.dev/api'
    } else if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      this.baseUrl = 'http://localhost:8787/api'
    } else {
      this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://collab-docs.collabdocs.workers.dev/api'
    }
  }

  /**
   * Fazer requisição autenticada usando sessão NextAuth
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    session: NextAuthSession,
    options: RequestInit = {}
  ): Promise<T> {
    if (!session || !session.user) {
      throw new Error('Usuário não autenticado')
    }

    // Validar dados essenciais da sessão
    if (!session.user.email || !session.user.name) {
      throw new Error('Sessão inválida - dados do usuário incompletos')
    }

    console.log('[SecureAPI] Fazendo requisição autenticada:', {
      endpoint,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        provider: session.user.provider
      }
    })

    const url = `${this.baseUrl}${endpoint}`
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        // Usar token NextAuth ou ID do usuário como fallback
        'Authorization': `Bearer ${session.accessToken || session.user.id || 'fallback-token'}`,
        // Enviar dados reais do usuário autenticado
        'X-User-Profile': JSON.stringify({
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          provider: session.user.provider,
          image: session.user.image
        }),
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[SecureAPI] Request failed:', {
          status: response.status,
          error: errorData
        })
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('[SecureAPI] Request successful:', {
        endpoint,
        responseSize: JSON.stringify(data).length
      })
      
      return data
    } catch (error) {
      console.error('[SecureAPI] Request error:', error)
      throw error
    }
  }

  /**
   * Obter todos os documentos visíveis para o usuário atual
   */
  async getDocuments(session: NextAuthSession): Promise<{ documents: Document[] }> {
    return this.authenticatedRequest<{ documents: Document[] }>('/documents', session)
  }

  /**
   * Obter documento específico (com verificação de permissão)
   */
  async getDocument(id: string, session: NextAuthSession): Promise<{ document: Document; permission: string }> {
    return this.authenticatedRequest<{ document: Document; permission: string }>(`/documents/${id}`, session)
  }

  /**
   * Criar novo documento
   */
  async createDocument(data: CreateDocumentRequest, session: NextAuthSession): Promise<{ document: Document }> {
    return this.authenticatedRequest<{ document: Document }>('/documents', session, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Atualizar documento existente
   */
  async updateDocument(id: string, data: UpdateDocumentRequest, session: NextAuthSession): Promise<{ document: Document; message: string }> {
    return this.authenticatedRequest<{ document: Document; message: string }>(`/documents/${id}`, session, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  /**
   * Obter histórico do documento
   */
  async getDocumentHistory(id: string, session: NextAuthSession): Promise<{ snapshots: any[] }> {
    return this.authenticatedRequest<{ snapshots: any[] }>(`/documents/${id}/history`, session)
  }

  /**
   * Adicionar colaborador a um documento
   */
  async addCollaborator(documentId: string, email: string, session: NextAuthSession, permission: 'read' | 'write' = 'read'): Promise<{ message: string }> {
    return this.authenticatedRequest<{ message: string }>(`/documents/${documentId}/collaborators`, session, {
      method: 'POST',
      body: JSON.stringify({ email, permission }),
    })
  }

  /**
   * Remover colaborador de um documento
   */
  async removeCollaborator(documentId: string, email: string, session: NextAuthSession): Promise<{ message: string }> {
    return this.authenticatedRequest<{ message: string }>(`/documents/${documentId}/collaborators`, session, {
      method: 'DELETE',
      body: JSON.stringify({ email }),
    })
  }

  /**
   * Verificar se o usuário atual tem permissão para ver um documento
   */
  async checkDocumentPermission(documentId: string, session: NextAuthSession): Promise<{ hasAccess: boolean; permission: string }> {
    return this.authenticatedRequest<{ hasAccess: boolean; permission: string }>(`/documents/${documentId}/permission`, session)
  }

  /**
   * Obter colaboradores ativos de um documento
   */
  async getDocumentCollaborators(documentId: string, session: NextAuthSession): Promise<{ collaborators: any[]; total: number }> {
    return this.authenticatedRequest<{ collaborators: any[]; total: number }>(`/documents/${documentId}/collaborators`, session)
  }
}

export const secureApiService = new SecureApiService()