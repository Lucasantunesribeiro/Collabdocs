namespace CollabDocs.Domain.Authorization;

/// <summary>
/// Papel efetivo de um usuário em relação a um documento.
/// A ordem numérica reflete privilégio crescente.
/// </summary>
public enum DocumentRole
{
    /// <summary>Sem acesso: o documento deve ser tratado como inexistente (404).</summary>
    None = 0,

    /// <summary>Usuário autenticado lendo um documento público sem ser colaborador.</summary>
    PublicReader = 1,

    /// <summary>Colaborador com permissão de leitura.</summary>
    Viewer = 2,

    /// <summary>Colaborador com permissão de escrita.</summary>
    Editor = 3,

    /// <summary>Dono do documento (Document.OwnerId).</summary>
    Owner = 4,
}
