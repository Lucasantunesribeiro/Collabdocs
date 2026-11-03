import type { AuthenticatedUser, Document } from '../domain/types';
import { checkCollaboratorAccess, findDocumentById } from '../infrastructure/db';
import {
  assertCan,
  resolveRole,
  type DocumentOperation,
  type DocumentRole,
} from '../domain/authorization';

/**
 * Ponto único de autorização por documento nos casos de uso do Worker.
 * Carrega o documento, resolve o papel do usuário e exige as operações:
 * inexistente ou sem leitura => 404 (mesma mensagem); sem a operação => 403.
 */
export async function authorizeDocument(
  db: D1Database,
  user: AuthenticatedUser,
  documentId: string,
  ...operations: DocumentOperation[]
): Promise<{ doc: Document; role: DocumentRole }> {
  const doc = await findDocumentById(db, documentId);
  const collaboratorPermission = doc
    ? await checkCollaboratorAccess(db, documentId, user.id, user.email)
    : null;
  const role = resolveRole(doc, user.id, collaboratorPermission);
  assertCan(role, ...operations);
  return { doc: doc as Document, role };
}
