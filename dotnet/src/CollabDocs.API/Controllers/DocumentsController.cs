using CollabDocs.Application.Commands;
using CollabDocs.Application.DTOs;
using CollabDocs.Application.Queries;
using CollabDocs.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CollabDocs.API.Controllers;

/// <summary>
/// CRUD de documentos. Toda decisão de acesso é feita no handler via
/// IDocumentAuthorizationService; o mapeamento exceção => status HTTP fica em
/// DocumentExceptionFilter (404 sem acesso, 403 operação negada, 409 conflito).
/// </summary>
[Authorize]
[ApiController]
[Route("api/documents")]
public class DocumentsController(ISender sender) : ControllerBase
{
    private string UserId => User.FindFirst("sub")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? throw new UnauthorizedAccessException("User ID not found in token");

    private string UserEmail => User.FindFirst("email")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
        ?? string.Empty;

    private string UserName => User.FindFirst("name")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
        ?? "User";

    [HttpGet]
    [ProducesResponseType(typeof(List<DocumentDto>), 200)]
    public async Task<IActionResult> GetDocuments(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetDocumentsQuery(UserId, UserEmail), cancellationToken);
        return Ok(new { documents = result, count = result.Count });
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(DocumentDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetDocument(Guid id, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetDocumentByIdQuery(id, UserId, UserEmail), cancellationToken);
        return Ok(new { document = result });
    }

    [HttpPost]
    [ProducesResponseType(typeof(DocumentDto), 201)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> CreateDocument([FromBody] CreateDocumentRequest request, CancellationToken cancellationToken)
    {
        // Privado por padrão: só vira público com visibility == "public" explícito.
        var visibility = ParseVisibility(request.Visibility) ?? Visibility.Private;
        var result = await sender.Send(
            new CreateDocumentCommand(UserId, UserEmail, UserName, request.Title,
                request.Content ?? $"# {request.Title}\n\nStart writing...", visibility),
            cancellationToken);
        return CreatedAtAction(nameof(GetDocument), new { id = result.Id }, new { document = result });
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(DocumentDto), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(403)]
    [ProducesResponseType(404)]
    [ProducesResponseType(409)]
    public async Task<IActionResult> UpdateDocument(Guid id, [FromBody] UpdateDocumentRequest request, CancellationToken cancellationToken)
    {
        Visibility? visibility = null;
        if (request.Visibility is not null)
        {
            visibility = ParseVisibility(request.Visibility)
                ?? throw new ArgumentException("visibility must be 'public' or 'private'");
        }

        var result = await sender.Send(
            new UpdateDocumentCommand(id, UserId, request.Content, request.Title, request.ExpectedVersion,
                UserEmail: UserEmail, Visibility: visibility),
            cancellationToken);
        return Ok(new { document = result });
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(204)]
    [ProducesResponseType(403)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> DeleteDocument(Guid id, CancellationToken cancellationToken)
    {
        await sender.Send(new DeleteDocumentCommand(id, UserId, UserEmail: UserEmail), cancellationToken);
        return NoContent();
    }

    private static Visibility? ParseVisibility(string? raw) => raw?.Trim().ToLowerInvariant() switch
    {
        "public"  => Visibility.Public,
        "private" => Visibility.Private,
        _         => null,
    };
}
