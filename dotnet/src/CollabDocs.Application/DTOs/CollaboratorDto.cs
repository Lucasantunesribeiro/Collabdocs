namespace CollabDocs.Application.DTOs;

public record CollaboratorDto(
    Guid DocumentId,
    string UserId,
    string UserEmail,
    /// <summary>Normalized permission string: "read", "write", or "owner".</summary>
    string Permission,
    string GrantedBy,
    DateTime GrantedAt
);
