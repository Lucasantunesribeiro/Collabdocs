using CollabDocs.Application.DTOs;
using CollabDocs.Application.Interfaces;
using CollabDocs.Application.Queries;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class GetDocumentsHandler(
    IDocumentRepository documentRepository,
    IDocumentCacheService cacheService
) : IRequestHandler<GetDocumentsQuery, List<DocumentDto>>
{
    public async Task<List<DocumentDto>> Handle(GetDocumentsQuery request, CancellationToken cancellationToken)
    {
        var cached = await cacheService.GetDocumentsAsync(request.UserId, cancellationToken);
        if (cached is not null)
            return cached;

        var documents = await documentRepository.GetByOwnerOrCollaboratorAsync(
            request.UserId, request.UserEmail, cancellationToken);

        var result = documents
            .Select(d => new DocumentDto(
                d.Id, d.OwnerId, d.Title, d.Content,
                d.Visibility.ToString().ToLower(), d.Version,
                d.CreatedAt, d.UpdatedAt,
                IsOwner: d.OwnerId == request.UserId))
            .ToList();

        await cacheService.SetDocumentsAsync(request.UserId, result, cancellationToken);

        return result;
    }
}
