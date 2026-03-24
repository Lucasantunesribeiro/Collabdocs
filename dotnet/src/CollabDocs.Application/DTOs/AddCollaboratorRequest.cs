using System.ComponentModel.DataAnnotations;

namespace CollabDocs.Application.DTOs;

public record AddCollaboratorRequest(
    [Required][EmailAddress] string Email,
    /// <summary>Accepted values: "read", "write". Defaults to "read".</summary>
    string Permission = "read"
);
