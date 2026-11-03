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

namespace CollabDocs.Tests.Unit.Handlers;

public class CollaboratorHandlerTests
{
    private readonly Mock<IDocumentRepository> _documentRepo = new();
    private readonly Mock<ICollaboratorRepository> _collaboratorRepo = new();
    private readonly Mock<IUserRepository> _userRepo = new();
    private readonly Mock<IDocumentCacheService> _cache = new();

    private DocumentAuthorizationService Authz => new(_documentRepo.Object, _collaboratorRepo.Object);

    private AddCollaboratorHandler AddHandler() =>
        new(_collaboratorRepo.Object, Authz, _userRepo.Object, _cache.Object);

    private RemoveCollaboratorHandler RemoveHandler() =>
        new(_collaboratorRepo.Object, Authz, _cache.Object);

    private GetCollaboratorsHandler GetHandler() => new(Authz);

    private Document Arrange(Visibility visibility = Visibility.Private, params DocumentCollaborator[] collabs)
    {
        var doc = Document.Create("owner-1", "Test Doc", "Content", visibility);
        foreach (var c in collabs) c.DocumentId = doc.Id;
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, It.IsAny<CancellationToken>())).ReturnsAsync(doc);
        _collaboratorRepo.Setup(r => r.GetByDocumentIdAsync(doc.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(collabs);
        return doc;
    }

    private static DocumentCollaborator Collab(string email, Permission permission, string userId = "") =>
        new() { UserId = userId, UserEmail = email, Permission = permission, GrantedAt = DateTime.UtcNow };

    // ── AddCollaboratorHandler ──────────────────────────────────────────────────

    [Fact]
    public async Task AddCollaborator_OwnerRequest_ReturnsCollaboratorDto_AndNormalizesEmail()
    {
        var doc = Arrange();

        var result = await AddHandler().Handle(
            new AddCollaboratorCommand(doc.Id, "owner-1", "  Collab@Test.com ", Permission.Viewer, "owner@test.com"),
            CancellationToken.None);

        result.UserEmail.Should().Be("collab@test.com");
        result.Permission.Should().Be("read");
        _collaboratorRepo.Verify(r => r.AddAsync(It.IsAny<DocumentCollaborator>(), It.IsAny<CancellationToken>()), Times.Once);
        _cache.Verify(c => c.InvalidateAllAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData(Permission.Viewer, "read")]
    [InlineData(Permission.Editor, "write")]
    public async Task AddCollaborator_MapsPermissionToString(Permission domainPerm, string expected)
    {
        var doc = Arrange();

        var result = await AddHandler().Handle(
            new AddCollaboratorCommand(doc.Id, "owner-1", "user@test.com", domainPerm, "owner@test.com"),
            CancellationToken.None);

        result.Permission.Should().Be(expected);
    }

    [Fact]
    public async Task AddCollaborator_GrantingOwnerPermission_IsRejected()
    {
        var doc = Arrange();

        var act = () => AddHandler().Handle(
            new AddCollaboratorCommand(doc.Id, "owner-1", "user@test.com", Permission.Owner, "owner@test.com"),
            CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentException>();
        _collaboratorRepo.Verify(r => r.AddAsync(It.IsAny<DocumentCollaborator>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AddCollaborator_OwnerOwnEmail_IsRejected()
    {
        var doc = Arrange();

        var act = () => AddHandler().Handle(
            new AddCollaboratorCommand(doc.Id, "owner-1", "OWNER@test.com", Permission.Viewer, "owner@test.com"),
            CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task AddCollaborator_ExistingEmail_UpdatesPermissionInsteadOfDuplicating()
    {
        var existing = Collab("collab@test.com", Permission.Viewer);
        var doc = Arrange(Visibility.Private, existing);

        var result = await AddHandler().Handle(
            new AddCollaboratorCommand(doc.Id, "owner-1", "COLLAB@test.com", Permission.Editor, "owner@test.com"),
            CancellationToken.None);

        result.Permission.Should().Be("write");
        existing.Permission.Should().Be(Permission.Editor);
        _collaboratorRepo.Verify(r => r.UpdateAsync(existing, It.IsAny<CancellationToken>()), Times.Once);
        _collaboratorRepo.Verify(r => r.AddAsync(It.IsAny<DocumentCollaborator>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(Permission.Viewer)]
    [InlineData(Permission.Editor)]
    [InlineData(Permission.Owner)] // linha legada com "owner" não dá poder de dono
    public async Task AddCollaborator_ByCollaborator_IsForbidden_EvenToPromoteSelf(Permission own)
    {
        var self = Collab("collab@test.com", own);
        var doc = Arrange(Visibility.Private, self);

        var act = () => AddHandler().Handle(
            new AddCollaboratorCommand(doc.Id, "collab-uid", "collab@test.com", Permission.Editor, "collab@test.com"),
            CancellationToken.None);

        await act.Should().ThrowAsync<DocumentAccessDeniedException>();
        self.Permission.Should().Be(own);
        _collaboratorRepo.Verify(r => r.UpdateAsync(It.IsAny<DocumentCollaborator>(), It.IsAny<CancellationToken>()), Times.Never);
        _collaboratorRepo.Verify(r => r.AddAsync(It.IsAny<DocumentCollaborator>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AddCollaborator_StrangerOnPrivateDoc_ThrowsNotFound()
    {
        var doc = Arrange();

        var act = () => AddHandler().Handle(
            new AddCollaboratorCommand(doc.Id, "stranger-99", "victim@test.com", Permission.Viewer, "stranger@test.com"),
            CancellationToken.None);

        await act.Should().ThrowAsync<DocumentNotFoundException>();
        _collaboratorRepo.Verify(r => r.AddAsync(It.IsAny<DocumentCollaborator>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AddCollaborator_DocumentNotFound_ThrowsNotFound()
    {
        _documentRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync((Document?)null);

        var act = () => AddHandler().Handle(
            new AddCollaboratorCommand(Guid.NewGuid(), "owner-1", "x@y.com", Permission.Editor, "owner@test.com"),
            CancellationToken.None);

        await act.Should().ThrowAsync<DocumentNotFoundException>();
    }

    // ── RemoveCollaboratorHandler ───────────────────────────────────────────────

    [Fact]
    public async Task RemoveCollaborator_OwnerRequest_RemovesCaseInsensitive_AndInvalidatesCache()
    {
        var doc = Arrange(Visibility.Private, Collab("collab@test.com", Permission.Editor));

        await RemoveHandler().Handle(
            new RemoveCollaboratorCommand(doc.Id, "owner-1", "Collab@Test.com", "owner@test.com"),
            CancellationToken.None);

        _collaboratorRepo.Verify(r => r.RemoveAsync(doc.Id, "collab@test.com", It.IsAny<CancellationToken>()), Times.Once);
        _cache.Verify(c => c.InvalidateAllAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RemoveCollaborator_EditorCannotRemoveOthers()
    {
        var doc = Arrange(Visibility.Private,
            Collab("editor@test.com", Permission.Editor),
            Collab("viewer@test.com", Permission.Viewer));

        var act = () => RemoveHandler().Handle(
            new RemoveCollaboratorCommand(doc.Id, "editor-uid", "viewer@test.com", "editor@test.com"),
            CancellationToken.None);

        await act.Should().ThrowAsync<DocumentAccessDeniedException>();
        _collaboratorRepo.Verify(r => r.RemoveAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RemoveCollaborator_StrangerOnPrivateDoc_ThrowsNotFound()
    {
        var doc = Arrange(Visibility.Private, Collab("collab@test.com", Permission.Viewer));

        var act = () => RemoveHandler().Handle(
            new RemoveCollaboratorCommand(doc.Id, "impostor-42", "collab@test.com", "impostor@test.com"),
            CancellationToken.None);

        await act.Should().ThrowAsync<DocumentNotFoundException>();
        _collaboratorRepo.Verify(r => r.RemoveAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ── GetCollaboratorsHandler ─────────────────────────────────────────────────

    [Fact]
    public async Task GetCollaborators_Owner_ReturnsAllCollaborators()
    {
        var doc = Arrange(Visibility.Private, Collab("a@b.com", Permission.Viewer));

        var result = await GetHandler().Handle(
            new GetCollaboratorsQuery(doc.Id, "owner-1", "owner@test.com"),
            CancellationToken.None);

        result.Should().HaveCount(1);
        result[0].UserEmail.Should().Be("a@b.com");
        result[0].Permission.Should().Be("read");
    }

    [Fact]
    public async Task GetCollaborators_CollaboratorMatchedByEmailOnly_ReturnsCollaborators()
    {
        // UserId vazio (convite por e-mail): o acesso precisa funcionar pelo e-mail do JWT.
        var doc = Arrange(Visibility.Private, Collab("collab@test.com", Permission.Viewer));

        var result = await GetHandler().Handle(
            new GetCollaboratorsQuery(doc.Id, "collab-uid", "COLLAB@test.com"),
            CancellationToken.None);

        result.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetCollaborators_PublicReader_GetsEmptyList()
    {
        var doc = Arrange(Visibility.Public, Collab("secret@test.com", Permission.Editor));

        var result = await GetHandler().Handle(
            new GetCollaboratorsQuery(doc.Id, "stranger-99", "stranger@test.com"),
            CancellationToken.None);

        result.Should().BeEmpty("leitores públicos não devem ver e-mails de colaboradores");
    }

    [Fact]
    public async Task GetCollaborators_StrangerOnPrivateDoc_ThrowsNotFound()
    {
        var doc = Arrange();

        var act = () => GetHandler().Handle(
            new GetCollaboratorsQuery(doc.Id, "stranger-99", "stranger@test.com"),
            CancellationToken.None);

        await act.Should().ThrowAsync<DocumentNotFoundException>();
    }
}
