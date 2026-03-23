using CollabDocs.Application.DTOs;
using MediatR;

namespace CollabDocs.Application.Queries;

public record GetDocumentsQuery(string UserId, string UserEmail) : IRequest<List<DocumentDto>>;
