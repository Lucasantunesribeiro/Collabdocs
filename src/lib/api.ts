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

  private getSessionToken(): string {
    // Se não há token de sessão, detectar usuário e gerar token dinâmico
    if (!this.sessionToken) {
      // Detectar perfil do usuário atual
      this.userProfile = this.detectUserProfile();
      
      // Gerar token baseado no email do usuário detectado (mesma lógica do backend)
      if (this.userProfile.email && this.userProfile.email.includes('@')) {
        const emailHash = this.userProfile.email.replace('@', '-').replace(/\./g, '-');
        this.sessionToken = `user-${emailHash}`;
        console.log('[AUTH] ✅ Token gerado para usuário:', this.userProfile.name);
        console.log('[AUTH] ✅ Token baseado no email:', this.userProfile.email);
        console.log('[AUTH] ✅ Token final:', this.sessionToken);
      } else {
        // Fallback para token baseado no nome se email for inválido
        const nameHash = this.userProfile.name.toLowerCase().replace(/\s+/g, '-');
        this.sessionToken = `user-${nameHash}`;
        console.log('[AUTH] ⚠️ Token gerado baseado no nome:', this.sessionToken);
      }
      
      console.log('[AUTH] 🎯 Nova sessão criada:', {
        name: this.userProfile.name,
        email: this.userProfile.email,
        token: this.sessionToken
      });
    }
    return this.sessionToken;
  }

  // Detectar automaticamente o perfil do usuário logado  
  private detectUserProfile(): { name: string; email: string } {
    let userName = '';
    let userEmail = '';
    
    console.log('[AUTH] 🔍 Iniciando detecção DINÂMICA do usuário...');
    
    // 1. PRIORIDADE: Verificar localStorage (dados já salvos e válidos)
    try {
      const savedProfile = localStorage.getItem('collabdocs_user_profile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        if (profile.name && profile.email && !profile.name.startsWith('Usuário ') && profile.email.includes('@') && !profile.email.includes('collabdocs.local')) {
          console.log('[AUTH] ✅ Perfil recuperado do localStorage:', profile);
          return profile;
        } else {
          console.log('[AUTH] ⚠️ Perfil do localStorage é inválido, removendo...');
          localStorage.removeItem('collabdocs_user_profile');
        }
      }
    } catch (error) {
      console.log('[AUTH] Erro ao acessar localStorage:', error);
    }
    
    // 2. Detectar do DOM (dados do Google OAuth na página)
    try {
      // Procurar pelo nome do usuário exibido na interface
      const nameSelectors = [
        'h1', 'h2', 'h3', '.user-name', '[data-user-name]', 
        '.profile-name', '.header-name', '.welcome-name'
      ];
      
      for (const selector of nameSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent?.trim();
          // Procurar por padrões como "Bem-vindo, Nome" ou só "Nome"
          if (text && text.length > 2 && !text.includes('CollabDocs') && !text.includes('Dashboard')) {
            // Extrair nome de textos como "Bem-vindo, Lightzin FPS"
            const nameMatch = text.match(/(?:Bem-vindo,?\s+)?([A-Za-z0-9\s]+)$/);
            if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 2) {
              userName = nameMatch[1].trim();
              console.log('[AUTH] ✅ Nome detectado do DOM:', userName);
              break;
            }
          }
        }
        if (userName) break;
      }
      
      // Procurar por email (menos comum na interface, mas pode estar em elementos ocultos)
      if (!userEmail) {
        const emailElements = document.querySelectorAll('[data-user-email], .user-email, input[type="email"]');
        for (const element of emailElements) {
          const text = element.textContent?.trim() || (element as HTMLInputElement).value?.trim();
          if (text && text.includes('@') && text.includes('.')) {
            userEmail = text;
            console.log('[AUTH] ✅ Email detectado do DOM:', userEmail);
            break;
          }
        }
      }
    } catch (error) {
      console.log('[AUTH] Erro ao detectar do DOM:', error);
    }
    
    // 3. Gerar email baseado no nome se não encontrou
    if (userName && !userEmail) {
      // Converter nome para email (exemplo: "Lightzin FPS" -> "lightzin.fps@gmail.com")
      const emailName = userName.toLowerCase().replace(/\s+/g, '.');
      userEmail = `${emailName}@gmail.com`;
      console.log('[AUTH] 📧 Email gerado baseado no nome:', userEmail);
    }
    
    // 4. Fallback para dados padrão apenas se não conseguiu detectar nada
    if (!userName || !userEmail) {
      console.log('[AUTH] ⚠️ Não foi possível detectar usuário, usando fallback');
      userName = 'Usuário Anônimo';
      userEmail = 'anonimo@collabdocs.local';
    }
    
    // Salvar perfil detectado no localStorage para próximas sessões
    const detectedProfile = { name: userName, email: userEmail };
    try {
      localStorage.setItem('collabdocs_user_profile', JSON.stringify(detectedProfile));
      console.log('[AUTH] ✅ Perfil salvo no localStorage:', detectedProfile);
    } catch (error) {
      console.log('[AUTH] Erro ao salvar perfil:', error);
    }
    
    console.log('[AUTH] 🎯 Perfil final detectado:', detectedProfile);
    return detectedProfile;
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
