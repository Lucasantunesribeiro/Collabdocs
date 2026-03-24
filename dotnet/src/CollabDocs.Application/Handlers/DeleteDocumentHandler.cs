using System.Text.Json;
using CollabDocs.Application.Commands;
using CollabDocs.Domain.Events;
using CollabDocs.Domain.Interfaces;
using CollabDocs.Domain.Outbox;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class DeleteDocumentHandler(
    IDocumentRepository documentRepository,
    IAuditService auditService,
    IOutboxRepository outboxRepository
) : IRequestHandler<DeleteDocumentCommand>
{
    public async Task Handle(DeleteDocumentCommand request, CancellationToken cancellationToken)
    {
        var document = await documentRepository.GetByIdAsync(request.DocumentId, cancellationToken)
            ?? throw new KeyNotFoundException($"Document {request.DocumentId} not found");

        if (document.OwnerId != request.UserId)
            throw new UnauthorizedAccessException("Only the owner can delete this document");

        // Stage outbox message atomically with the delete
        var domainEvent = new DocumentDeletedEvent
        {
            DocumentId = document.Id,
            Title = document.Title,
            OwnerId = document.OwnerId,
            DeletedBy = request.UserId
        };
        var outboxMessage = OutboxMessage.Create(
            domainEvent.EventType,
            JsonSerializer.Serialize(domainEvent),
            request.IdempotencyKey);
        await outboxRepository.AddAsync(outboxMessage, cancellationToken);

        // SaveChanges inside DeleteAsync commits both the deletion and the outbox message
        await documentRepository.DeleteAsync(request.DocumentId, cancellationToken);
        await auditService.LogAsync(request.DocumentId, request.UserId, "deleted");
    }
}
