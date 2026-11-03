import type { AuthenticatedUser } from '../domain/types';
import {
  can,
  resolveRole,
  roleFromApiPermission,
  type DocumentRole,
} from '../domain/authorization';
import { checkCollaboratorAccess, findDocumentById } from '../infrastructure/db';
import { logger } from '../lib/logger';

export interface RealtimeAccessEnv {
  DB: D1Database;
  /**
   * URL base da API .NET (ex.: https://api.exemplo.com/api). Quando definida, ela é a
   * fonte da verdade do papel do usuário (os documentos do frontend vivem no PostgreSQL).
   * Sem ela, o papel é resolvido a partir do D1 do próprio Worker.
   */
  DOCUMENTS_API_URL?: string;
}

/**
 * Resolve o papel do usuário para a sessão em tempo real. Sempre fail-closed:
 * qualquer erro (rede, 5xx, JSON inválido, D1 indisponível) => 'none'.
 */
export async function resolveRealtimeRole(
  env: RealtimeAccessEnv,
  documentId: string,
  user: AuthenticatedUser,
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<DocumentRole> {
  try {
    const apiUrl = env.DOCUMENTS_API_URL?.trim();
    if (apiUrl) {
      const res = await fetchImpl(
        `${apiUrl.replace(/\/+$/, '')}/documents/${encodeURIComponent(documentId)}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      if (!res.ok) return 'none';
      const body = (await res.json()) as { document?: { id?: string; permission?: unknown; is_owner?: unknown } };
      // A resposta precisa ser do mesmo documento pedido (sem id => nega).
      if (!body?.document?.id || String(body.document.id).toLowerCase() !== documentId.toLowerCase()) {
        return 'none';
      }
      const role = roleFromApiPermission(body?.document?.permission);
      if (role !== 'none') return role;
      return body?.document?.is_owner === true ? 'owner' : 'none';
    }

    const doc = await findDocumentById(env.DB, documentId);
    if (!doc) return 'none';
    const permission = await checkCollaboratorAccess(env.DB, documentId, user.id, user.email);
    return resolveRole(doc, user.id, permission);
  } catch (err) {
    logger.warn('resolveRealtimeRole failed — denying', {
      documentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return 'none';
  }
}

export const VERIFIED_PARAMS = {
  userId: '__verified_userId',
  userName: '__verified_userName',
  email: '__verified_email',
  role: '__verified_role',
  documentId: '__verified_documentId',
  expiresAt: '__verified_expiresAt',
} as const;

/**
 * Duração máxima de uma sessão WebSocket autorizada. O papel é resolvido uma vez,
 * no upgrade; ao fim deste prazo o Durable Object fecha a conexão (código
 * {@link REAUTH_CLOSE_CODE}) e o cliente reconecta, passando de novo pela
 * autorização. Assim, revogar um colaborador ou tornar o documento privado
 * corta o tempo real em no máximo este intervalo.
 */
export const MAX_REALTIME_SESSION_MS = 10 * 60 * 1000;

/** Código de fechamento (faixa de aplicação 4000-4999): "reautentique e reconecte". */
export const REAUTH_CLOSE_CODE = 4001;

/**
 * Instante (ms desde epoch) em que a sessão expira: o menor entre a expiração do JWT
 * e agora + {@link MAX_REALTIME_SESSION_MS}.
 */
export function computeSessionExpiry(
  tokenExpSeconds: number | undefined,
  nowMs: number = Date.now(),
  maxMs: number = MAX_REALTIME_SESSION_MS
): number {
  const cap = nowMs + maxMs;
  if (typeof tokenExpSeconds !== 'number' || !Number.isFinite(tokenExpSeconds)) return cap;
  return Math.min(cap, tokenExpSeconds * 1000);
}

/**
 * Monta a URL encaminhada ao Durable Object: remove o token e qualquer parâmetro
 * "__verified_*" vindo do cliente e injeta apenas a identidade/papel verificados.
 */
export function buildVerifiedSessionUrl(
  requestUrl: string,
  documentId: string,
  user: AuthenticatedUser,
  role: DocumentRole,
  expiresAtMs: number = computeSessionExpiry(user.exp)
): string {
  const url = new URL(requestUrl);
  for (const key of Array.from(url.searchParams.keys())) {
    if (key === 'token' || key.startsWith('__verified_')) url.searchParams.delete(key);
  }
  url.searchParams.set(VERIFIED_PARAMS.userId, user.id);
  url.searchParams.set(VERIFIED_PARAMS.userName, user.name);
  url.searchParams.set(VERIFIED_PARAMS.email, user.email);
  url.searchParams.set(VERIFIED_PARAMS.role, role);
  url.searchParams.set(VERIFIED_PARAMS.documentId, documentId);
  url.searchParams.set(VERIFIED_PARAMS.expiresAt, String(Math.floor(expiresAtMs)));
  return url.toString();
}

export function canConnect(role: DocumentRole): boolean {
  return can(role, 'connect_realtime');
}
