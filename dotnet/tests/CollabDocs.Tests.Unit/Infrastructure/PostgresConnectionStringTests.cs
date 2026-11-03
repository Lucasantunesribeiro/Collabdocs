using CollabDocs.Infrastructure.Data;
using FluentAssertions;
using Npgsql;
using Xunit;

namespace CollabDocs.Tests.Unit.Infrastructure;

public class PostgresConnectionStringTests
{
    [Fact]
    public void KeyValueFormat_IsReturnedUnchanged()
    {
        const string cs = "Host=localhost;Port=5432;Database=collabdocs;Username=u;Password=p";
        PostgresConnectionString.Normalize(cs).Should().Be(cs);
    }

    [Theory]
    [InlineData("postgresql://")]
    [InlineData("postgres://")]
    public void UriFormat_IsConverted_WithSslModeAndEscapedPassword(string scheme)
    {
        var cs = PostgresConnectionString.Normalize(
            $"{scheme}neon_user:p%40ss%3Bword@ep-cool-name.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");

        var b = new NpgsqlConnectionStringBuilder(cs);
        b.Host.Should().Be("ep-cool-name.sa-east-1.aws.neon.tech");
        b.Port.Should().Be(5432);
        b.Database.Should().Be("neondb");
        b.Username.Should().Be("neon_user");
        b.Password.Should().Be("p@ss;word");
        b.SslMode.Should().Be(SslMode.Require);
    }

    [Fact]
    public void UriFormat_KeepsExplicitPort()
    {
        var b = new NpgsqlConnectionStringBuilder(
            PostgresConnectionString.Normalize("postgresql://u:p@db.example.com:6543/postgres"));
        b.Port.Should().Be(6543);
        b.Database.Should().Be("postgres");
    }
}
