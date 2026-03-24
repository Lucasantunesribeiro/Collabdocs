using MediatR;

namespace CollabDocs.Application.Commands;

public record RemoveCollaboratorCommand(
    Guid DocumentId,
    string RequestingUserId,
    string CollaboratorEmail
) : IRequest;
