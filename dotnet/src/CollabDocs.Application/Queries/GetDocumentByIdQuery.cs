using CollabDocs.Application.DTOs;
using MediatR;

namespace CollabDocs.Application.Queries;

public record GetDocumentByIdQuery(Guid DocumentId, string UserId, string UserEmail) : IRequest<DocumentDto>;
