using CollabDocs.Application.DTOs;
using MediatR;

namespace CollabDocs.Application.Commands;

public record UpdateDocumentCommand(
    Guid DocumentId,
    string UserId,
    string? Content,
    string? Title,
    int? ExpectedVersion,
    string? IdempotencyKey = null
) : IRequest<DocumentDto>;
