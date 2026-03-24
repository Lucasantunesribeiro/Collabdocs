using System.Diagnostics;
using System.Text.Json;
using CollabDocs.Application.Commands;
using CollabDocs.Application.DTOs;
using CollabDocs.Application.Interfaces;
using CollabDocs.Domain.Events;
using CollabDocs.Domain.Interfaces;
using CollabDocs.Domain.Outbox;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class UpdateDocumentHandler(
    IDocumentRepository documentRepository,
    ICollaboratorRepository collaboratorRepository,
    IAuditService auditService,
    IOutboxRepository outboxRepository,
    IDocumentCacheService cacheService
) : IRequestHandler<UpdateDocumentCommand, DocumentDto>
{
    public async Task<DocumentDto> Handle(UpdateDocumentCommand request, CancellationToken cancellationToken)
    {
        using var activity = Telemetry.Source.StartActivity("UpdateDocument");
        activity?.SetTag("document.id", request.DocumentId);
        activity?.SetTag("document.user_id", request.UserId);

        var document = await documentRepository.GetByIdAsync(request.DocumentId, cancellationToken)
            ?? throw new KeyNotFoundException($"Document {request.DocumentId} not found");

        var collaborators = await collaboratorRepository.GetByDocumentIdAsync(request.DocumentId, cancellationToken);

        if (!document.CanEdit(request.UserId, collaborators))
            throw new UnauthorizedAccessException("Edit permission denied");

        if (request.ExpectedVersion.HasValue && document.Version != request.ExpectedVersion.Value)
            throw new InvalidOperationException("Document was modified by another user");

        document.Update(request.Content, request.Title);

        // Stage outbox message atomically with the document write
        var domainEvent = new DocumentUpdatedEvent
        {
            DocumentId = document.Id,
            Title = document.Title,
            UpdatedBy = request.UserId,
            Version = document.Version
        };
        var outboxMessage = OutboxMessage.Create(
            domainEvent.EventType,
            JsonSerializer.Serialize(domainEvent),
            request.IdempotencyKey);
        await outboxRepository.AddAsync(outboxMessage, cancellationToken);

        // SaveChanges inside UpdateAsync commits both document change and outbox message
        await documentRepository.UpdateAsync(document, cancellationToken);
        await auditService.LogAsync(document.Id, request.UserId, "updated",
            new { fields = new[] { request.Content is not null ? "content" : null, request.Title is not null ? "title" : null }.Where(f => f != null) });
        await cacheService.InvalidateUserAsync(request.UserId, cancellationToken);

        activity?.SetTag("document.version", document.Version);
        activity?.SetStatus(ActivityStatusCode.Ok);

        return new DocumentDto(
            document.Id, document.OwnerId, document.Title, document.Content,
            document.Visibility.ToString().ToLower(), document.Version,
            document.CreatedAt, document.UpdatedAt,
            IsOwner: document.OwnerId == request.UserId);
    }
}
