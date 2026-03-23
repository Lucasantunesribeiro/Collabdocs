using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Interfaces;
using CollabDocs.Infrastructure.Data;

namespace CollabDocs.Infrastructure.Repositories;

public class UserRepository(AppDbContext context) : IUserRepository
{
    public async Task<User?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
        => await context.Users.FindAsync([id], cancellationToken);

    public async Task UpsertAsync(User user, CancellationToken cancellationToken = default)
    {
        var existing = await context.Users.FindAsync([user.Id], cancellationToken);
        if (existing is null)
            context.Users.Add(user);
        else
        {
            existing.Name = user.Name;
            existing.Email = user.Email;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        await context.SaveChangesAsync(cancellationToken);
    }
}
