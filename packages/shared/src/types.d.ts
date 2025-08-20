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
    content: string;
    visibility: 'private' | 'public';
    created_at: string;
    updated_at: string;
    last_snapshot_r2_key?: string;
    // Campos adicionais para informações do proprietário
    owner_name?: string;
    owner_avatar_url?: string;
}
export interface Snapshot {
    id: string;
    document_id: string;
    r2_key: string;
    version_number: number;
    created_at: string;
    author_id: string;
}
export interface Permission {
    document_id: string;
    user_id: string;
    role: 'owner' | 'editor' | 'viewer';
    granted_at: string;
}
export interface Comment {
    id: string;
    document_id: string;
    user_id: string;
    parent_comment_id?: string;
    content: string;
    position_json?: string;
    created_at: string;
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
export interface WebSocketMessage {
    type: 'sync' | 'presence' | 'comment' | 'error';
    data: any;
    clientId?: string;
    userId?: string;
}
export interface PresenceData {
    userId: string;
    name: string;
    avatar_url?: string;
    cursor?: {
        x: number;
        y: number;
    };
    selection?: {
        anchor: number;
        head: number;
    };
}
