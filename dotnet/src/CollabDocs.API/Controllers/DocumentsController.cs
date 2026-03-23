using CollabDocs.Application.Commands;
using CollabDocs.Application.DTOs;
using CollabDocs.Application.Queries;
using CollabDocs.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CollabDocs.API.Controllers;

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
    [ProducesResponseType(403)]
    public async Task<IActionResult> GetDocument(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var result = await sender.Send(new GetDocumentByIdQuery(id, UserId, UserEmail), cancellationToken);
            return Ok(new { document = result });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return Forbid(); }
    }

    [HttpPost]
    [ProducesResponseType(typeof(DocumentDto), 201)]
    public async Task<IActionResult> CreateDocument([FromBody] CreateDocumentRequest request, CancellationToken cancellationToken)
    {
        var visibility = Enum.TryParse<Visibility>(request.Visibility, true, out var v) ? v : Visibility.Public;
        var result = await sender.Send(
            new CreateDocumentCommand(UserId, UserEmail, UserName, request.Title,
                request.Content ?? $"# {request.Title}\n\nStart writing...", visibility),
            cancellationToken);
        return CreatedAtAction(nameof(GetDocument), new { id = result.Id }, new { document = result });
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(DocumentDto), 200)]
    [ProducesResponseType(404)]
    [ProducesResponseType(403)]
    [ProducesResponseType(409)]
    public async Task<IActionResult> UpdateDocument(Guid id, [FromBody] UpdateDocumentRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await sender.Send(
                new UpdateDocumentCommand(id, UserId, request.Content, request.Title, request.ExpectedVersion),
                cancellationToken);
            return Ok(new { document = result });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    [ProducesResponseType(403)]
    public async Task<IActionResult> DeleteDocument(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            await sender.Send(new DeleteDocumentCommand(id, UserId), cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }
}
