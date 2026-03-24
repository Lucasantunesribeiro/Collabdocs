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
  /** Raw NextAuth session JWT — used as Bearer token for both the .NET API and Worker */
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

/**
 * Resolves the .NET API base URL.
 *
 * Priority:
 *  1. NEXT_PUBLIC_DOTNET_API_URL — explicit override (Vercel / Docker)
 *  2. http://localhost:5000/api   — local development default
 */
function resolveDotnetApiUrl(): string {
  if (process.env.NEXT_PUBLIC_DOTNET_API_URL) {
    return process.env.NEXT_PUBLIC_DOTNET_API_URL
  }
  return 'http://localhost:5000/api'
}

class SecureApiService {
  /** Base URL for document CRUD — .NET API (Document Management Context) */
  private dotnetApiUrl: string

  /**
   * Base URL for Worker API — used for collaborator management and WebSocket.
   * WebSocket connections use NEXT_PUBLIC_WS_URL directly in CollaborativeEditor.
   * (Real-Time Collaboration Context)
   */
  readonly workerUrl: string

  constructor() {
    this.dotnetApiUrl = resolveDotnetApiUrl()

    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      this.workerUrl = 'https://collab-docs.collabdocs.workers.dev/api'
    } else if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      this.workerUrl = 'http://localhost:8787/api'
    } else {
      this.workerUrl = process.env.NEXT_PUBLIC_API_URL || 'https://collab-docs.collabdocs.workers.dev/api'
    }
  }

  private getBearerToken(session: NextAuthSession): string {
    // Prefer the NextAuth session JWT; fall back to user ID for local dev
    return session.sessionToken || session.user.id || ''
  }

  private async authenticatedRequest<T>(
    baseUrl: string,
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

    const url = `${baseUrl}${endpoint}`

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
      throw new Error(errorData.error || errorData.title || `HTTP error! status: ${response.status}`)
    }

    // DELETE returns 204 No Content — return empty object to satisfy generic T
    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  // ---------------------------------------------------------------------------
  // Document CRUD — routed to .NET API (Document Management Context)
  // ---------------------------------------------------------------------------

  async getDocuments(session: NextAuthSession): Promise<{ documents: Document[] }> {
    const result = await this.authenticatedRequest<{ documents: Document[]; count: number }>(
      this.dotnetApiUrl, '/documents', session
    )
    return { documents: result.documents }
  }

  async getDocument(id: string, session: NextAuthSession): Promise<{ document: Document; permission: string }> {
    const result = await this.authenticatedRequest<{ document: Document }>(
      this.dotnetApiUrl, `/documents/${id}`, session
    )
    return { document: result.document, permission: 'owner' }
  }

  async createDocument(data: CreateDocumentRequest, session: NextAuthSession): Promise<{ document: Document }> {
    return this.authenticatedRequest<{ document: Document }>(
      this.dotnetApiUrl, '/documents', session, {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async updateDocument(id: string, data: UpdateDocumentRequest, session: NextAuthSession): Promise<{ document: Document; message: string }> {
    const result = await this.authenticatedRequest<{ document: Document }>(
      this.dotnetApiUrl, `/documents/${id}`, session, {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
    return { document: result.document, message: 'Document updated successfully' }
  }

  async deleteDocument(id: string, session: NextAuthSession): Promise<{ message: string }> {
    await this.authenticatedRequest<Record<string, never>>(
      this.dotnetApiUrl, `/documents/${id}`, session, {
        method: 'DELETE',
      }
    )
    return { message: 'Document deleted successfully' }
  }

  // ---------------------------------------------------------------------------
  // Collaborator management — routed to .NET API (Document Management Context)
  // Permission mapping: frontend "read"/"write"/"owner" ↔ .NET Viewer/Editor/Owner
  // ---------------------------------------------------------------------------

  async addCollaborator(documentId: string, email: string, session: NextAuthSession, permission: 'read' | 'write' = 'read'): Promise<{ message: string }> {
    await this.authenticatedRequest<{ collaborator: Collaborator }>(
      this.dotnetApiUrl, `/documents/${documentId}/collaborators`, session, {
        method: 'POST',
        body: JSON.stringify({ email, permission }),
      }
    )
    return { message: 'Collaborator added successfully' }
  }

  async removeCollaborator(documentId: string, email: string, session: NextAuthSession): Promise<{ message: string }> {
    await this.authenticatedRequest<Record<string, never>>(
      this.dotnetApiUrl, `/documents/${documentId}/collaborators`, session, {
        method: 'DELETE',
        body: JSON.stringify({ email }),
      }
    )
    return { message: 'Collaborator removed successfully' }
  }

  async getDocumentCollaborators(documentId: string, session: NextAuthSession): Promise<{ collaborators: Collaborator[]; total: number }> {
    return this.authenticatedRequest<{ collaborators: Collaborator[]; total: number }>(
      this.dotnetApiUrl, `/documents/${documentId}/collaborators`, session
    )
  }
}

export const secureApiService = new SecureApiService()
