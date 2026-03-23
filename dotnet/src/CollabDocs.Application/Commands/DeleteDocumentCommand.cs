using MediatR;

namespace CollabDocs.Application.Commands;

public record DeleteDocumentCommand(Guid DocumentId, string UserId) : IRequest;
