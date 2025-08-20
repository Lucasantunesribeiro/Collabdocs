// API service for CollabDocs
const getApiBaseUrl = () => {
  // Se estiver rodando na Vercel (produção)
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'https://collab-docs.collabdocs.workers.dev/api';
  }
  
  // Se estiver rodando localmente
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8787/api';
  }
  
  // Fallback para produção
  return process.env.NEXT_PUBLIC_API_URL || 'https://collab-docs.collabdocs.workers.dev/api';
};

const API_BASE_URL = getApiBaseUrl();

import type { Document } from '../types/shared';

export interface CreateDocumentRequest {
  title: string;
  content?: string;
  visibility?: 'private' | 'public';
}

export interface UpdateDocumentRequest {
  content: string;
  title?: string;
}

class ApiService {
  private sessionToken: string | null = null;
  private userProfile: { name: string; email: string } | null = null;
  
  // Cache estático para garantir consistência dentro da sessão
  private static CACHED_PROFILE = { name: 'Lucas Antunes', email: 'lucas.afvr@gmail.com' };
  private static CACHED_TOKEN = 'user-lucas-afvr-gmail-com';

  private getSessionToken(): string {
    // Se não há token de sessão, usar cache estático para garantir consistência
    if (!this.sessionToken) {
      // USAR SEMPRE os dados em cache para Lucas
      this.userProfile = ApiService.CACHED_PROFILE;
      this.sessionToken = ApiService.CACHED_TOKEN;
      
      console.log('[AUTH] ✅ Usando token FIXO:', this.sessionToken);
      console.log('[AUTH] ✅ Usando perfil FIXO:', this.userProfile);
      
      // Salvar no localStorage também
      try {
        localStorage.setItem('collabdocs_user_profile', JSON.stringify(this.userProfile));
        localStorage.setItem('collabdocs_session_token', this.sessionToken);
      } catch (error) {
        console.log('[AUTH] Erro ao salvar cache:', error);
      }
    }
    return this.sessionToken;
  }

  // Detectar automaticamente o perfil do usuário logado  
  private detectUserProfile(): { name: string; email: string } {
    // SEMPRE retornar dados do Lucas para garantir consistência total
    console.log('[AUTH] 🎯 Usando perfil FIXO do Lucas para consistência');
    return ApiService.CACHED_PROFILE;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Usar token de sessão persistente (MVP)
    // Em produção, isso viria do sistema de autenticação real
    const sessionToken = this.getSessionToken();
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${sessionToken}`,
      'X-User-Profile': JSON.stringify(this.userProfile), // Enviar perfil do usuário
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Get all documents
  async getDocuments(): Promise<{ documents: Document[] }> {
    return this.request<{ documents: Document[] }>('/documents');
  }

  // Get a specific document
  async getDocument(id: string): Promise<{ document: Document; permission: string }> {
    return this.request<{ document: Document; permission: string }>(`/documents/${id}`);
  }

  // Create a new document
  async createDocument(data: CreateDocumentRequest): Promise<{ document: Document }> {
    return this.request<{ document: Document }>('/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Update an existing document
  async updateDocument(id: string, data: UpdateDocumentRequest): Promise<{ document: Document; message: string }> {
    return this.request<{ document: Document; message: string }>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Get document history
  async getDocumentHistory(id: string): Promise<{ snapshots: any[] }> {
    return this.request<{ snapshots: any[] }>(`/documents/${id}/history`);
  }
}

export const apiService = new ApiService();
