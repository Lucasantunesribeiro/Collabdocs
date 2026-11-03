using System.Text.Json;
using CollabDocs.Application.Authorization;
using CollabDocs.Application.Commands;
using CollabDocs.Application.Interfaces;
using CollabDocs.Domain.Authorization;
using CollabDocs.Domain.Events;
using CollabDocs.Domain.Interfaces;
using CollabDocs.Domain.Outbox;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class DeleteDocumentHandler(
    IDocumentRepository documentRepository,
    ICollaboratorRepository collaboratorRepository,
    IDocumentAuthorizationService authorization,
    IAuditService auditService,
    IOutboxRepository outboxRepository,
    IDocumentCacheService cacheService
) : IRequestHandler<DeleteDocumentCommand>
{
    public async Task Handle(DeleteDocumentCommand request, CancellationToken cancellationToken)
    {
        var access = await authorization.AuthorizeAsync(
            request.DocumentId, request.UserId, request.UserEmail, DocumentOperation.Delete, cancellationToken);
        var document = access.Document;

        // Stage outbox message, collaborator removals, and document deletion —
        // all committed atomically by SaveChanges inside DeleteAsync
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
        await collaboratorRepository.DeleteByDocumentIdAsync(request.DocumentId, cancellationToken);

        await documentRepository.DeleteAsync(request.DocumentId, cancellationToken);
        await auditService.LogAsync(request.DocumentId, request.UserId, "deleted");
        // Colaboradores e leitores de documento público também tinham o documento em cache.
        await cacheService.InvalidateAllAsync(cancellationToken);
    }
}
