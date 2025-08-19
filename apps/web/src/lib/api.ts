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

export interface Document {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  visibility: 'private' | 'public';
  owner_id: string;
}

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

    // Add demo user token for development and production (MVP)
    config.headers = {
      ...config.headers,
      'Authorization': 'Bearer demo-token',
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
