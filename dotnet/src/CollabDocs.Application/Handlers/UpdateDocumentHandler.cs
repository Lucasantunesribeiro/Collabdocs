using System.Diagnostics;
using System.Text.Json;
using CollabDocs.Application.Authorization;
using CollabDocs.Application.Commands;
using CollabDocs.Application.DTOs;
using CollabDocs.Application.Interfaces;
using CollabDocs.Domain.Authorization;
using CollabDocs.Domain.Events;
using CollabDocs.Domain.Interfaces;
using CollabDocs.Domain.Outbox;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class UpdateDocumentHandler(
    IDocumentRepository documentRepository,
    IDocumentAuthorizationService authorization,
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

        // Cada campo alterado exige sua própria operação: conteúdo (EditContent),
        // título (Rename) e visibilidade (ChangeVisibility, somente dono).
        var operations = new List<DocumentOperation>();
        if (request.Content is not null) operations.Add(DocumentOperation.EditContent);
        if (request.Title is not null) operations.Add(DocumentOperation.Rename);
        if (request.Visibility is not null) operations.Add(DocumentOperation.ChangeVisibility);
        if (operations.Count == 0)
            throw new ArgumentException("Provide at least one field to update: content, title or visibility");

        var access = await authorization.AuthorizeAsync(
            request.DocumentId, request.UserId, request.UserEmail, operations, cancellationToken);
        var document = access.Document;

        if (request.ExpectedVersion.HasValue && document.Version != request.ExpectedVersion.Value)
            throw new DocumentVersionConflictException();

        var visibilityChanged = request.Visibility is not null && request.Visibility != document.Visibility;

        if (request.Content is not null || request.Title is not null)
            document.Update(request.Content, request.Title);
        if (request.Visibility is not null)
            document.ChangeVisibility(request.Visibility.Value);

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
            new
            {
                fields = new[]
                {
                    request.Content is not null ? "content" : null,
                    request.Title is not null ? "title" : null,
                    request.Visibility is not null ? "visibility" : null,
                }.Where(f => f != null)
            });

        // Mudança de visibilidade altera quem pode ver o documento: invalida as listas de todos.
        if (visibilityChanged)
            await cacheService.InvalidateAllAsync(cancellationToken);
        else
            await cacheService.InvalidateUserAsync(request.UserId, cancellationToken);

        activity?.SetTag("document.version", document.Version);
        activity?.SetStatus(ActivityStatusCode.Ok);

        return new DocumentDto(
            document.Id, document.OwnerId, document.Title, document.Content,
            document.Visibility.ToString().ToLower(), document.Version,
            document.CreatedAt, document.UpdatedAt,
            IsOwner: access.Role == DocumentRole.Owner,
            Permission: DocumentAccessPolicy.ToApiPermission(access.Role));
    }
}
