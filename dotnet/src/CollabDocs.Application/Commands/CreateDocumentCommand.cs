using CollabDocs.Application.DTOs;
using CollabDocs.Domain.Enums;
using MediatR;

namespace CollabDocs.Application.Commands;

public record CreateDocumentCommand(
    string OwnerId,
    string OwnerEmail,
    string OwnerName,
    string Title,
    string Content,
    Visibility Visibility
) : IRequest<DocumentDto>;
