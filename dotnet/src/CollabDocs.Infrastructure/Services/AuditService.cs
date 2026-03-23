using System.Text.Json;
using CollabDocs.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace CollabDocs.Infrastructure.Services;

public class AuditService(ILogger<AuditService> logger) : IAuditService
{
    public Task LogAsync(Guid documentId, string userId, string action, object? metadata = null)
    {
        logger.LogInformation(
            "AUDIT documentId={DocumentId} userId={UserId} action={Action} metadata={Metadata}",
            documentId, userId, action,
            metadata is not null ? JsonSerializer.Serialize(metadata) : "{}");
        return Task.CompletedTask;
    }
}
