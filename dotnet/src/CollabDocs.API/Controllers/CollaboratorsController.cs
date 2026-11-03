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
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetCollaborators(Guid documentId, CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new GetCollaboratorsQuery(documentId, UserId, UserEmail), cancellationToken);
        return Ok(new { collaborators = result, total = result.Count });
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
        var result = await sender.Send(
            new AddCollaboratorCommand(documentId, UserId, request.Email, permission, UserEmail), cancellationToken);
        return StatusCode(201, new { collaborator = result });
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
        await sender.Send(
            new RemoveCollaboratorCommand(documentId, UserId, request.Email, UserEmail), cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Mapeia a permissão do frontend para o enum de domínio. "owner" é rejeitado com 400
    /// pelo handler (posse não é transferível por esta rota); valores desconhecidos também.
    /// </summary>
    private static Permission ParsePermission(string? raw) => raw?.Trim().ToLowerInvariant() switch
    {
        "write" or "editor" => Permission.Editor,
        "read" or "viewer" or null or "" => Permission.Viewer,
        "owner" => Permission.Owner,
        _ => throw new ArgumentException("Permission must be 'read' or 'write'"),
    };
}
