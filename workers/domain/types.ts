export interface Document {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  visibility: 'private' | 'public';
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  provider: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  provider: string;
}

export interface Permission {
  document_id: string;
  user_id: string;
  role: string;
  granted_at: string;
}
