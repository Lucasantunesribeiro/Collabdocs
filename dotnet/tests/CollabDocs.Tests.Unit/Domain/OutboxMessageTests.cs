using CollabDocs.Domain.Outbox;
using FluentAssertions;
using Xunit;

namespace CollabDocs.Tests.Unit.Domain;

public class OutboxMessageTests
{
    [Fact]
    public void Create_SetsRequiredFields()
    {
        var before = DateTime.UtcNow;

        var msg = OutboxMessage.Create("document.created", """{"id":"abc"}""", "idem-1");

        msg.Id.Should().NotBeEmpty();
        msg.EventType.Should().Be("document.created");
        msg.Payload.Should().Be("""{"id":"abc"}""");
        msg.IdempotencyKey.Should().Be("idem-1");
        msg.CreatedAt.Should().BeOnOrAfter(before);
        msg.ProcessedAt.Should().BeNull();
        msg.RetryCount.Should().Be(0);
        msg.Error.Should().BeNull();
    }

    [Fact]
    public void Create_WithoutIdempotencyKey_IdempotencyKeyIsNull()
    {
        var msg = OutboxMessage.Create("document.deleted", "{}");

        msg.IdempotencyKey.Should().BeNull();
    }

    [Fact]
    public void MarkProcessed_SetsProcessedAt()
    {
        var msg = OutboxMessage.Create("document.updated", "{}");
        var before = DateTime.UtcNow;

        msg.MarkProcessed();

        msg.ProcessedAt.Should().NotBeNull();
        msg.ProcessedAt.Should().BeOnOrAfter(before);
        msg.RetryCount.Should().Be(0); // not incremented on success
    }

    [Fact]
    public void MarkFailed_IncrementsRetryCountAndSetsError()
    {
        var msg = OutboxMessage.Create("document.created", "{}");

        msg.MarkFailed("Connection refused");

        msg.RetryCount.Should().Be(1);
        msg.Error.Should().Be("Connection refused");
        msg.ProcessedAt.Should().BeNull();
    }

    [Fact]
    public void MarkFailed_MultipleTimes_AccumulatesRetryCount()
    {
        var msg = OutboxMessage.Create("document.created", "{}");

        msg.MarkFailed("error 1");
        msg.MarkFailed("error 2");
        msg.MarkFailed("error 3");

        msg.RetryCount.Should().Be(3);
        msg.Error.Should().Be("error 3"); // last error wins
    }

    [Fact]
    public void Create_EachCallGeneratesUniqueId()
    {
        var a = OutboxMessage.Create("event", "{}");
        var b = OutboxMessage.Create("event", "{}");

        a.Id.Should().NotBe(b.Id);
    }
}
