namespace CollabDocs.Domain.Outbox;

public class OutboxMessage
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string EventType { get; private set; } = string.Empty;
    public string Payload { get; private set; } = string.Empty;
    public string? IdempotencyKey { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; private set; }
    public int RetryCount { get; private set; }
    public string? Error { get; private set; }

    private OutboxMessage() { }

    public static OutboxMessage Create(string eventType, string payload, string? idempotencyKey = null) =>
        new() { EventType = eventType, Payload = payload, IdempotencyKey = idempotencyKey };

    public void MarkProcessed() => ProcessedAt = DateTime.UtcNow;

    public void MarkFailed(string error)
    {
        RetryCount++;
        Error = error;
    }
}
