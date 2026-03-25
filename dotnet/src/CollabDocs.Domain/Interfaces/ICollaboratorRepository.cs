using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;

namespace CollabDocs.Domain.Interfaces;

public interface ICollaboratorRepository
{
    Task<IReadOnlyList<DocumentCollaborator>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task AddAsync(DocumentCollaborator collaborator, CancellationToken cancellationToken = default);
    Task RemoveAsync(Guid documentId, string userEmail, CancellationToken cancellationToken = default);
    /// <summary>Stages removal of all collaborators for a document. SaveChanges must be called by the caller.</summary>
    Task DeleteByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default);
}
