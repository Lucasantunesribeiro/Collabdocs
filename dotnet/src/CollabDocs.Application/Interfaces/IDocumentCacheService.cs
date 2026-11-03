using CollabDocs.Application.DTOs;

namespace CollabDocs.Application.Interfaces;

public interface IDocumentCacheService
{
    Task<List<DocumentDto>?> GetDocumentsAsync(string userId, CancellationToken ct = default);
    Task SetDocumentsAsync(string userId, List<DocumentDto> documents, CancellationToken ct = default);
    Task InvalidateUserAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Invalida as listas em cache de todos os usuários. Usado quando muda quem pode ver
    /// um documento (colaborador adicionado/removido, visibilidade alterada, exclusão).
    /// </summary>
    Task InvalidateAllAsync(CancellationToken ct = default);
}
