namespace CollabDocs.Domain.Interfaces;

public interface IAuditService
{
    Task LogAsync(Guid documentId, string userId, string action, object? metadata = null);
}
