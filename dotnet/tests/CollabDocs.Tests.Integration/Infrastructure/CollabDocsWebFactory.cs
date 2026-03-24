using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CollabDocs.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Testcontainers.PostgreSql;
using Xunit;

namespace CollabDocs.Tests.Integration.Infrastructure;

/// <summary>
/// WebApplicationFactory that spins up a real PostgreSQL container via TestContainers,
/// runs EF Core migrations, and provides an authenticated HTTP client.
/// RabbitMQ background services are disabled to keep tests fast and avoid connectivity issues.
/// </summary>
public class CollabDocsWebFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string TestJwtSecret = "test-secret-for-integration-tests-minimum-32-chars";
    public const string TestUserId = "integration-test-user-id";
    public const string TestUserEmail = "test@integration.com";
    public const string TestUserName = "Integration Test User";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("collabdocs_test")
        .WithUsername("testuser")
        .WithPassword("testpassword")
        .Build();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
    }

    public new async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        // UseSetting injects values directly into IConfiguration with highest precedence,
        // ensuring Program.cs reads our test secret and connection string during host construction.
        builder.UseSetting("Jwt:Secret", TestJwtSecret);
        builder.UseSetting("ConnectionStrings:Default", _postgres.GetConnectionString());
        builder.UseSetting("RabbitMQ:Host", "localhost");
        builder.UseSetting("RabbitMQ:Port", "5672");
        builder.UseSetting("RabbitMQ:Username", "guest");
        builder.UseSetting("RabbitMQ:Password", "guest");
        builder.UseSetting("RabbitMQ:VirtualHost", "/");
        builder.UseSetting("RabbitMQ:ExchangeName", "collabdocs");
        builder.UseSetting("RabbitMQ:QueueName", "collabdocs.events");

        builder.ConfigureServices(services =>
        {
            // Remove all IHostedService registrations (OutboxPublisherService + DocumentEventConsumer)
            // to prevent RabbitMQ connection attempts during tests.
            var hostedServices = services
                .Where(d => d.ServiceType == typeof(IHostedService))
                .ToList();
            foreach (var descriptor in hostedServices)
            {
                services.Remove(descriptor);
            }

            // Replace the EF Core DbContext to ensure it targets the test PostgreSQL container.
            var dbContextDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
            if (dbContextDescriptor is not null)
                services.Remove(dbContextDescriptor);

            services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(_postgres.GetConnectionString()));

            // Run EF Core migrations so the schema is ready before tests execute.
            var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Database.Migrate();
        });
    }

    /// <summary>
    /// Creates an HttpClient with a valid JWT Bearer token for the default test user.
    /// </summary>
    public HttpClient CreateAuthenticatedClient(
        string? userId = null,
        string? email = null,
        string? name = null)
    {
        var client = CreateClient();
        var token = GenerateJwt(
            userId ?? TestUserId,
            email ?? TestUserEmail,
            name ?? TestUserName);
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>
    /// Generates a JWT signed with the test secret, matching the payload shape that
    /// NextAuth produces: { sub, email, name }.
    /// </summary>
    public static string GenerateJwt(string userId, string email, string name)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim("name", name),
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
