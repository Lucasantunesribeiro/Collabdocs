import { canConnect, VERIFIED_PARAMS } from './access';
import { parseClientMessage, type SessionIdentity } from './messages';
import { ALL_ROLES, type DocumentRole } from '../domain/authorization';

export interface Env {
  DB: D1Database;
}

interface ServerMessage {
  type: 'join' | 'leave';
  userId: string;
  userName: string;
  documentId: string;
}

interface ConnectedClient {
  socket: WebSocket;
  identity: SessionIdentity;
}

/**
 * Sessão de colaboração por documento. Só é alcançável pelo router do Worker,
 * que autentica o JWT e autoriza o papel ANTES de encaminhar. Aqui o DO confia
 * apenas nos parâmetros "__verified_*" e reaplica a política por mensagem.
 */
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
    const userId = url.searchParams.get(VERIFIED_PARAMS.userId);
    const userName = url.searchParams.get(VERIFIED_PARAMS.userName) || 'User';
    const documentId = url.searchParams.get(VERIFIED_PARAMS.documentId) || '';
    const rawRole = url.searchParams.get(VERIFIED_PARAMS.role) as DocumentRole | null;
    const role: DocumentRole = rawRole && ALL_ROLES.includes(rawRole) ? rawRole : 'none';

    if (!userId || !documentId) {
      return new Response('Unauthorized', { status: 401 });
    }
    if (!canConnect(role)) {
      return new Response('Not Found', { status: 404 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.handleSession(server, { userId, userName, documentId, role });

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleSession(socket: WebSocket, identity: SessionIdentity): void {
    socket.accept();

    const clientId = `${identity.userId}-${crypto.randomUUID()}`;
    const connectedUsers = Array.from(this.clients.values()).map((c) => ({
      userId: c.identity.userId,
      userName: c.identity.userName,
    }));
    this.clients.set(clientId, { socket, identity });

    this.broadcast(
      { type: 'join', userId: identity.userId, userName: identity.userName, documentId: identity.documentId },
      clientId
    );

    socket.send(
      JSON.stringify({ type: 'connected', users: connectedUsers, role: identity.role })
    );

    socket.addEventListener('message', (event) => {
      const result = parseClientMessage(event.data, identity);
      if (!result.ok) {
        if (result.reason === 'forbidden') {
          socket.send(JSON.stringify({ type: 'error', error: 'forbidden', message: 'Read-only access' }));
        }
        return;
      }
      this.broadcast(result.message, clientId);
    });

    socket.addEventListener('close', () => {
      this.clients.delete(clientId);
      this.broadcast(
        { type: 'leave', userId: identity.userId, userName: identity.userName, documentId: identity.documentId },
        clientId
      );
    });

    socket.addEventListener('error', () => {
      this.clients.delete(clientId);
    });
  }

  private broadcast(msg: ServerMessage | object, excludeClientId?: string): void {
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
