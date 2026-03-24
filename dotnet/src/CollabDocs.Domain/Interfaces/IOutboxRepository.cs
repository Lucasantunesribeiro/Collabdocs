using CollabDocs.Domain.Outbox;

namespace CollabDocs.Domain.Interfaces;

public interface IOutboxRepository
{
    Task AddAsync(OutboxMessage message, CancellationToken ct = default);
    Task<IReadOnlyList<OutboxMessage>> GetPendingAsync(int batchSize = 20, CancellationToken ct = default);
    Task MarkProcessedAsync(Guid id, CancellationToken ct = default);
    Task MarkFailedAsync(Guid id, string error, CancellationToken ct = default);
    Task<bool> ExistsAsync(string idempotencyKey, CancellationToken ct = default);
}
