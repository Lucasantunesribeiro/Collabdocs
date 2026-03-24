using CollabDocs.Application.Handlers;
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

    private GetDocumentsHandler CreateHandler() => new(_documentRepo.Object);

    [Fact]
    public async Task Handle_ReturnsDocumentsForUser()
    {
        var docs = new List<Document>
        {
            Document.Create("user-1", "Doc 1", "Content 1", Visibility.Public),
            Document.Create("user-1", "Doc 2", "Content 2", Visibility.Private),
        };

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
        _documentRepo
            .Setup(r => r.GetByOwnerOrCollaboratorAsync("user-2", "u2@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var result = await CreateHandler().Handle(
            new GetDocumentsQuery("user-2", "u2@test.com"), CancellationToken.None);

        result.Should().BeEmpty();
    }
}
