using CollabDocs.Application.Commands;
using CollabDocs.Application.Handlers;
using CollabDocs.Application.Queries;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;
using CollabDocs.Domain.Interfaces;
using FluentAssertions;
using Moq;
using Xunit;

namespace CollabDocs.Tests.Unit.Handlers;

public class CollaboratorHandlerTests
{
    private readonly Mock<IDocumentRepository> _documentRepo = new();
    private readonly Mock<ICollaboratorRepository> _collaboratorRepo = new();

    private static Document MakeDocument(string ownerId = "owner-1") =>
        Document.Create(ownerId, "Test Doc", "Content", Visibility.Private);

    private static DocumentCollaborator MakeCollaborator(Guid documentId, string email, Permission permission) =>
        new() { DocumentId = documentId, UserId = "collab-uid", UserEmail = email, Permission = permission, GrantedAt = DateTime.UtcNow };

    // ── AddCollaboratorHandler ──────────────────────────────────────────────────

    [Fact]
    public async Task AddCollaborator_OwnerRequest_ReturnsCollaboratorDto()
    {
        var doc = MakeDocument("owner-1");
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, default)).ReturnsAsync(doc);

        var handler = new AddCollaboratorHandler(_documentRepo.Object, _collaboratorRepo.Object);
        var result = await handler.Handle(
            new AddCollaboratorCommand(doc.Id, "owner-1", "collab@test.com", Permission.Viewer),
            CancellationToken.None);

        result.UserEmail.Should().Be("collab@test.com");
        result.Permission.Should().Be("read");
        _collaboratorRepo.Verify(r => r.AddAsync(It.IsAny<DocumentCollaborator>(), default), Times.Once);
    }

    [Fact]
    public async Task AddCollaborator_NonOwnerRequest_ThrowsUnauthorized()
    {
        var doc = MakeDocument("owner-1");
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, default)).ReturnsAsync(doc);

        var handler = new AddCollaboratorHandler(_documentRepo.Object, _collaboratorRepo.Object);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            handler.Handle(
                new AddCollaboratorCommand(doc.Id, "stranger-99", "victim@test.com", Permission.Viewer),
                CancellationToken.None));

        _collaboratorRepo.Verify(r => r.AddAsync(It.IsAny<DocumentCollaborator>(), default), Times.Never);
    }

    [Fact]
    public async Task AddCollaborator_DocumentNotFound_ThrowsKeyNotFound()
    {
        _documentRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Document?)null);

        var handler = new AddCollaboratorHandler(_documentRepo.Object, _collaboratorRepo.Object);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            handler.Handle(
                new AddCollaboratorCommand(Guid.NewGuid(), "owner-1", "x@y.com", Permission.Editor),
                CancellationToken.None));
    }

    [Theory]
    [InlineData(Permission.Viewer, "read")]
    [InlineData(Permission.Editor, "write")]
    [InlineData(Permission.Owner, "owner")]
    public async Task AddCollaborator_MapsPermissionToString(Permission domainPerm, string expected)
    {
        var doc = MakeDocument("owner-1");
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, default)).ReturnsAsync(doc);

        var handler = new AddCollaboratorHandler(_documentRepo.Object, _collaboratorRepo.Object);
        var result = await handler.Handle(
            new AddCollaboratorCommand(doc.Id, "owner-1", "user@test.com", domainPerm),
            CancellationToken.None);

        result.Permission.Should().Be(expected);
    }

    // ── RemoveCollaboratorHandler ───────────────────────────────────────────────

    [Fact]
    public async Task RemoveCollaborator_OwnerRequest_CallsRepository()
    {
        var doc = MakeDocument("owner-1");
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, default)).ReturnsAsync(doc);

        var handler = new RemoveCollaboratorHandler(_documentRepo.Object, _collaboratorRepo.Object);
        await handler.Handle(
            new RemoveCollaboratorCommand(doc.Id, "owner-1", "collab@test.com"),
            CancellationToken.None);

        _collaboratorRepo.Verify(r => r.RemoveAsync(doc.Id, "collab@test.com", default), Times.Once);
    }

    [Fact]
    public async Task RemoveCollaborator_NonOwnerRequest_ThrowsUnauthorized()
    {
        var doc = MakeDocument("owner-1");
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, default)).ReturnsAsync(doc);

        var handler = new RemoveCollaboratorHandler(_documentRepo.Object, _collaboratorRepo.Object);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            handler.Handle(
                new RemoveCollaboratorCommand(doc.Id, "impostor-42", "collab@test.com"),
                CancellationToken.None));

        _collaboratorRepo.Verify(r => r.RemoveAsync(It.IsAny<Guid>(), It.IsAny<string>(), default), Times.Never);
    }

    // ── GetCollaboratorsHandler ─────────────────────────────────────────────────

    [Fact]
    public async Task GetCollaborators_Owner_ReturnsAllCollaborators()
    {
        var doc = MakeDocument("owner-1");
        var collab = MakeCollaborator(doc.Id, "a@b.com", Permission.Viewer);
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, default)).ReturnsAsync(doc);
        _collaboratorRepo.Setup(r => r.GetByDocumentIdAsync(doc.Id, default)).ReturnsAsync([collab]);

        var handler = new GetCollaboratorsHandler(_documentRepo.Object, _collaboratorRepo.Object);
        var result = await handler.Handle(
            new GetCollaboratorsQuery(doc.Id, "owner-1", "owner@test.com"),
            CancellationToken.None);

        result.Should().HaveCount(1);
        result[0].UserEmail.Should().Be("a@b.com");
        result[0].Permission.Should().Be("read");
    }

    [Fact]
    public async Task GetCollaborators_ExistingCollaborator_ReturnsCollaborators()
    {
        var doc = MakeDocument("owner-1");
        var collab = MakeCollaborator(doc.Id, "collab@test.com", Permission.Editor);
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, default)).ReturnsAsync(doc);
        _collaboratorRepo.Setup(r => r.GetByDocumentIdAsync(doc.Id, default)).ReturnsAsync([collab]);

        var handler = new GetCollaboratorsHandler(_documentRepo.Object, _collaboratorRepo.Object);
        var result = await handler.Handle(
            new GetCollaboratorsQuery(doc.Id, "collab-uid", "collab@test.com"),
            CancellationToken.None);

        result.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetCollaborators_Stranger_ThrowsUnauthorized()
    {
        var doc = MakeDocument("owner-1");
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, default)).ReturnsAsync(doc);
        _collaboratorRepo.Setup(r => r.GetByDocumentIdAsync(doc.Id, default)).ReturnsAsync([]);

        var handler = new GetCollaboratorsHandler(_documentRepo.Object, _collaboratorRepo.Object);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            handler.Handle(
                new GetCollaboratorsQuery(doc.Id, "stranger-99", "stranger@test.com"),
                CancellationToken.None));
    }
}
