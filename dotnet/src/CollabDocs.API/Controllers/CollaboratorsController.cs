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
[Route("api/documents/{documentId:guid}/collaborators")]
public class CollaboratorsController(ISender sender) : ControllerBase
{
    private string UserId => User.FindFirst("sub")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? throw new UnauthorizedAccessException("User ID not found in token");

    private string UserEmail => User.FindFirst("email")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
        ?? string.Empty;

    [HttpGet]
    [ProducesResponseType(typeof(List<CollaboratorDto>), 200)]
    [ProducesResponseType(403)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetCollaborators(Guid documentId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await sender.Send(
                new GetCollaboratorsQuery(documentId, UserId, UserEmail), cancellationToken);
            return Ok(new { collaborators = result, total = result.Count });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpPost]
    [ProducesResponseType(typeof(CollaboratorDto), 201)]
    [ProducesResponseType(400)]
    [ProducesResponseType(403)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> AddCollaborator(
        Guid documentId,
        [FromBody] AddCollaboratorRequest request,
        CancellationToken cancellationToken)
    {
        var permission = ParsePermission(request.Permission);
        try
        {
            var result = await sender.Send(
                new AddCollaboratorCommand(documentId, UserId, request.Email, permission), cancellationToken);
            return StatusCode(201, new { collaborator = result });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpDelete]
    [ProducesResponseType(204)]
    [ProducesResponseType(400)]
    [ProducesResponseType(403)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> RemoveCollaborator(
        Guid documentId,
        [FromBody] RemoveCollaboratorRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await sender.Send(
                new RemoveCollaboratorCommand(documentId, UserId, request.Email), cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    /// <summary>Maps frontend permission string to the domain enum.</summary>
    private static Permission ParsePermission(string raw) => raw.ToLowerInvariant() switch
    {
        "write" or "editor" => Permission.Editor,
        "owner"             => Permission.Owner,
        _                   => Permission.Viewer,  // "read" or unknown → safe default
    };
}
