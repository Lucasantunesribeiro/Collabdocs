using CollabDocs.Application.Commands;
using CollabDocs.Application.Handlers;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;
using CollabDocs.Domain.Interfaces;
using FluentAssertions;
using Moq;

namespace CollabDocs.Tests.Unit.Handlers;

public class CreateDocumentHandlerTests
{
    private readonly Mock<IDocumentRepository> _documentRepo = new();
    private readonly Mock<IUserRepository> _userRepo = new();
    private readonly Mock<IAuditService> _audit = new();

    private CreateDocumentHandler CreateHandler() =>
        new(_documentRepo.Object, _userRepo.Object, _audit.Object);

    [Fact]
    public async Task Handle_ValidCommand_ReturnsDocumentDto()
    {
        var command = new CreateDocumentCommand(
            "user-123", "test@test.com", "Test User",
            "My Document", "Content here", Visibility.Public);

        var result = await CreateHandler().Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.Title.Should().Be("My Document");
        result.Content.Should().Be("Content here");
        result.OwnerId.Should().Be("user-123");
        result.Visibility.Should().Be("public");
        result.Version.Should().Be(1);
        result.IsOwner.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_ValidCommand_CallsAuditLog()
    {
        var command = new CreateDocumentCommand(
            "user-456", "a@b.com", "User A",
            "Title", "Body", Visibility.Private);

        await CreateHandler().Handle(command, CancellationToken.None);

        _audit.Verify(a => a.LogAsync(It.IsAny<Guid>(), "user-456", "created", null), Times.Once);
    }

    [Fact]
    public async Task Handle_SetsCreatedAtAndUpdatedAt()
    {
        var before = DateTime.UtcNow;

        var command = new CreateDocumentCommand(
            "user-789", "b@c.com", "User B",
            "Doc", "Content", Visibility.Public);

        var result = await CreateHandler().Handle(command, CancellationToken.None);

        result.CreatedAt.Should().BeOnOrAfter(before);
        result.UpdatedAt.Should().BeOnOrAfter(before);
    }

    [Fact]
    public async Task Handle_PersistsDocument()
    {
        var command = new CreateDocumentCommand(
            "user-000", "c@d.com", "User C",
            "Title", "Body", Visibility.Public);

        await CreateHandler().Handle(command, CancellationToken.None);

        _documentRepo.Verify(r => r.AddAsync(It.IsAny<Document>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
