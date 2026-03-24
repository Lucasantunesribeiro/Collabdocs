// Secure API service using NextAuth session JWT
import type { Document } from '../types/shared'

export interface Collaborator {
  id: string
  document_id: string
  user_id: string
  user_email: string
  permission: 'read' | 'write' | 'owner'
  added_by: string
  created_at: string
}

// Interface for NextAuth session
interface NextAuthSession {
  user: {
    id: string
    name: string
    email: string
    provider?: string
    image?: string
  }
  accessToken?: string
  /** Raw NextAuth session JWT — used as Bearer token for the Worker API */
  sessionToken?: string
}

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
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      this.baseUrl = 'https://collab-docs.collabdocs.workers.dev/api'
    } else if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      this.baseUrl = 'http://localhost:8787/api'
    } else {
      this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://collab-docs.collabdocs.workers.dev/api'
    }
  }

  private getBearerToken(session: NextAuthSession): string {
    // Prefer the NextAuth session JWT; fall back to user ID for local dev
    return session.sessionToken || session.user.id || ''
  }

  private async authenticatedRequest<T>(
    endpoint: string,
    session: NextAuthSession,
    options: RequestInit = {}
  ): Promise<T> {
    if (!session?.user) {
      throw new Error('User not authenticated')
    }

    if (!session.user.email || !session.user.name) {
      throw new Error('Invalid session — incomplete user data')
    }

    const token = this.getBearerToken(session)
    if (!token) {
      throw new Error('No authentication token available')
    }

    const url = `${this.baseUrl}${endpoint}`

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
      ...options,
    }

    const response = await fetch(url, config)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async getDocuments(session: NextAuthSession): Promise<{ documents: Document[] }> {
    return this.authenticatedRequest<{ documents: Document[] }>('/documents', session)
  }

  async getDocument(id: string, session: NextAuthSession): Promise<{ document: Document; permission: string }> {
    return this.authenticatedRequest<{ document: Document; permission: string }>(`/documents/${id}`, session)
  }

  async createDocument(data: CreateDocumentRequest, session: NextAuthSession): Promise<{ document: Document }> {
    return this.authenticatedRequest<{ document: Document }>('/documents', session, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateDocument(id: string, data: UpdateDocumentRequest, session: NextAuthSession): Promise<{ document: Document; message: string }> {
    return this.authenticatedRequest<{ document: Document; message: string }>(`/documents/${id}`, session, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async addCollaborator(documentId: string, email: string, session: NextAuthSession, permission: 'read' | 'write' = 'read'): Promise<{ message: string }> {
    return this.authenticatedRequest<{ message: string }>(`/documents/${documentId}/collaborators`, session, {
      method: 'POST',
      body: JSON.stringify({ email, permission }),
    })
  }

  async removeCollaborator(documentId: string, email: string, session: NextAuthSession): Promise<{ message: string }> {
    return this.authenticatedRequest<{ message: string }>(`/documents/${documentId}/collaborators`, session, {
      method: 'DELETE',
      body: JSON.stringify({ email }),
    })
  }

  async getDocumentCollaborators(documentId: string, session: NextAuthSession): Promise<{ collaborators: Collaborator[]; total: number }> {
    return this.authenticatedRequest<{ collaborators: Collaborator[]; total: number }>(`/documents/${documentId}/collaborators`, session)
  }

  async deleteDocument(id: string, session: NextAuthSession): Promise<{ message: string }> {
    return this.authenticatedRequest<{ message: string }>(`/documents/${id}`, session, {
      method: 'DELETE',
    })
  }
}

export const secureApiService = new SecureApiService()
