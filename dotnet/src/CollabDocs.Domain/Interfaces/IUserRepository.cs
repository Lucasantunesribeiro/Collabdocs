using CollabDocs.Domain.Entities;

namespace CollabDocs.Domain.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<Dictionary<string, User>> GetByIdsAsync(IEnumerable<string> ids, CancellationToken cancellationToken = default);
    Task UpsertAsync(User user, CancellationToken cancellationToken = default);
}
