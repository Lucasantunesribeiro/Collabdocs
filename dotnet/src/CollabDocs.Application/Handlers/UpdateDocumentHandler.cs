using CollabDocs.Application.Commands;
using CollabDocs.Application.DTOs;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class UpdateDocumentHandler(
    IDocumentRepository documentRepository,
    ICollaboratorRepository collaboratorRepository,
    IAuditService auditService
) : IRequestHandler<UpdateDocumentCommand, DocumentDto>
{
    public async Task<DocumentDto> Handle(UpdateDocumentCommand request, CancellationToken cancellationToken)
    {
        var document = await documentRepository.GetByIdAsync(request.DocumentId, cancellationToken)
            ?? throw new KeyNotFoundException($"Document {request.DocumentId} not found");

        var collaborators = await collaboratorRepository.GetByDocumentIdAsync(request.DocumentId, cancellationToken);

        if (!document.CanEdit(request.UserId, collaborators))
            throw new UnauthorizedAccessException("Edit permission denied");

        if (request.ExpectedVersion.HasValue && document.Version != request.ExpectedVersion.Value)
            throw new InvalidOperationException("Document was modified by another user");

        document.Update(request.Content, request.Title);
        await documentRepository.UpdateAsync(document, cancellationToken);
        await auditService.LogAsync(document.Id, request.UserId, "updated",
            new { fields = new[] { request.Content is not null ? "content" : null, request.Title is not null ? "title" : null }.Where(f => f != null) });

        return new DocumentDto(
            document.Id, document.OwnerId, document.Title, document.Content,
            document.Visibility.ToString().ToLower(), document.Version,
            document.CreatedAt, document.UpdatedAt,
            IsOwner: document.OwnerId == request.UserId);
    }
}
