import { describe, it, expect } from 'vitest';
import { User, Document, JWTPayload, WebSocketMessage } from '@collab-docs/shared';

describe('Shared Types', () => {
  describe('User', () => {
    it('should have all required properties', () => {
      const user: User = {
        id: 'github:123456',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://avatar.url',
        provider: 'github',
        provider_id: '123456',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(user.id).toBe('github:123456');
      expect(user.email).toBe('test@example.com');
      expect(user.provider).toBe('github');
    });

    it('should validate provider types', () => {
      const githubUser: User = {
        id: 'github:123',
        email: 'test@example.com',
        name: 'Test',
        provider: 'github',
        provider_id: '123',
        created_at: '2024-01-01T00:00:00Z',
      };

      const googleUser: User = {
        id: 'google:456',
        email: 'test@example.com',
        name: 'Test',
        provider: 'google',
        provider_id: '456',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(githubUser.provider).toBe('github');
      expect(googleUser.provider).toBe('google');
    });
  });

  describe('Document', () => {
    it('should have all required properties', () => {
      const document: Document = {
        id: 'doc-123',
        owner_id: 'user-456',
        title: 'Test Document',
        visibility: 'private',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_snapshot_r2_key: 'snapshots/doc-123/latest.bin',
      };

      expect(document.id).toBe('doc-123');
      expect(document.title).toBe('Test Document');
      expect(document.visibility).toBe('private');
    });

    it('should validate visibility types', () => {
      const privateDoc: Document = {
        id: 'doc-1',
        owner_id: 'user-1',
        title: 'Private Doc',
        visibility: 'private',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const publicDoc: Document = {
        id: 'doc-2',
        owner_id: 'user-1',
        title: 'Public Doc',
        visibility: 'public',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(privateDoc.visibility).toBe('private');
      expect(publicDoc.visibility).toBe('public');
    });
  });

  describe('JWTPayload', () => {
    it('should have all required JWT claims', () => {
      const payload: JWTPayload = {
        sub: 'github:123456',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://avatar.url',
        provider: 'github',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      expect(payload.sub).toBe('github:123456');
      expect(payload.iat).toBeTypeOf('number');
      expect(payload.exp).toBeTypeOf('number');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });
  });

  describe('WebSocketMessage', () => {
    it('should support different message types', () => {
      const syncMessage: WebSocketMessage = {
        type: 'sync',
        data: new Uint8Array([1, 2, 3]),
      };

      const presenceMessage: WebSocketMessage = {
        type: 'presence',
        data: {
          userId: 'user-123',
          name: 'Test User',
          cursor: { x: 100, y: 200 },
        },
        clientId: 'client-456',
      };

      const errorMessage: WebSocketMessage = {
        type: 'error',
        data: { message: 'Connection failed' },
      };

      expect(syncMessage.type).toBe('sync');
      expect(presenceMessage.type).toBe('presence');
      expect(errorMessage.type).toBe('error');
    });
  });
});