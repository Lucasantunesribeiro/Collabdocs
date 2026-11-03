using CollabDocs.Application.Authorization;
using CollabDocs.Application.DTOs;
using CollabDocs.Application.Queries;
using CollabDocs.Domain.Authorization;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class GetCollaboratorsHandler(
    IDocumentAuthorizationService authorization
) : IRequestHandler<GetCollaboratorsQuery, List<CollaboratorDto>>
{
    public async Task<List<CollaboratorDto>> Handle(GetCollaboratorsQuery request, CancellationToken cancellationToken)
    {
        // Sem leitura => 404. Leitor de documento público (não colaborador) recebe lista vazia
        // para que o editor carregue sem expor e-mails dos colaboradores.
        var access = await authorization.AuthorizeAsync(
            request.DocumentId, request.RequestingUserId, request.RequestingUserEmail,
            DocumentOperation.Read, cancellationToken);

        if (!access.Can(DocumentOperation.ListCollaborators))
            return [];

        return access.Collaborators.Select(ToDto).ToList();
    }

    private static CollaboratorDto ToDto(DocumentCollaborator c) => new(
        c.Id,
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
