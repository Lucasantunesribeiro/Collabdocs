import { can, type DocumentRole } from '../domain/authorization';

/** Limite de tamanho por mensagem recebida do cliente (bytes aproximados). */
export const MAX_MESSAGE_BYTES = 1_000_000;

export interface SessionIdentity {
  userId: string;
  userName: string;
  documentId: string;
  role: DocumentRole;
}

export type OutboundMessage =
  | { type: 'update'; userId: string; userName: string; documentId: string; content: string }
  | { type: 'cursor'; userId: string; userName: string; documentId: string; cursor: { line: number; ch: number } };

export type InboundResult =
  | { ok: true; message: OutboundMessage }
  | { ok: false; reason: 'malformed' | 'forbidden' | 'too_large' | 'unsupported' };

/**
 * Valida uma mensagem do cliente ANTES de retransmiti-la:
 *  - somente 'update' e 'cursor' são aceitos ('join'/'leave'/'connected' são do servidor);
 *  - 'update' exige papel com send_realtime_update (viewer/leitor público => forbidden);
 *  - userId/userName/documentId vêm SEMPRE da identidade verificada, nunca do cliente.
 */
export function parseClientMessage(raw: unknown, identity: SessionIdentity): InboundResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'unsupported' };
  if (raw.length > MAX_MESSAGE_BYTES) return { ok: false, reason: 'too_large' };

  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!msg || typeof msg !== 'object') return { ok: false, reason: 'malformed' };

  const base = { userId: identity.userId, userName: identity.userName, documentId: identity.documentId };

  if (msg.type === 'update') {
    if (!can(identity.role, 'send_realtime_update')) return { ok: false, reason: 'forbidden' };
    if (typeof msg.content !== 'string') return { ok: false, reason: 'malformed' };
    return { ok: true, message: { type: 'update', ...base, content: msg.content } };
  }

  if (msg.type === 'cursor') {
    const line = Number(msg.cursor?.line);
    const ch = Number(msg.cursor?.ch);
    if (!Number.isFinite(line) || !Number.isFinite(ch)) return { ok: false, reason: 'malformed' };
    return { ok: true, message: { type: 'cursor', ...base, cursor: { line, ch } } };
  }

  return { ok: false, reason: 'unsupported' };
}
