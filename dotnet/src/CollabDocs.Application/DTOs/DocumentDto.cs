using System.Text.Json.Serialization;

namespace CollabDocs.Application.DTOs;

public record DocumentDto(
    Guid Id,
    [property: JsonPropertyName("owner_id")] string OwnerId,
    string Title,
    string Content,
    string Visibility,
    int Version,
    [property: JsonPropertyName("created_at")] DateTime CreatedAt,
    [property: JsonPropertyName("updated_at")] DateTime UpdatedAt,
    [property: JsonPropertyName("is_owner")] bool IsOwner = false,
    [property: JsonPropertyName("owner_name")] string? OwnerName = null
);
