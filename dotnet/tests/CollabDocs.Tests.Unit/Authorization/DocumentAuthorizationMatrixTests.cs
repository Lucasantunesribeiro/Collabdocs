using CollabDocs.Application.Authorization;
using CollabDocs.Application.Commands;
using CollabDocs.Application.Handlers;
using CollabDocs.Application.Interfaces;
using CollabDocs.Application.Queries;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;
using CollabDocs.Domain.Interfaces;
using FluentAssertions;
using Moq;
using Xunit;

namespace CollabDocs.Tests.Unit.Authorization;

/// <summary>
/// Matriz papel x operação executada pelos handlers reais (só repositórios mockados).
/// Resultado esperado: Ok, NotFound (sem leitura => 404, não vaza existência) ou
/// Forbidden (lê, mas não pode executar => 403).
/// </summary>
public class DocumentAuthorizationMatrixTests
{
    public enum Actor { StrangerPrivate, PublicReader, Viewer, Editor, LegacyOwnerCollaborator, Owner }
    public enum Op { Read, ListCollaborators, EditContent, Rename, ChangeVisibility, Delete, AddCollaborator, RemoveCollaborator }
    public enum Outcome { Ok, NotFound, Forbidden }

    private const string OwnerId = "owner-1";
    private const string ActorId = "actor-uid";
    private const string ActorEmail = "actor@test.com";

    private readonly Mock<IDocumentRepository> _docs = new();
    private readonly Mock<ICollaboratorRepository> _collabs = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<IOutboxRepository> _outbox = new();
    private readonly Mock<IDocumentCacheService> _cache = new();

    private Document Arrange(Actor actor)
    {
        var visibility = actor == Actor.PublicReader ? Visibility.Public : Visibility.Private;
        var doc = Document.Create(OwnerId, "Doc", "Conteúdo", visibility);

        var rows = new List<DocumentCollaborator>
        {
            new() { DocumentId = doc.Id, UserEmail = "other@test.com", Permission = Permission.Viewer },
        };
        Permission? own = actor switch
        {
            Actor.Viewer => Permission.Viewer,
            Actor.Editor => Permission.Editor,
            Actor.LegacyOwnerCollaborator => Permission.Owner,
            _ => null,
        };
        if (own is not null)
            rows.Add(new DocumentCollaborator { DocumentId = doc.Id, UserEmail = ActorEmail, Permission = own.Value });

        _docs.Setup(r => r.GetByIdAsync(doc.Id, It.IsAny<CancellationToken>())).ReturnsAsync(doc);
        _collabs.Setup(r => r.GetByDocumentIdAsync(doc.Id, It.IsAny<CancellationToken>())).ReturnsAsync(rows);
        return doc;
    }

    private static string UserIdFor(Actor a) => a == Actor.Owner ? OwnerId : ActorId;

    private Task Execute(Op op, Guid id, string userId)
    {
        var authz = new DocumentAuthorizationService(_docs.Object, _collabs.Object);
        var ct = CancellationToken.None;
        return op switch
        {
            Op.Read => new GetDocumentByIdHandler(authz, _users.Object)
                .Handle(new GetDocumentByIdQuery(id, userId, ActorEmail), ct),
            Op.ListCollaborators => new GetCollaboratorsHandler(authz)
                .Handle(new GetCollaboratorsQuery(id, userId, ActorEmail), ct),
            Op.EditContent => new UpdateDocumentHandler(_docs.Object, authz, _audit.Object, _outbox.Object, _cache.Object)
                .Handle(new UpdateDocumentCommand(id, userId, "novo", null, null, UserEmail: ActorEmail), ct),
            Op.Rename => new UpdateDocumentHandler(_docs.Object, authz, _audit.Object, _outbox.Object, _cache.Object)
                .Handle(new UpdateDocumentCommand(id, userId, null, "Novo título", null, UserEmail: ActorEmail), ct),
            Op.ChangeVisibility => new UpdateDocumentHandler(_docs.Object, authz, _audit.Object, _outbox.Object, _cache.Object)
                .Handle(new UpdateDocumentCommand(id, userId, null, null, null, UserEmail: ActorEmail, Visibility: Visibility.Public), ct),
            Op.Delete => new DeleteDocumentHandler(_docs.Object, _collabs.Object, authz, _audit.Object, _outbox.Object, _cache.Object)
                .Handle(new DeleteDocumentCommand(id, userId, UserEmail: ActorEmail), ct),
            Op.AddCollaborator => new AddCollaboratorHandler(_collabs.Object, authz, _users.Object, _cache.Object)
                .Handle(new AddCollaboratorCommand(id, userId, "new@test.com", Permission.Editor, ActorEmail), ct),
            Op.RemoveCollaborator => new RemoveCollaboratorHandler(_collabs.Object, authz, _cache.Object)
                .Handle(new RemoveCollaboratorCommand(id, userId, "other@test.com", ActorEmail), ct),
            _ => throw new ArgumentOutOfRangeException(nameof(op)),
        };
    }

