using System.ComponentModel.DataAnnotations;

namespace CollabDocs.Application.DTOs;

public record RemoveCollaboratorRequest(
    [Required][EmailAddress] string Email
);
