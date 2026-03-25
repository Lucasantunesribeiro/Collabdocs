using CollabDocs.Domain.Enums;

namespace CollabDocs.Domain.Entities;

public class DocumentCollaborator
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DocumentId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public Permission Permission { get; set; }
    public DateTime GrantedAt { get; set; }
}
