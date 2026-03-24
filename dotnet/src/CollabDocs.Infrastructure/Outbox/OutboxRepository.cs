using CollabDocs.Domain.Interfaces;
using CollabDocs.Domain.Outbox;
using CollabDocs.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CollabDocs.Infrastructure.Outbox;

public class OutboxRepository(AppDbContext db) : IOutboxRepository
{
    public Task AddAsync(OutboxMessage message, CancellationToken ct = default)
    {
        db.OutboxMessages.Add(message);
        return Task.CompletedTask; // SaveChanges handled by caller for atomicity
    }

    public async Task<IReadOnlyList<OutboxMessage>> GetPendingAsync(int batchSize = 20, CancellationToken ct = default) =>
        await db.OutboxMessages
            .Where(m => m.ProcessedAt == null && m.RetryCount < 5)
            .OrderBy(m => m.CreatedAt)
            .Take(batchSize)
            .ToListAsync(ct);

    public async Task MarkProcessedAsync(Guid id, CancellationToken ct = default)
    {
        var msg = await db.OutboxMessages.FindAsync([id], ct);
        msg?.MarkProcessed();
        await db.SaveChangesAsync(ct);
    }

    public async Task MarkFailedAsync(Guid id, string error, CancellationToken ct = default)
    {
        var msg = await db.OutboxMessages.FindAsync([id], ct);
        msg?.MarkFailed(error);
        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> ExistsAsync(string idempotencyKey, CancellationToken ct = default) =>
        await db.OutboxMessages.AnyAsync(
            m => m.IdempotencyKey == idempotencyKey && m.CreatedAt > DateTime.UtcNow.AddHours(-24),
            ct);
}
