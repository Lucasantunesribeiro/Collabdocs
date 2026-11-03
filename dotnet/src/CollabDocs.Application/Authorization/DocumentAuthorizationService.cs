using CollabDocs.Domain.Authorization;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Interfaces;

namespace CollabDocs.Application.Authorization;

public sealed record DocumentAccess(
    Document Document,
    IReadOnlyList<DocumentCollaborator> Collaborators,
    DocumentRole Role)
{
    public bool Can(DocumentOperation operation) => DocumentAccessPolicy.Can(Role, operation);
}

public interface IDocumentAuthorizationService
{
    /// <summary>
    /// Carrega o documento e seus colaboradores, resolve o papel do usuário e exige
    /// todas as operações informadas.
    /// Lança <see cref="DocumentNotFoundException"/> se o documento não existe ou o usuário
    /// não pode lê-lo, e <see cref="DocumentAccessDeniedException"/> se pode ler mas não
    /// executar alguma das operações.
    /// </summary>
    Task<DocumentAccess> AuthorizeAsync(
        Guid documentId,
        string userId,
        string? userEmail,
        IReadOnlyCollection<DocumentOperation> operations,
        CancellationToken cancellationToken = default);
}

public sealed class DocumentAuthorizationService(
    IDocumentRepository documentRepository,
    ICollaboratorRepository collaboratorRepository
) : IDocumentAuthorizationService
{
    public async Task<DocumentAccess> AuthorizeAsync(
        Guid documentId,
        string userId,
        string? userEmail,
        IReadOnlyCollection<DocumentOperation> operations,
        CancellationToken cancellationToken = default)
    {
        var document = await documentRepository.GetByIdAsync(documentId, cancellationToken)
            ?? throw new DocumentNotFoundException(documentId);

        var collaborators = await collaboratorRepository.GetByDocumentIdAsync(documentId, cancellationToken)
            ?? [];

        var role = DocumentAccessPolicy.ResolveRole(document, userId, userEmail, collaborators);

        if (!DocumentAccessPolicy.Can(role, DocumentOperation.Read))
            throw new DocumentNotFoundException(documentId);

        foreach (var operation in operations)
        {
            if (!DocumentAccessPolicy.Can(role, operation))
                throw new DocumentAccessDeniedException($"Operation '{operation}' is not allowed for role '{role}'");
        }

        return new DocumentAccess(document, collaborators, role);
    }
}

public static class DocumentAuthorizationServiceExtensions
{
    public static Task<DocumentAccess> AuthorizeAsync(
        this IDocumentAuthorizationService service,
        Guid documentId,
        string userId,
        string? userEmail,
        DocumentOperation operation,
        CancellationToken cancellationToken = default)
        => service.AuthorizeAsync(documentId, userId, userEmail, [operation], cancellationToken);
}
