using CollabDocs.Application.DTOs;
using CollabDocs.Domain.Enums;
using MediatR;

namespace CollabDocs.Application.Commands;

public record UpdateDocumentCommand(
    Guid DocumentId,
    string UserId,
    string? Content,
    string? Title,
    int? ExpectedVersion,
    string? IdempotencyKey = null,
    string? UserEmail = null,
    Visibility? Visibility = null
) : IRequest<DocumentDto>;
