using CollabDocs.Application.Authorization;
using CollabDocs.Application.Commands;
using CollabDocs.Application.DTOs;
using CollabDocs.Application.Interfaces;
using CollabDocs.Domain.Authorization;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class AddCollaboratorHandler(
    ICollaboratorRepository collaboratorRepository,
    IDocumentAuthorizationService authorization,
    IUserRepository userRepository,
    IDocumentCacheService cacheService
) : IRequestHandler<AddCollaboratorCommand, CollaboratorDto>
{
    public async Task<CollaboratorDto> Handle(AddCollaboratorCommand request, CancellationToken cancellationToken)
    {
        var access = await authorization.AuthorizeAsync(
            request.DocumentId, request.RequestingUserId, request.RequestingUserEmail,
            DocumentOperation.ManageCollaborators, cancellationToken);

        if (string.IsNullOrWhiteSpace(request.CollaboratorEmail) || !request.CollaboratorEmail.Contains('@'))
            throw new ArgumentException("A valid collaborator email is required");

        // Transferência/compartilhamento de posse não é suportado: o dono é sempre Document.OwnerId.
        if (request.Permission == Permission.Owner)
            throw new ArgumentException("Permission must be 'read' or 'write'");

        var email = DocumentAccessPolicy.NormalizeEmail(request.CollaboratorEmail);

        // O dono não pode ser rebaixado/registrado como colaborador do próprio documento.
        var ownerEmail = request.RequestingUserEmail;
        if (string.IsNullOrWhiteSpace(ownerEmail))
            ownerEmail = (await userRepository.GetByIdAsync(access.Document.OwnerId, cancellationToken))?.Email;
        if (!string.IsNullOrWhiteSpace(ownerEmail) && DocumentAccessPolicy.NormalizeEmail(ownerEmail) == email)
            throw new ArgumentException("The document owner cannot be added as a collaborator");

        var existing = access.Collaborators.FirstOrDefault(c =>
            string.Equals(c.UserEmail?.Trim(), email, StringComparison.OrdinalIgnoreCase));

        DocumentCollaborator collaborator;
        if (existing is not null)
        {
            // Idempotente: reconvidar o mesmo e-mail atualiza a permissão em vez de gerar 500
            // por violação do índice único (DocumentId, UserEmail).
            existing.Permission = request.Permission;
            await collaboratorRepository.UpdateAsync(existing, cancellationToken);
            collaborator = existing;
        }
        else
        {
            collaborator = new DocumentCollaborator
            {
                DocumentId = request.DocumentId,
                UserId     = string.Empty, // vínculo é feito por e-mail (claim do JWT)
                UserEmail  = email,
                Permission = request.Permission,
                GrantedAt  = DateTime.UtcNow,
            };
            await collaboratorRepository.AddAsync(collaborator, cancellationToken);
        }

        // A lista em cache do colaborador é indexada por userId (desconhecido aqui): invalida todas.
        await cacheService.InvalidateAllAsync(cancellationToken);

        return new CollaboratorDto(
            collaborator.Id,
            collaborator.DocumentId,
            collaborator.UserId,
            collaborator.UserEmail,
            PermissionToString(collaborator.Permission),
            request.RequestingUserId,
            collaborator.GrantedAt
        );
    }

    private static string PermissionToString(Permission p) => p switch
    {
        Permission.Viewer => "read",
        Permission.Editor => "write",
        Permission.Owner  => "owner",
        _                 => "read"
    };
}
