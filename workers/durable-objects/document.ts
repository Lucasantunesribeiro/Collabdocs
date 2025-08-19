import * as Y from 'yjs';
import { WebSocketMessage, PresenceData } from '@collab-docs/shared';

export interface Env {
  DB: D1Database;
  // SNAPSHOTS: R2Bucket;
  CACHE: KVNamespace;
}

interface ClientConnection {
  webSocket: WebSocket;
  userId: string;
  name: string;
  avatar_url?: string;
}

export class DocumentDurableObject {
  private storage: DurableObjectStorage;
  private env: Env;
  private sessions: Map<string, ClientConnection> = new Map();
  private doc: Y.Doc = new Y.Doc();
  private lastUpdate: number = 0;
  private updateCount: number = 0;
  private documentId: string = '';

  constructor(state: DurableObjectState, env: Env) {
    this.storage = state.storage;
    this.env = env;
    
    // Setup Yjs document observers
    this.doc.on('update', this.handleYjsUpdate.bind(this));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const documentId = url.pathname.split('/').pop();
    
    if (!documentId) {
      return new Response('Document ID required', { status: 400 });
    }

    this.documentId = documentId;

    // Handle WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    // Verify JWT token
    const token = this.extractToken(request);
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    const user = await this.verifyToken(token);
    if (!user) {
      return new Response('Invalid token', { status: 401 });
    }

    // Check document permissions
    const hasAccess = await this.checkDocumentAccess(documentId, user.sub);
    if (!hasAccess) {
      return new Response('Forbidden', { status: 403 });
    }

    // Initialize document if not loaded
    await this.initializeDocument(documentId);

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    await this.handleSession(server, user);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private extractToken(request: Request): string | null {
    const authorization = request.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice(7);
    }
    
    // Check URL params for token
    const url = new URL(request.url);
    return url.searchParams.get('token');
  }

  private async verifyToken(token: string): Promise<any> {
    try {
      // Simplified JWT verification - em produção usar biblioteca crypto
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      
      // Check expiration
      if (payload.exp < Date.now() / 1000) return null;
      
      return payload;
    } catch {
      return null;
    }
  }

