import * as Y from 'yjs';
import { WebSocketMessage, PresenceData } from '@collab-docs/shared';

export interface CloudflareProviderOptions {
  documentId: string;
  token: string;
  url?: string;
  onPresence?: (data: PresenceData[]) => void;
  onComment?: (data: any) => void;
}

export class CloudflareProvider {
  private doc: Y.Doc;
  private ws: WebSocket | null = null;
  private connected = false;
  private options: CloudflareProviderOptions;
  private synced = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(doc: Y.Doc, options: CloudflareProviderOptions) {
    this.doc = doc;
    this.options = {
      url: 'wss://collab-docs.workers.dev',
      ...options,
    };

    this.connect();
    this.setupDocumentListeners();
  }

  private setupDocumentListeners(): void {
    this.doc.on('update', this.handleDocumentUpdate.bind(this));
  }

  private handleDocumentUpdate(update: Uint8Array, origin: any): void {
    if (origin === this || !this.connected || !this.synced) {
      return;
    }

    this.sendBinary(update);
  }

  private connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `${this.options.url}/ws/${this.options.documentId}?token=${this.options.token}`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketListeners();
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private setupWebSocketListeners(): void {
    if (!this.ws) return;

    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('Connected to CollabDocs');

      // Send state vector for initial sync
      const stateVector = Y.encodeStateVector(this.doc);
      this.sendBinary(stateVector);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event);
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.synced = false;
      console.log('Disconnected from CollabDocs');
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.connected = false;
      this.synced = false;
    };
  }

  private handleMessage(event: MessageEvent): void {
    if (event.data instanceof ArrayBuffer) {
      // Handle binary Yjs update
      const update = new Uint8Array(event.data);
      Y.applyUpdate(this.doc, update, this);
      
      if (!this.synced) {
        this.synced = true;
        console.log('Document synced');
      }
      
      return;
    }

    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'sync':
          // Initial state sync
          if (Array.isArray(message.data)) {
            const update = new Uint8Array(message.data);
            Y.applyUpdate(this.doc, update, this);
            
            // Send our state as diff update
            const stateVector = Y.encodeStateVector(this.doc);
            const diff = Y.encodeStateAsUpdate(this.doc, stateVector);
            if (diff.length > 0) {
              this.sendBinary(diff);
            }
            
            this.synced = true;
          }
          break;
          
        case 'presence':
          if (this.options.onPresence) {
            this.options.onPresence(message.data);
          }
          break;
          
        case 'comment':
          if (this.options.onComment) {
            this.options.onComment(message.data);
          }
          break;
          
        case 'error':
          console.error('Server error:', message.data);
          break;
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  private sendBinary(data: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  private sendMessage(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }

  // Public methods
  
  public sendPresence(data: PresenceData): void {
    this.sendMessage({
      type: 'presence',
      data,
    });
  }

  public sendComment(content: string, position?: any): void {
    this.sendMessage({
      type: 'comment',
      data: { content, position },
    });
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.synced = false;
  }

  public get isConnected(): boolean {
    return this.connected;
  }

  public get isSynced(): boolean {
    return this.synced;
  }
}