using CollabDocs.Application.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CollabDocs.API.Filters;

/// <summary>
/// Traduz exceções de autorização/validação em respostas HTTP de forma única:
/// sem leitura (ou inexistente) => 404, leitura sem permissão para a operação => 403,
/// conflito de versão => 409, entrada inválida => 400, identidade ausente no token => 401.
/// Mensagens internas nunca são devolvidas em erros 500.
/// </summary>
public sealed class DocumentExceptionFilter(ILogger<DocumentExceptionFilter> logger) : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        IActionResult? result = context.Exception switch
        {
            DocumentNotFoundException or KeyNotFoundException
                => new NotFoundObjectResult(new { error = "Document not found" }),
            DocumentAccessDeniedException
                => new ObjectResult(new { error = "You do not have permission to perform this operation" }) { StatusCode = 403 },
            DocumentVersionConflictException ex
                => new ConflictObjectResult(new { error = ex.Message }),
            ArgumentException ex
                => new BadRequestObjectResult(new { error = ex.Message }),
            UnauthorizedAccessException
                => new UnauthorizedObjectResult(new { error = "Invalid token: user identity missing" }),
            _ => null,
        };

        if (result is null)
        {
            logger.LogError(context.Exception, "Unhandled exception on {Path}", context.HttpContext.Request.Path);
            result = new ObjectResult(new { error = "Internal server error" }) { StatusCode = 500 };
        }

        context.Result = result;
        context.ExceptionHandled = true;
    }
}
