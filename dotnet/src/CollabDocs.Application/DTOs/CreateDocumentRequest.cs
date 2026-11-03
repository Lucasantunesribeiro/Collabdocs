using System.ComponentModel.DataAnnotations;

namespace CollabDocs.Application.DTOs;

public record CreateDocumentRequest(
    [Required][StringLength(255, MinimumLength = 1)] string Title,
    string? Content,
    /// <summary>"public" | "private". Padrão: "private".</summary>
    string Visibility = "private"
);
