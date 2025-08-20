// Types copiados de @collab-docs/shared para resolver build do Vercel
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  provider: 'github' | 'google';
  provider_id: string;
  created_at: string;
}

export interface Document {
  id: string;
  owner_id: string;
  title: string;
  content: string; // Adicionado para compatibilidade
  visibility: 'private' | 'public';
  created_at: string;
  updated_at: string;
  last_snapshot_r2_key?: string;
  // Campos adicionais para informações do proprietário
  owner_name?: string;
  owner_avatar_url?: string;
}

export interface Permission {
  document_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  granted_at: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  avatar_url?: string;
  provider: 'github' | 'google';
  iat: number;
  exp: number;
}