    public static TheoryData<Actor, Op, Outcome> Cases()
    {
        var data = new TheoryData<Actor, Op, Outcome>();
        foreach (var op in Enum.GetValues<Op>())
        {
            // Sem acesso a documento privado: sempre 404, inclusive para escrita.
            data.Add(Actor.StrangerPrivate, op, Outcome.NotFound);

            data.Add(Actor.PublicReader, op, op is Op.Read or Op.ListCollaborators ? Outcome.Ok : Outcome.Forbidden);
            data.Add(Actor.Viewer, op, op is Op.Read or Op.ListCollaborators ? Outcome.Ok : Outcome.Forbidden);

            var editorOk = op is Op.Read or Op.ListCollaborators or Op.EditContent or Op.Rename;
            data.Add(Actor.Editor, op, editorOk ? Outcome.Ok : Outcome.Forbidden);
            data.Add(Actor.LegacyOwnerCollaborator, op, editorOk ? Outcome.Ok : Outcome.Forbidden);

            data.Add(Actor.Owner, op, Outcome.Ok);
        }
        return data;
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task RoleOperationMatrix(Actor actor, Op op, Outcome expected)
    {
        var doc = Arrange(actor);
        var act = () => Execute(op, doc.Id, UserIdFor(actor));

        switch (expected)
        {
            case Outcome.Ok:
                await act.Should().NotThrowAsync();
                break;
            case Outcome.NotFound:
                await act.Should().ThrowAsync<DocumentNotFoundException>();
                break;
            case Outcome.Forbidden:
                await act.Should().ThrowAsync<DocumentAccessDeniedException>();
                break;
        }

        if (expected != Outcome.Ok)
        {
            // Nenhuma escrita pode ter acontecido quando o acesso é negado.
            _docs.Verify(r => r.UpdateAsync(It.IsAny<Document>(), It.IsAny<CancellationToken>()), Times.Never);
            _docs.Verify(r => r.DeleteAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
            _collabs.Verify(r => r.AddAsync(It.IsAny<DocumentCollaborator>(), It.IsAny<CancellationToken>()), Times.Never);
            _collabs.Verify(r => r.UpdateAsync(It.IsAny<DocumentCollaborator>(), It.IsAny<CancellationToken>()), Times.Never);
            _collabs.Verify(r => r.RemoveAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _outbox.VerifyNoOtherCalls();
        }
    }

    [Fact]
    public async Task UnknownDocumentId_IsNotFound_LikeForbiddenPrivateDoc()
    {
        _docs.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync((Document?)null);
        var act = () => Execute(Op.Read, Guid.NewGuid(), ActorId);
        await act.Should().ThrowAsync<DocumentNotFoundException>();
    }

    [Fact]
    public async Task Editor_UpdatingContentAndVisibilityTogether_IsForbidden_AndNothingIsWritten()
    {
        var doc = Arrange(Actor.Editor);
        var authz = new DocumentAuthorizationService(_docs.Object, _collabs.Object);
        var handler = new UpdateDocumentHandler(_docs.Object, authz, _audit.Object, _outbox.Object, _cache.Object);

        var act = () => handler.Handle(
            new UpdateDocumentCommand(doc.Id, ActorId, "x", null, null, UserEmail: ActorEmail, Visibility: Visibility.Public),
            CancellationToken.None);

        await act.Should().ThrowAsync<DocumentAccessDeniedException>();
        doc.Content.Should().Be("Conteúdo");
        doc.Visibility.Should().Be(Visibility.Private);
    }

    [Fact]
    public async Task Owner_ChangingVisibility_InvalidatesAllCachedLists()
    {
        var doc = Arrange(Actor.Owner);
        await Execute(Op.ChangeVisibility, doc.Id, OwnerId);
        doc.Visibility.Should().Be(Visibility.Public);
        _cache.Verify(c => c.InvalidateAllAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Read_ReturnsEffectivePermission()
    {
        var doc = Arrange(Actor.Viewer);
        var authz = new DocumentAuthorizationService(_docs.Object, _collabs.Object);
        var dto = await new GetDocumentByIdHandler(authz, _users.Object)
            .Handle(new GetDocumentByIdQuery(doc.Id, ActorId, ActorEmail), CancellationToken.None);

        dto.Permission.Should().Be("read");
        dto.IsOwner.Should().BeFalse();
    }
}
