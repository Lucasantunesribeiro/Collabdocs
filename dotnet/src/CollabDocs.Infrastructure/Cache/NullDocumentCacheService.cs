using CollabDocs.Application.DTOs;
using CollabDocs.Application.Interfaces;

namespace CollabDocs.Infrastructure.Cache;

public class NullDocumentCacheService : IDocumentCacheService
{
    public Task<List<DocumentDto>?> GetDocumentsAsync(string userId, CancellationToken ct = default)
        => Task.FromResult<List<DocumentDto>?>(null);

    public Task SetDocumentsAsync(string userId, List<DocumentDto> documents, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task InvalidateUserAsync(string userId, CancellationToken ct = default)
        => Task.CompletedTask;
}
