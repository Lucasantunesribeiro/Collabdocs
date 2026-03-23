using CollabDocs.Application.Commands;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class DeleteDocumentHandler(
    IDocumentRepository documentRepository,
    IAuditService auditService
) : IRequestHandler<DeleteDocumentCommand>
{
    public async Task Handle(DeleteDocumentCommand request, CancellationToken cancellationToken)
    {
        var document = await documentRepository.GetByIdAsync(request.DocumentId, cancellationToken)
            ?? throw new KeyNotFoundException($"Document {request.DocumentId} not found");

        if (document.OwnerId != request.UserId)
            throw new UnauthorizedAccessException("Only the owner can delete this document");

        await documentRepository.DeleteAsync(request.DocumentId, cancellationToken);
        await auditService.LogAsync(request.DocumentId, request.UserId, "deleted");
    }
}
