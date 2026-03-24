using CollabDocs.Application.DTOs;

namespace CollabDocs.Application.Interfaces;

public interface IDocumentCacheService
{
    Task<List<DocumentDto>?> GetDocumentsAsync(string userId, CancellationToken ct = default);
    Task SetDocumentsAsync(string userId, List<DocumentDto> documents, CancellationToken ct = default);
    Task InvalidateUserAsync(string userId, CancellationToken ct = default);
}
