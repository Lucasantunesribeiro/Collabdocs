using CollabDocs.Application.DTOs;
using MediatR;

namespace CollabDocs.Application.Queries;

public record GetCollaboratorsQuery(Guid DocumentId, string RequestingUserId, string RequestingUserEmail)
    : IRequest<List<CollaboratorDto>>;
