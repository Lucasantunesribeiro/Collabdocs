using System.Diagnostics;
using System.Text.Json;
using CollabDocs.Application.Commands;
using CollabDocs.Application.DTOs;
using CollabDocs.Application.Interfaces;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Events;
using CollabDocs.Domain.Interfaces;
using CollabDocs.Domain.Outbox;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class CreateDocumentHandler(
    IDocumentRepository documentRepository,
    IUserRepository userRepository,
    IAuditService auditService,
    IOutboxRepository outboxRepository,
    IDocumentCacheService cacheService
) : IRequestHandler<CreateDocumentCommand, DocumentDto>
{
    public async Task<DocumentDto> Handle(CreateDocumentCommand request, CancellationToken cancellationToken)
    {
        using var activity = Telemetry.Source.StartActivity("CreateDocument");
        activity?.SetTag("document.owner_id", request.OwnerId);
        activity?.SetTag("document.visibility", request.Visibility.ToString());

        // Upsert user profile
        await userRepository.UpsertAsync(new User
        {
            Id = request.OwnerId,
            Email = request.OwnerEmail,
            Name = request.OwnerName,
            Provider = "oauth",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        }, cancellationToken);

        var document = Document.Create(
            request.OwnerId,
            request.Title,
            request.Content,
            request.Visibility
        );

        // Stage outbox message atomically with the document write
        var domainEvent = new DocumentCreatedEvent
        {
            DocumentId = document.Id,
            Title = document.Title,
            OwnerId = document.OwnerId
        };
        var outboxMessage = OutboxMessage.Create(
            domainEvent.EventType,
            JsonSerializer.Serialize(domainEvent),
            request.IdempotencyKey);
        await outboxRepository.AddAsync(outboxMessage, cancellationToken);

        // SaveChanges is called inside AddAsync — persists document + outbox message atomically
        await documentRepository.AddAsync(document, cancellationToken);
        await auditService.LogAsync(document.Id, request.OwnerId, "created");
        await cacheService.InvalidateUserAsync(request.OwnerId, cancellationToken);

        activity?.SetTag("document.id", document.Id);
        activity?.SetStatus(ActivityStatusCode.Ok);

        return ToDto(document, isOwner: true);
    }

    private static DocumentDto ToDto(Document d, bool isOwner) =>
        new(d.Id, d.OwnerId, d.Title, d.Content, d.Visibility.ToString().ToLower(),
            d.Version, d.CreatedAt, d.UpdatedAt, isOwner);
}
