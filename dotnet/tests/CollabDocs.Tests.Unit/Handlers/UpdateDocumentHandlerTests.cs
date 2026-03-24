using CollabDocs.Application.Commands;
using CollabDocs.Application.Handlers;
using CollabDocs.Application.Interfaces;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;
using CollabDocs.Domain.Interfaces;
using CollabDocs.Domain.Outbox;
using FluentAssertions;
using Moq;
using Xunit;

namespace CollabDocs.Tests.Unit.Handlers;

public class UpdateDocumentHandlerTests
{
    private readonly Mock<IDocumentRepository> _documentRepo = new();
    private readonly Mock<ICollaboratorRepository> _collaboratorRepo = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<IOutboxRepository> _outbox = new();
    private readonly Mock<IDocumentCacheService> _cacheService = new();

    private UpdateDocumentHandler CreateHandler() =>
        new(_documentRepo.Object, _collaboratorRepo.Object, _audit.Object, _outbox.Object, _cacheService.Object);

    private static Document CreateDocument(string ownerId = "owner-1") =>
        Document.Create(ownerId, "Title", "Original content", Visibility.Public);

    [Fact]
    public async Task Handle_OwnerCanUpdate()
    {
        var doc = CreateDocument("owner-1");
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, It.IsAny<CancellationToken>())).ReturnsAsync(doc);
        _collaboratorRepo.Setup(r => r.GetByDocumentIdAsync(doc.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var result = await CreateHandler().Handle(
            new UpdateDocumentCommand(doc.Id, "owner-1", "New content", null, null),
            CancellationToken.None);

        result.Content.Should().Be("New content");
        result.Version.Should().Be(2);
    }

    [Fact]
    public async Task Handle_NonOwnerWithoutCollaboration_ThrowsUnauthorized()
    {
        var doc = CreateDocument("owner-1");
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, It.IsAny<CancellationToken>())).ReturnsAsync(doc);
        _collaboratorRepo.Setup(r => r.GetByDocumentIdAsync(doc.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var act = async () => await CreateHandler().Handle(
            new UpdateDocumentCommand(doc.Id, "other-user", "Hack", null, null),
            CancellationToken.None);

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task Handle_VersionMismatch_ThrowsConflict()
    {
        var doc = CreateDocument("owner-1");
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, It.IsAny<CancellationToken>())).ReturnsAsync(doc);
        _collaboratorRepo.Setup(r => r.GetByDocumentIdAsync(doc.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        // doc.Version is 1, but we pass expectedVersion 999
        var act = async () => await CreateHandler().Handle(
            new UpdateDocumentCommand(doc.Id, "owner-1", "Content", null, ExpectedVersion: 999),
            CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*modified by another user*");
    }

    [Fact]
    public async Task Handle_WritesOutboxMessage()
    {
        var doc = CreateDocument("owner-1");
        _documentRepo.Setup(r => r.GetByIdAsync(doc.Id, It.IsAny<CancellationToken>())).ReturnsAsync(doc);
        _collaboratorRepo.Setup(r => r.GetByDocumentIdAsync(doc.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        await CreateHandler().Handle(
            new UpdateDocumentCommand(doc.Id, "owner-1", "New content", null, null, IdempotencyKey: "idem-key-2"),
            CancellationToken.None);

        _outbox.Verify(o => o.AddAsync(
            It.Is<OutboxMessage>(m => m.EventType == "document.updated" && m.IdempotencyKey == "idem-key-2"),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
