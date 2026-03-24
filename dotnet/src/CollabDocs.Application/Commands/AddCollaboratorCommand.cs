using CollabDocs.Application.DTOs;
using CollabDocs.Domain.Enums;
using MediatR;

namespace CollabDocs.Application.Commands;

public record AddCollaboratorCommand(
    Guid DocumentId,
    string RequestingUserId,
    string CollaboratorEmail,
    Permission Permission
) : IRequest<CollaboratorDto>;
