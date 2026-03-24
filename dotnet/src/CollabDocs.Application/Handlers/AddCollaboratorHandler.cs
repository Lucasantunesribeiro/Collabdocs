using CollabDocs.Application.Commands;
using CollabDocs.Application.DTOs;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class AddCollaboratorHandler(
    IDocumentRepository documentRepository,
    ICollaboratorRepository collaboratorRepository
) : IRequestHandler<AddCollaboratorCommand, CollaboratorDto>
{
    public async Task<CollaboratorDto> Handle(AddCollaboratorCommand request, CancellationToken cancellationToken)
    {
        var document = await documentRepository.GetByIdAsync(request.DocumentId, cancellationToken)
            ?? throw new KeyNotFoundException($"Document {request.DocumentId} not found");

        if (document.OwnerId != request.RequestingUserId)
            throw new UnauthorizedAccessException("Only the document owner can manage collaborators");

        var collaborator = new DocumentCollaborator
        {
            DocumentId = request.DocumentId,
            UserId     = string.Empty, // resolved when the collaborator logs in
            UserEmail  = request.CollaboratorEmail,
            Permission = request.Permission,
            GrantedAt  = DateTime.UtcNow,
        };

        await collaboratorRepository.AddAsync(collaborator, cancellationToken);

        return new CollaboratorDto(
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
