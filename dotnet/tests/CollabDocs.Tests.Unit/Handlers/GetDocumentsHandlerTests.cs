using CollabDocs.Application.DTOs;
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

public class GetDocumentsHandlerTests
{
    private readonly Mock<IDocumentRepository> _documentRepo = new();
    private readonly Mock<IDocumentCacheService> _cacheService = new();

    private GetDocumentsHandler CreateHandler() =>
        new(_documentRepo.Object, _cacheService.Object);

    [Fact]
    public async Task Handle_ReturnsDocumentsForUser()
    {
        var docs = new List<Document>
        {
            Document.Create("user-1", "Doc 1", "Content 1", Visibility.Public),
            Document.Create("user-1", "Doc 2", "Content 2", Visibility.Private),
        };

        _cacheService
            .Setup(c => c.GetDocumentsAsync("user-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync((List<DocumentDto>?)null);

        _documentRepo
            .Setup(r => r.GetByOwnerOrCollaboratorAsync("user-1", "u@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(docs);

        var result = await CreateHandler().Handle(
            new GetDocumentsQuery("user-1", "u@test.com"), CancellationToken.None);

        result.Should().HaveCount(2);
        result.Should().AllSatisfy(d => d.IsOwner.Should().BeTrue());
    }

    [Fact]
    public async Task Handle_ReturnsEmpty_WhenNoDocuments()
    {
        _cacheService
            .Setup(c => c.GetDocumentsAsync("user-2", It.IsAny<CancellationToken>()))
            .ReturnsAsync((List<DocumentDto>?)null);

        _documentRepo
            .Setup(r => r.GetByOwnerOrCollaboratorAsync("user-2", "u2@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var result = await CreateHandler().Handle(
            new GetDocumentsQuery("user-2", "u2@test.com"), CancellationToken.None);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_CacheHit_ReturnsCachedResultWithoutHittingDb()
    {
        var cached = new List<DocumentDto>
        {
            new(Guid.NewGuid(), "user-3", "Cached Doc", "Cached Content", "public", 1,
                DateTime.UtcNow, DateTime.UtcNow, IsOwner: true)
        };

        _cacheService
            .Setup(c => c.GetDocumentsAsync("user-3", It.IsAny<CancellationToken>()))
            .ReturnsAsync(cached);

        var result = await CreateHandler().Handle(
            new GetDocumentsQuery("user-3", "u3@test.com"), CancellationToken.None);

        result.Should().HaveCount(1);
        result[0].Title.Should().Be("Cached Doc");

        // DB should never be called on cache hit
        _documentRepo.Verify(
            r => r.GetByOwnerOrCollaboratorAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_CacheMiss_StoresResultInCacheAfterDbQuery()
    {
        var docs = new List<Document>
        {
            Document.Create("user-4", "Doc A", "Content A", Visibility.Public),
        };

        _cacheService
            .Setup(c => c.GetDocumentsAsync("user-4", It.IsAny<CancellationToken>()))
            .ReturnsAsync((List<DocumentDto>?)null);

        _documentRepo
            .Setup(r => r.GetByOwnerOrCollaboratorAsync("user-4", "u4@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(docs);

        await CreateHandler().Handle(
            new GetDocumentsQuery("user-4", "u4@test.com"), CancellationToken.None);

        _cacheService.Verify(
            c => c.SetDocumentsAsync(
                "user-4",
                It.Is<List<DocumentDto>>(l => l.Count == 1),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
