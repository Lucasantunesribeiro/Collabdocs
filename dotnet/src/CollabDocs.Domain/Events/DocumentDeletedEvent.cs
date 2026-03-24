namespace CollabDocs.Domain.Events;

public record DocumentDeletedEvent : IDomainEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();
    public DateTime OccurredAt { get; init; } = DateTime.UtcNow;
    public string EventType => "document.deleted";
    public required Guid DocumentId { get; init; }
    public required string Title { get; init; }
    public required string OwnerId { get; init; }
    public required string DeletedBy { get; init; }
}
