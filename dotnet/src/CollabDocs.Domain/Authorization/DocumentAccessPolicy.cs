using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;

namespace CollabDocs.Domain.Authorization;

/// <summary>
/// Política única de autorização por documento (fonte da verdade do backend .NET).
///
/// Matriz papel x operação:
/// <code>
/// Operação             | None | PublicReader | Viewer | Editor | Owner
/// ---------------------+------+--------------+--------+--------+------
/// Read                 |  -   |      x       |   x    |   x    |  x
/// ListCollaborators    |  -   |      -       |   x    |   x    |  x
/// EditContent          |  -   |      -       |   -    |   x    |  x
/// Rename               |  -   |      -       |   -    |   x    |  x
/// ChangeVisibility     |  -   |      -       |   -    |   -    |  x
/// Delete               |  -   |      -       |   -    |   -    |  x
/// ManageCollaborators  |  -   |      -       |   -    |   -    |  x
/// ConnectRealtime      |  -   |      x       |   x    |   x    |  x
/// SendRealtimeUpdate   |  -   |      -       |   -    |   x    |  x
/// </code>
/// Quem não tem <see cref="DocumentOperation.Read"/> recebe 404 (não vaza existência);
/// quem lê mas não pode executar a operação recebe 403.
/// </summary>
public static class DocumentAccessPolicy
{
    public static DocumentRole ResolveRole(
        Document document,
        string? userId,
        string? userEmail,
        IEnumerable<DocumentCollaborator> collaborators)
    {
        ArgumentNullException.ThrowIfNull(document);

        if (!string.IsNullOrWhiteSpace(userId) && document.OwnerId == userId)
            return DocumentRole.Owner;

        var best = DocumentRole.None;
        foreach (var c in collaborators)
        {
            if (c.DocumentId != Guid.Empty && c.DocumentId != document.Id) continue;
            if (!Matches(c, userId, userEmail)) continue;

            var role = FromPermission(c.Permission);
            if (role > best) best = role;
        }

        if (best != DocumentRole.None) return best;

        return document.Visibility == Visibility.Public
            ? DocumentRole.PublicReader
            : DocumentRole.None;
    }

    public static bool Can(DocumentRole role, DocumentOperation operation) => operation switch
    {
        DocumentOperation.Read                => role >= DocumentRole.PublicReader,
        DocumentOperation.ConnectRealtime     => role >= DocumentRole.PublicReader,
        DocumentOperation.ListCollaborators   => role >= DocumentRole.Viewer,
        DocumentOperation.EditContent         => role >= DocumentRole.Editor,
        DocumentOperation.Rename              => role >= DocumentRole.Editor,
        DocumentOperation.SendRealtimeUpdate  => role >= DocumentRole.Editor,
        DocumentOperation.ChangeVisibility    => role == DocumentRole.Owner,
        DocumentOperation.Delete              => role == DocumentRole.Owner,
        DocumentOperation.ManageCollaborators => role == DocumentRole.Owner,
        _                                     => false,
    };

    /// <summary>Representação usada pela API/frontend: "owner" | "write" | "read" | null.</summary>
    public static string? ToApiPermission(DocumentRole role) => role switch
    {
        DocumentRole.Owner        => "owner",
        DocumentRole.Editor       => "write",
        DocumentRole.Viewer       => "read",
        DocumentRole.PublicReader => "read",
        _                         => null,
    };

    /// <summary>
    /// Uma linha de colaborador com Permission.Owner (legado) NÃO dá poderes de dono:
    /// excluir, mudar visibilidade e gerenciar colaboradores são exclusivos de Document.OwnerId.
    /// </summary>
    private static DocumentRole FromPermission(Permission permission) => permission switch
    {
        Permission.Owner  => DocumentRole.Editor,
        Permission.Editor => DocumentRole.Editor,
        Permission.Viewer => DocumentRole.Viewer,
        _                 => DocumentRole.None,
    };

    private static bool Matches(DocumentCollaborator c, string? userId, string? userEmail)
    {
        if (!string.IsNullOrWhiteSpace(userId) && !string.IsNullOrWhiteSpace(c.UserId) && c.UserId == userId)
            return true;

        return !string.IsNullOrWhiteSpace(userEmail)
            && !string.IsNullOrWhiteSpace(c.UserEmail)
            && string.Equals(c.UserEmail.Trim(), userEmail.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
