using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Interfaces;
using CollabDocs.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CollabDocs.Infrastructure.Repositories;

public class CollaboratorRepository(AppDbContext context) : ICollaboratorRepository
{
    public async Task<IReadOnlyList<DocumentCollaborator>> GetByDocumentIdAsync(
        Guid documentId, CancellationToken cancellationToken = default)
        => await context.DocumentCollaborators
            .Where(dc => dc.DocumentId == documentId)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(DocumentCollaborator collaborator, CancellationToken cancellationToken = default)
    {
        context.DocumentCollaborators.Add(collaborator);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveAsync(Guid documentId, string userEmail, CancellationToken cancellationToken = default)
    {
        var collab = await context.DocumentCollaborators
            .FirstOrDefaultAsync(dc => dc.DocumentId == documentId && dc.UserEmail == userEmail, cancellationToken);
        if (collab is not null)
        {
            context.DocumentCollaborators.Remove(collab);
            await context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task DeleteByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var collabs = await context.DocumentCollaborators
            .Where(dc => dc.DocumentId == documentId)
            .ToListAsync(cancellationToken);
        if (collabs.Count > 0)
            context.DocumentCollaborators.RemoveRange(collabs);
        // No SaveChangesAsync — caller commits atomically with the document deletion
    }
}
