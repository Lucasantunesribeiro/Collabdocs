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
  // Campos adicionais para informações do proprietário
  owner_name?: string;
  owner_avatar_url?: string;
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
  private sessionToken: string | null = null;
  private userProfile: { name: string; email: string } | null = null;

  private generateUniqueToken(): string {
    // Gerar um token único para cada sessão do usuário
    // Em produção, isso viria do sistema de autenticação real
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `user-${timestamp}-${random}`;
  }

  private getSessionToken(): string {
    // Se não há token de sessão, criar um novo
    if (!this.sessionToken) {
      this.sessionToken = this.generateUniqueToken();
      
      // Detectar automaticamente o perfil do usuário logado
      this.userProfile = this.detectUserProfile();
      
      console.log('🔑 Nova sessão criada com token:', this.sessionToken);
      console.log('👤 Perfil do usuário detectado:', this.userProfile);
    }
    return this.sessionToken;
  }

  // Detectar automaticamente o perfil do usuário logado
  private detectUserProfile(): { name: string; email: string } {
    // Tentar detectar o perfil de várias formas
    let userName = '';
    let userEmail = '';
    
    // 1. Tentar pegar do localStorage (se existir)
    try {
      const storedProfile = localStorage.getItem('collabdocs_user_profile');
      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        if (profile.name && profile.email) {
          userName = profile.name;
          userEmail = profile.email;
          console.log('📱 Perfil detectado do localStorage:', profile);
          return { name: userName, email: userEmail };
        }
      }
    } catch (error) {
      console.log('⚠️ Erro ao ler perfil do localStorage:', error);
    }
    
    // 2. Tentar detectar do DOM (se estiver logado)
    try {
      // Procurar por elementos que contenham o nome do usuário
      const nameElements = document.querySelectorAll('[data-user-name], .user-name, .profile-name');
      for (const element of nameElements) {
        const text = element.textContent?.trim();
        if (text && text.length > 2 && text !== 'Usuário' && text !== 'Demo') {
          userName = text;
          console.log('🔍 Nome detectado do DOM:', userName);
          break;
        }
      }
      
      // Procurar por elementos que contenham o email
      const emailElements = document.querySelectorAll('[data-user-email], .user-email, .profile-email');
      for (const element of emailElements) {
        const text = element.textContent?.trim();
        if (text && text.includes('@')) {
          userEmail = text;
          console.log('🔍 Email detectado do DOM:', userEmail);
          break;
        }
      }
    } catch (error) {
      console.log('⚠️ Erro ao detectar perfil do DOM:', error);
    }
    
    // 3. Se não conseguiu detectar, usar valores padrão baseados no token
    if (!userName) {
      const tokenHash = this.sessionToken?.slice(-8) || 'user';
      userName = `Usuário ${tokenHash}`;
    }
    
    if (!userEmail) {
      userEmail = 'usuario@collabdocs.local';
    }
    
    // Salvar o perfil detectado para uso futuro
    try {
      localStorage.setItem('collabdocs_user_profile', JSON.stringify({ name: userName, email: userEmail }));
    } catch (error) {
      console.log('⚠️ Erro ao salvar perfil no localStorage:', error);
    }
    
    return { name: userName, email: userEmail };
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
