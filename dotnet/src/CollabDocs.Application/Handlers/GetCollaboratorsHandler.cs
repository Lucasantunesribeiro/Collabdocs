using CollabDocs.Application.DTOs;
using CollabDocs.Application.Queries;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class GetCollaboratorsHandler(
    IDocumentRepository documentRepository,
    ICollaboratorRepository collaboratorRepository
) : IRequestHandler<GetCollaboratorsQuery, List<CollaboratorDto>>
{
    public async Task<List<CollaboratorDto>> Handle(GetCollaboratorsQuery request, CancellationToken cancellationToken)
    {
        var document = await documentRepository.GetByIdAsync(request.DocumentId, cancellationToken)
            ?? throw new KeyNotFoundException($"Document {request.DocumentId} not found");

        // Only owner or existing collaborators may list collaborators
        var isOwner = document.OwnerId == request.RequestingUserId;
        if (!isOwner)
        {
            var collaborators = await collaboratorRepository.GetByDocumentIdAsync(request.DocumentId, cancellationToken);
            var isCollaborator = collaborators.Any(c =>
                c.UserId == request.RequestingUserId ||
                c.UserEmail.Equals(request.RequestingUserEmail, StringComparison.OrdinalIgnoreCase));
            if (!isCollaborator)
                throw new UnauthorizedAccessException("Access denied");
        }

        var list = await collaboratorRepository.GetByDocumentIdAsync(request.DocumentId, cancellationToken);
        return list.Select(ToDto).ToList();
    }

    private static CollaboratorDto ToDto(DocumentCollaborator c) => new(
        c.DocumentId,
        c.UserId,
        c.UserEmail,
        PermissionToString(c.Permission),
        c.UserId,
        c.GrantedAt
    );

    private static string PermissionToString(Permission p) => p switch
    {
        Permission.Viewer => "read",
        Permission.Editor => "write",
        Permission.Owner  => "owner",
        _                 => "read"
    };
}
