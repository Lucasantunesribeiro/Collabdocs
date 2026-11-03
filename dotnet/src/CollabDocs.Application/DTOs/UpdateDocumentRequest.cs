namespace CollabDocs.Application.DTOs;

public record UpdateDocumentRequest(
    string? Content,
    string? Title,
    int? ExpectedVersion,
    /// <summary>"public" | "private". Somente o dono pode alterar.</summary>
    string? Visibility = null
);
