using CollabDocs.Application.Authorization;
using CollabDocs.Application.DTOs;
using CollabDocs.Application.Queries;
using CollabDocs.Domain.Authorization;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class GetDocumentByIdHandler(
    IDocumentAuthorizationService authorization,
    IUserRepository userRepository
) : IRequestHandler<GetDocumentByIdQuery, DocumentDto>
{
    public async Task<DocumentDto> Handle(GetDocumentByIdQuery request, CancellationToken cancellationToken)
    {
        var access = await authorization.AuthorizeAsync(
            request.DocumentId, request.UserId, request.UserEmail, DocumentOperation.Read, cancellationToken);
        var document = access.Document;

        var owner = await userRepository.GetByIdAsync(document.OwnerId, cancellationToken);

        return new DocumentDto(
            document.Id, document.OwnerId, document.Title, document.Content,
            document.Visibility.ToString().ToLower(), document.Version,
            document.CreatedAt, document.UpdatedAt,
            IsOwner: access.Role == DocumentRole.Owner,
            OwnerName: owner?.Name,
            Permission: DocumentAccessPolicy.ToApiPermission(access.Role));
    }
}
