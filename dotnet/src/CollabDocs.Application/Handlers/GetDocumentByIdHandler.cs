using CollabDocs.Application.DTOs;
using CollabDocs.Application.Queries;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class GetDocumentByIdHandler(
    IDocumentRepository documentRepository,
    ICollaboratorRepository collaboratorRepository
) : IRequestHandler<GetDocumentByIdQuery, DocumentDto>
{
    public async Task<DocumentDto> Handle(GetDocumentByIdQuery request, CancellationToken cancellationToken)
    {
        var document = await documentRepository.GetByIdAsync(request.DocumentId, cancellationToken)
            ?? throw new KeyNotFoundException($"Document {request.DocumentId} not found");

        var collaborators = await collaboratorRepository.GetByDocumentIdAsync(request.DocumentId, cancellationToken);

        if (!document.CanView(request.UserId, collaborators))
            throw new UnauthorizedAccessException("Access denied");

        return new DocumentDto(
            document.Id, document.OwnerId, document.Title, document.Content,
            document.Visibility.ToString().ToLower(), document.Version,
            document.CreatedAt, document.UpdatedAt,
            IsOwner: document.OwnerId == request.UserId);
    }
}
