using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;

namespace CollabDocs.Domain.Interfaces;

public interface ICollaboratorRepository
{
    Task<IReadOnlyList<DocumentCollaborator>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task AddAsync(DocumentCollaborator collaborator, CancellationToken cancellationToken = default);
    Task RemoveAsync(Guid documentId, string userEmail, CancellationToken cancellationToken = default);
}
