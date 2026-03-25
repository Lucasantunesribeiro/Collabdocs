using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;
using CollabDocs.Domain.Interfaces;
using CollabDocs.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CollabDocs.Infrastructure.Repositories;

public class DocumentRepository(AppDbContext context) : IDocumentRepository
{
    public async Task<Document?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await context.Documents.FindAsync([id], cancellationToken);

    public async Task<IReadOnlyList<Document>> GetByOwnerOrCollaboratorAsync(
        string userId, string userEmail, CancellationToken cancellationToken = default)
    {
        return await context.Documents
            .Where(d => d.Visibility == Visibility.Public ||
                        d.OwnerId == userId ||
                        context.DocumentCollaborators.Any(dc =>
                            dc.DocumentId == d.Id &&
                            (dc.UserId == userId || dc.UserEmail == userEmail)))
            .OrderByDescending(d => d.UpdatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(Document document, CancellationToken cancellationToken = default)
    {
        context.Documents.Add(document);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(Document document, CancellationToken cancellationToken = default)
    {
        context.Documents.Update(document);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var doc = await context.Documents.FindAsync([id], cancellationToken);
        if (doc is not null)
        {
            context.Documents.Remove(doc);
            await context.SaveChangesAsync(cancellationToken);
        }
    }
}
