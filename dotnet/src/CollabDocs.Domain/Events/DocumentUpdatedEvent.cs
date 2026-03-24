namespace CollabDocs.Domain.Events;

public record DocumentUpdatedEvent : IDomainEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();
    public DateTime OccurredAt { get; init; } = DateTime.UtcNow;
    public string EventType => "document.updated";
    public required Guid DocumentId { get; init; }
    public required string Title { get; init; }
    public required string UpdatedBy { get; init; }
    public required int Version { get; init; }
}
