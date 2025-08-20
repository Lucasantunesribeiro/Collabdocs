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
  
  // Método para limpar cache forçadamente 
  public clearCache(): void {
    this.sessionToken = null;
    this.userProfile = null;
    try {
      localStorage.removeItem('collabdocs_user_profile');
      localStorage.removeItem('collabdocs_session_token');
      console.log('[AUTH] 🧹 Cache da API limpo completamente');
    } catch (error) {
      console.log('[AUTH] Erro ao limpar cache da API:', error);
    }
  }

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
    
    // 1. SEMPRE LIMPAR localStorage para forçar detecção fresca
    try {
      localStorage.removeItem('collabdocs_user_profile');
      localStorage.removeItem('collabdocs_session_token');
      console.log('[AUTH] 🧹 localStorage limpo para detecção fresca');
    } catch (error) {
      console.log('[AUTH] Erro ao limpar localStorage:', error);
    }
    
    // 2. DETECÇÃO AGRESSIVA do DOM e URL (dados do Google OAuth)
    try {
      console.log('[AUTH] 🔍 Analisando URL para dados do usuário...');
      console.log('[AUTH] URL completa:', window.location.href);
      console.log('[AUTH] Query params:', window.location.search);
      
      // A. Primeiro tentar extrair da URL (parâmetros do OAuth)
      const urlParams = new URLSearchParams(window.location.search);
      console.log('[AUTH] Parâmetros encontrados:', Array.from(urlParams.entries()));
      
      // Verificar por parâmetros comuns do OAuth
      const possibleUserParams = ['user', 'profile', 'name', 'email', 'userData'];
      for (const param of possibleUserParams) {
        const value = urlParams.get(param);
        if (value) {
          console.log(`[AUTH] Parâmetro ${param} encontrado:`, value);
          try {
            const userData = JSON.parse(decodeURIComponent(value));
            if (userData.name) userName = userData.name;
            if (userData.email) userEmail = userData.email;
            console.log('[AUTH] ✅ Dados extraídos da URL:', { name: userName, email: userEmail });
          } catch (e) {
            console.log(`[AUTH] Erro ao parsear ${param}:`, e);
          }
        }
      }
      
      // B. Busca EXTENSIVA no DOM por nome do usuário
      if (!userName) {
        console.log('[AUTH] 🔍 Busca extensiva no DOM...');
        
        // Buscar em TODOS os elementos da página
        const allElements = document.querySelectorAll('*');
        console.log(`[AUTH] Analisando ${allElements.length} elementos do DOM...`);
        
        for (let i = 0; i < allElements.length; i++) {
          const element = allElements[i];
          const text = element.textContent?.trim();
          
          if (text && text.length > 2 && text.length < 100) {
            // Padrões específicos para nomes de usuário
            const patterns = [
              /Bem-vindo,?\s+([A-Za-z0-9\s]+)/i,
              /Welcome,?\s+([A-Za-z0-9\s]+)/i,
              /Hello,?\s+([A-Za-z0-9\s]+)/i,
              /Olá,?\s+([A-Za-z0-9\s]+)/i,
              /^([A-Za-z0-9\s]{3,30})$/  // Nome simples
            ];
            
            for (const pattern of patterns) {
              const match = text.match(pattern);
              if (match && match[1]) {
                const potentialName = match[1].trim();
                // Filtrar nomes que não sejam válidos
                if (!potentialName.includes('CollabDocs') && 
                    !potentialName.includes('Dashboard') && 
                    !potentialName.includes('Document') &&
                    !potentialName.includes('Criar') &&
                    !potentialName.includes('Bem-vindo') &&
                    potentialName.length > 2 && 
                    potentialName.length < 50) {
                  userName = potentialName;
                  console.log('[AUTH] ✅ Nome detectado no DOM:', userName, 'elemento:', element.tagName);
                  break;
                }
              }
            }
          }
          
          if (userName) break;
        }
      }
      
      // C. Buscar email no DOM (dados ocultos, atributos, etc)
      if (!userEmail) {
        const emailSelectors = [
          '[data-user-email]', '[data-email]', '.user-email', '.profile-email',
          'input[type="email"]', 'input[name="email"]', '[title*="@"]'
        ];
        
        for (const selector of emailSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent?.trim() || 
                        (element as any).value?.trim() || 
                        element.getAttribute('data-email') ||
                        element.getAttribute('title');
            
            if (text && text.includes('@') && text.includes('.')) {
              userEmail = text;
              console.log('[AUTH] ✅ Email detectado do DOM:', userEmail);
              break;
            }
          }
          if (userEmail) break;
        }
      }
      
    } catch (error) {
      console.log('[AUTH] Erro na detecção agressiva:', error);
    }
    
    // 3. Gerar email baseado no nome se não encontrou
    if (userName && !userEmail) {
      // Converter nome para email (exemplo: "Lightzin FPS" -> "lightzin.fps@gmail.com")
      const emailName = userName.toLowerCase().replace(/\s+/g, '.');
      userEmail = `${emailName}@gmail.com`;
      console.log('[AUTH] 📧 Email gerado baseado no nome:', userEmail);
    }
    
    // 4. Fallback apenas se REALMENTE não conseguiu detectar nada
    if (!userName && !userEmail) {
      console.log('[AUTH] ❌ FALHA TOTAL na detecção - usando fallback temporário');
      userName = `Usuario-${Date.now()}`;
      userEmail = `user-${Date.now()}@temp.local`;
    } else if (!userEmail && userName) {
      // Gerar email baseado no nome se só temos o nome
      const emailName = userName.toLowerCase().replace(/\s+/g, '.');
      userEmail = `${emailName}@gmail.com`;
      console.log('[AUTH] 📧 Email gerado baseado no nome:', userEmail);
    } else if (!userName && userEmail) {
      // Gerar nome baseado no email se só temos o email
      userName = userEmail.split('@')[0].replace(/\./g, ' ');
      console.log('[AUTH] 👤 Nome gerado baseado no email:', userName);
    }
    
    // NÃO SALVAR no localStorage para forçar detecção sempre fresca
    const detectedProfile = { name: userName, email: userEmail };
    console.log('[AUTH] 🎯 PERFIL FINAL (SEM CACHE):', detectedProfile);
    console.log('[AUTH] 🔍 Fonte dos dados:', {
      nomeDetectado: !!userName,
      emailDetectado: !!userEmail,
      timestamp: new Date().toISOString()
    });
    
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
