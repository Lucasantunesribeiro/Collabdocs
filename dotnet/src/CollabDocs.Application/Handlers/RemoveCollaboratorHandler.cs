using CollabDocs.Application.Authorization;
using CollabDocs.Application.Commands;
using CollabDocs.Application.Interfaces;
using CollabDocs.Domain.Authorization;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class RemoveCollaboratorHandler(
    ICollaboratorRepository collaboratorRepository,
    IDocumentAuthorizationService authorization,
    IDocumentCacheService cacheService
) : IRequestHandler<RemoveCollaboratorCommand>
{
    public async Task Handle(RemoveCollaboratorCommand request, CancellationToken cancellationToken)
    {
        // Somente o dono gerencia colaboradores; o dono não é uma linha de colaborador,
        // portanto não pode ser removido por esta rota.
        var access = await authorization.AuthorizeAsync(
            request.DocumentId, request.RequestingUserId, request.RequestingUserEmail,
            DocumentOperation.ManageCollaborators, cancellationToken);

        if (string.IsNullOrWhiteSpace(request.CollaboratorEmail))
            throw new ArgumentException("Collaborator email is required");

        var email = DocumentAccessPolicy.NormalizeEmail(request.CollaboratorEmail);
        var existing = access.Collaborators.FirstOrDefault(c =>
            string.Equals(c.UserEmail?.Trim(), email, StringComparison.OrdinalIgnoreCase));
        if (existing is null) return; // idempotente

        await collaboratorRepository.RemoveAsync(request.DocumentId, existing.UserEmail, cancellationToken);

        // Revogação de acesso: a lista em cache do ex-colaborador não pode continuar exibindo o documento.
        await cacheService.InvalidateAllAsync(cancellationToken);
    }
}
