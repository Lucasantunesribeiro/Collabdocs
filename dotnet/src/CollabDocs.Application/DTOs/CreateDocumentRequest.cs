using System.ComponentModel.DataAnnotations;

namespace CollabDocs.Application.DTOs;

public record CreateDocumentRequest(
    [Required][StringLength(255, MinimumLength = 1)] string Title,
    string? Content,
    string Visibility = "public"
);
