export interface Env {
  DB: D1Database;
}

interface SessionMessage {
  type: 'update' | 'cursor' | 'join' | 'leave';
  userId: string;
  userName: string;
  documentId: string;
  content?: string;
  cursor?: { line: number; ch: number };
}

interface ConnectedClient {
  socket: WebSocket;
  userId: string;
  userName: string;
}

export class DocumentSession {
  private state: DurableObjectState;
  private clients: Map<string, ConnectedClient> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const url = new URL(request.url);
    // Use server-verified identity params set by the router after JWT validation.
    // Client-supplied userId/userName params are intentionally ignored.
    const userId = url.searchParams.get('__verified_userId');
    const userName = url.searchParams.get('__verified_userName') || 'User';

    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.handleSession(server, userId, userName);

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleSession(socket: WebSocket, userId: string, userName: string): void {
    socket.accept();

    const clientId = `${userId}-${Date.now()}`;
    this.clients.set(clientId, { socket, userId, userName });

    // Notify others of join
    this.broadcast({
      type: 'join',
      userId,
      userName,
      documentId: '',
    }, clientId);

    // Send current user list to new client
    const connectedUsers = Array.from(this.clients.values())
      .filter(c => c !== this.clients.get(clientId))
      .map(c => ({ userId: c.userId, userName: c.userName }));

    socket.send(JSON.stringify({ type: 'connected', users: connectedUsers }));

    socket.addEventListener('message', (event) => {
      try {
        const msg: SessionMessage = JSON.parse(event.data as string);
        this.broadcast(msg, clientId);
      } catch {
        // ignore malformed messages
      }
    });

    socket.addEventListener('close', () => {
      this.clients.delete(clientId);
      this.broadcast({ type: 'leave', userId, userName, documentId: '' }, clientId);
    });

    socket.addEventListener('error', () => {
      this.clients.delete(clientId);
    });
  }

  private broadcast(msg: SessionMessage, excludeClientId?: string): void {
    const payload = JSON.stringify(msg);
    for (const [id, client] of this.clients) {
      if (id === excludeClientId) continue;
      try {
        client.socket.send(payload);
      } catch {
        this.clients.delete(id);
      }
    }
  }
}
