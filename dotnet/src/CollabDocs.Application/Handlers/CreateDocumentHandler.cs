using CollabDocs.Application.Commands;
using CollabDocs.Application.DTOs;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class CreateDocumentHandler(
    IDocumentRepository documentRepository,
    IUserRepository userRepository,
    IAuditService auditService
) : IRequestHandler<CreateDocumentCommand, DocumentDto>
{
    public async Task<DocumentDto> Handle(CreateDocumentCommand request, CancellationToken cancellationToken)
    {
        // Upsert user profile
        await userRepository.UpsertAsync(new User
        {
            Id = request.OwnerId,
            Email = request.OwnerEmail,
            Name = request.OwnerName,
            Provider = "oauth",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        }, cancellationToken);

        var document = Document.Create(
            request.OwnerId,
            request.Title,
            request.Content,
            request.Visibility
        );

        await documentRepository.AddAsync(document, cancellationToken);
        await auditService.LogAsync(document.Id, request.OwnerId, "created");

        return ToDto(document, isOwner: true);
    }

    private static DocumentDto ToDto(Document d, bool isOwner) =>
        new(d.Id, d.OwnerId, d.Title, d.Content, d.Visibility.ToString().ToLower(),
            d.Version, d.CreatedAt, d.UpdatedAt, isOwner);
}