  private async checkDocumentAccess(documentId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT p.role FROM permissions p
        WHERE p.document_id = ? AND p.user_id = ?
        UNION
        SELECT 'owner' as role FROM documents d
        WHERE d.id = ? AND d.owner_id = ?
      `).bind(documentId, userId, documentId, userId).first();

      return !!result;
    } catch (error) {
      console.error('Error checking document access:', error);
      return false;
    }
  }

  private async initializeDocument(documentId: string): Promise<void> {
    try {
      // Load latest snapshot if exists
      const doc = await this.env.DB.prepare(`
        SELECT last_snapshot_r2_key FROM documents WHERE id = ?
      `).bind(documentId).first();

      // if (doc?.last_snapshot_r2_key) {
      //   const snapshot = await this.env.SNAPSHOTS.get(doc.last_snapshot_r2_key);
      //   if (snapshot) {
      //     const buffer = await snapshot.arrayBuffer();
      //     const update = new Uint8Array(buffer);
      //     Y.applyUpdate(this.doc, update);
      //   }
      // }
    } catch (error) {
      console.error('Error initializing document:', error);
    }
  }

  private async handleSession(webSocket: WebSocket, user: any): Promise<void> {
    const clientId = crypto.randomUUID();
    
    const connection: ClientConnection = {
      webSocket,
      userId: user.sub,
      name: user.name,
      avatar_url: user.avatar_url,
    };

    this.sessions.set(clientId, connection);

    webSocket.accept();

    // Send initial state
    const stateVector = Y.encodeStateVector(this.doc);
    this.sendMessage(webSocket, {
      type: 'sync',
      data: Array.from(stateVector),
    });

    // Handle messages
    webSocket.addEventListener('message', (event) => {
      this.handleWebSocketMessage(clientId, event);
    });

    webSocket.addEventListener('close', () => {
      this.sessions.delete(clientId);
      this.broadcastPresence();
    });

    this.broadcastPresence();
  }

  private handleWebSocketMessage(clientId: string, event: MessageEvent): void {
    try {
      const connection = this.sessions.get(clientId);
      if (!connection) return;

      if (event.data instanceof ArrayBuffer) {
        // Handle binary Yjs update
        const update = new Uint8Array(event.data);
        Y.applyUpdate(this.doc, update);
        
        // Broadcast to other clients
        this.broadcastUpdate(clientId, update);
        
        this.updateCount++;
        this.lastUpdate = Date.now();
        
        // Trigger snapshot if needed
        this.maybeCreateSnapshot();
        
        return;
      }

      // Handle JSON messages
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'presence':
          this.handlePresenceUpdate(clientId, message.data);
          break;
        case 'comment':
          this.handleComment(clientId, message.data);
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private handleYjsUpdate(update: Uint8Array): void {
    // This is called when the document is updated
    // We don't need to do anything here as updates are handled in handleWebSocketMessage
  }

  private broadcastUpdate(excludeClientId: string, update: Uint8Array): void {
    for (const [clientId, connection] of this.sessions) {
      if (clientId !== excludeClientId && connection.webSocket.readyState === WebSocket.READY_STATE_OPEN) {
        connection.webSocket.send(update);
      }
    }
  }

  private handlePresenceUpdate(clientId: string, presenceData: PresenceData): void {
    const message: WebSocketMessage = {
      type: 'presence',
      data: presenceData,
      clientId,
    };

    this.broadcast(JSON.stringify(message), clientId);
  }

  private async handleComment(clientId: string, commentData: any): Promise<void> {
    const connection = this.sessions.get(clientId);
    if (!connection) return;

    try {
      const commentId = crypto.randomUUID();
      
      await this.env.DB.prepare(`
        INSERT INTO comments (id, document_id, user_id, content, position_json)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        commentId,
        this.documentId,
        connection.userId,
        commentData.content,
        JSON.stringify(commentData.position)
      ).run();

      const message: WebSocketMessage = {
        type: 'comment',
        data: {
          id: commentId,
          user: {
            name: connection.name,
            avatar_url: connection.avatar_url,
          },
          ...commentData,
        },
      };

      this.broadcast(JSON.stringify(message));
    } catch (error) {
      console.error('Error handling comment:', error);
    }
  }

  private broadcastPresence(): void {
    const presenceList = Array.from(this.sessions.values()).map(conn => ({
      userId: conn.userId,
      name: conn.name,
      avatar_url: conn.avatar_url,
    }));

    const message: WebSocketMessage = {
      type: 'presence',
      data: presenceList,
    };

    this.broadcast(JSON.stringify(message));
  }

  private broadcast(data: string, excludeClientId?: string): void {
    for (const [clientId, connection] of this.sessions) {
      if (clientId !== excludeClientId && connection.webSocket.readyState === WebSocket.READY_STATE_OPEN) {
        connection.webSocket.send(data);
      }
    }
  }

  private sendMessage(webSocket: WebSocket, message: WebSocketMessage): void {
    if (webSocket.readyState === WebSocket.READY_STATE_OPEN) {
      webSocket.send(JSON.stringify(message));
    }
  }

  private async maybeCreateSnapshot(): Promise<void> {
    // Snapshots temporarily disabled due to R2 not being enabled
    return;
  }

  private async compressData(data: Uint8Array): Promise<Uint8Array> {
    // Simple compression using CompressionStream
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(data);
    writer.close();
    
    const chunks: Uint8Array[] = [];
    let result = await reader.read();
    
    while (!result.done) {
      chunks.push(result.value);
      result = await reader.read();
    }
    
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const compressed = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      compressed.set(chunk, offset);
      offset += chunk.length;
    }
    
    return compressed;
  }
}