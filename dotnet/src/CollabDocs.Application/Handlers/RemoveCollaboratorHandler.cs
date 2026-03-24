using CollabDocs.Application.Commands;
using CollabDocs.Domain.Interfaces;
using MediatR;

namespace CollabDocs.Application.Handlers;

public class RemoveCollaboratorHandler(
    IDocumentRepository documentRepository,
    ICollaboratorRepository collaboratorRepository
) : IRequestHandler<RemoveCollaboratorCommand>
{
    public async Task Handle(RemoveCollaboratorCommand request, CancellationToken cancellationToken)
    {
        var document = await documentRepository.GetByIdAsync(request.DocumentId, cancellationToken)
            ?? throw new KeyNotFoundException($"Document {request.DocumentId} not found");

        if (document.OwnerId != request.RequestingUserId)
            throw new UnauthorizedAccessException("Only the document owner can manage collaborators");

        await collaboratorRepository.RemoveAsync(request.DocumentId, request.CollaboratorEmail, cancellationToken);
    }
}
