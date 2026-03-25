using System.Text.Json.Serialization;

namespace CollabDocs.Application.DTOs;

public record CollaboratorDto(
    [property: JsonPropertyName("id")]          Guid Id,
    [property: JsonPropertyName("document_id")] Guid DocumentId,
    [property: JsonPropertyName("user_id")]     string UserId,
    [property: JsonPropertyName("user_email")]  string UserEmail,
    /// <summary>Normalized permission string: "read", "write", or "owner".</summary>
    string Permission,
    [property: JsonPropertyName("added_by")]    string AddedBy,
    [property: JsonPropertyName("created_at")]  DateTime CreatedAt
);
