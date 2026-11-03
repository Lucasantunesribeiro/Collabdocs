namespace CollabDocs.Application.Authorization;

/// <summary>
/// Documento inexistente OU sem permissão de leitura. As duas situações produzem a mesma
/// resposta (404) para não revelar a existência de documentos privados (anti-IDOR).
/// </summary>
public sealed class DocumentNotFoundException(Guid documentId)
    : KeyNotFoundException("Document not found")
{
    public Guid DocumentId { get; } = documentId;
}

/// <summary>O usuário pode ler o documento, mas não executar a operação pedida (403).</summary>
public sealed class DocumentAccessDeniedException(string message)
    : UnauthorizedAccessException(message);

/// <summary>Conflito de versão otimista (409).</summary>
public sealed class DocumentVersionConflictException()
    : InvalidOperationException("Document was modified by another user");
