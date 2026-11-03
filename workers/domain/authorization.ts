/**
 * Política única de autorização por documento do Worker (espelha
 * dotnet/src/CollabDocs.Domain/Authorization/DocumentAccessPolicy.cs).
 *
 * Operação             | none | public_reader | viewer | editor | owner
 * ---------------------+------+---------------+--------+--------+------
 * read                 |  -   |       x       |   x    |   x    |  x
 * list_collaborators   |  -   |       -*      |   x    |   x    |  x
 * edit_content         |  -   |       -       |   -    |   x    |  x
 * rename               |  -   |       -       |   -    |   x    |  x
 * change_visibility    |  -   |       -       |   -    |   -    |  x
 * delete               |  -   |       -       |   -    |   -    |  x
 * manage_collaborators |  -   |       -       |   -    |   -    |  x
 * connect_realtime     |  -   |       x       |   x    |   x    |  x
 * send_realtime_update |  -   |       -       |   -    |   x    |  x
 *
 * (*) leitor público recebe lista vazia (não vê e-mails de colaboradores).
 *
 * Sem `read` => 404 (não revela que o documento existe); com `read` mas sem
 * a operação => 403.
 */

export type DocumentRole = 'none' | 'public_reader' | 'viewer' | 'editor' | 'owner';

export type DocumentOperation =
  | 'read'
  | 'list_collaborators'
  | 'edit_content'
  | 'rename'
  | 'change_visibility'
  | 'delete'
  | 'manage_collaborators'
  | 'connect_realtime'
  | 'send_realtime_update';

const RANK: Record<DocumentRole, number> = {
  none: 0,
  public_reader: 1,
  viewer: 2,
  editor: 3,
  owner: 4,
};

const MIN_ROLE: Record<DocumentOperation, DocumentRole> = {
  read: 'public_reader',
  list_collaborators: 'viewer',
  connect_realtime: 'public_reader',
  edit_content: 'editor',
  rename: 'editor',
  send_realtime_update: 'editor',
  change_visibility: 'owner',
  delete: 'owner',
  manage_collaborators: 'owner',
};

export const ALL_ROLES: readonly DocumentRole[] = ['none', 'public_reader', 'viewer', 'editor', 'owner'];
export const ALL_OPERATIONS = Object.keys(MIN_ROLE) as DocumentOperation[];

export function can(role: DocumentRole, operation: DocumentOperation): boolean {
  if (role === 'none') return false;
  return RANK[role] >= RANK[MIN_ROLE[operation]];
}

/**
 * Converte a permissão gravada em document_collaborators ("read" | "write" | "owner")
 * em papel. Uma linha "owner" NÃO concede poderes de dono (excluir, visibilidade,
 * gerenciar colaboradores): o dono é sempre documents.owner_id.
 */
export function roleFromCollaboratorPermission(permission: string | null | undefined): DocumentRole {
  switch (permission) {
    case 'owner':
    case 'write':
      return 'editor';
    case 'read':
      return 'viewer';
    default:
      return 'none';
  }
}

export function resolveRole(
  doc: { owner_id: string; visibility: string } | null | undefined,
  userId: string,
  collaboratorPermission: string | null | undefined
): DocumentRole {
  if (!doc) return 'none';
  if (userId && doc.owner_id === userId) return 'owner';
  const collabRole = roleFromCollaboratorPermission(collaboratorPermission);
  if (collabRole !== 'none') return collabRole;
  return doc.visibility === 'public' ? 'public_reader' : 'none';
}

/** Permissão exposta na API: "owner" | "write" | "read". */
export function toApiPermission(role: DocumentRole): 'owner' | 'write' | 'read' | null {
  switch (role) {
    case 'owner':
      return 'owner';
    case 'editor':
      return 'write';
    case 'viewer':
    case 'public_reader':
      return 'read';
    default:
      return null;
  }
}

/** Mapeia a permissão devolvida pela API .NET ("owner" | "write" | "read") em papel. */
export function roleFromApiPermission(permission: unknown): DocumentRole {
  switch (permission) {
    case 'owner':
      return 'owner';
    case 'write':
      return 'editor';
    case 'read':
      return 'viewer';
    default:
      return 'none';
  }
}

export class DocumentAccessError extends Error {
  constructor(public readonly status: 403 | 404, message: string) {
    super(message);
    this.name = 'DocumentAccessError';
  }
}

/**
 * Exige as operações para o papel. Lança 404 quando o papel não pode ler
 * (mesma mensagem de "não existe") e 403 quando lê mas não pode executar.
 */
export function assertCan(role: DocumentRole, ...operations: DocumentOperation[]): void {
  if (!can(role, 'read')) {
    throw new DocumentAccessError(404, 'Document not found');
  }
  for (const op of operations) {
    if (!can(role, op)) {
      throw new DocumentAccessError(403, 'You do not have permission to perform this operation');
    }
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
