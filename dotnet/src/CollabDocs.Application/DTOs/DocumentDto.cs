namespace CollabDocs.Application.DTOs;

public record DocumentDto(
    Guid Id,
    string OwnerId,
    string Title,
    string Content,
    string Visibility,
    int Version,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool IsOwner = false,
    string? OwnerName = null
);
