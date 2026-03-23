using CollabDocs.Application.DTOs;
using CollabDocs.Application.Queries;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class GetDocumentsHandler(IDocumentRepository documentRepository)
    : IRequestHandler<GetDocumentsQuery, List<DocumentDto>>
{
    public async Task<List<DocumentDto>> Handle(GetDocumentsQuery request, CancellationToken cancellationToken)
    {
        var documents = await documentRepository.GetByOwnerOrCollaboratorAsync(
            request.UserId, request.UserEmail, cancellationToken);

        return documents
            .Select(d => new DocumentDto(
                d.Id, d.OwnerId, d.Title, d.Content,
                d.Visibility.ToString().ToLower(), d.Version,
                d.CreatedAt, d.UpdatedAt,
                IsOwner: d.OwnerId == request.UserId))
            .ToList();
    }
}
