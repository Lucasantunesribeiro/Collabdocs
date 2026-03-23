namespace CollabDocs.Application.DTOs;

public record UpdateDocumentRequest(
    string? Content,
    string? Title,
    int? ExpectedVersion
);
