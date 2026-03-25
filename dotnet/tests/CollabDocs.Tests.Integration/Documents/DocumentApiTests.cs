using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CollabDocs.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace CollabDocs.Tests.Integration.Documents;

/// <summary>
/// End-to-end integration tests for the Documents API.
/// Each test gets a fresh authenticated client; the PostgreSQL container
/// and EF migrations are shared for the whole test class collection.
/// </summary>
[Collection("Integration")]
public class DocumentApiTests(CollabDocsWebFactory factory) : IClassFixture<CollabDocsWebFactory>
{
    private static readonly JsonSerializerOptions _json = new()
    {
        PropertyNameCaseInsensitive = true
    };

    // -----------------------------------------------------------------------
    // POST /api/documents
    // -----------------------------------------------------------------------

    [Fact]
    public async Task PostDocument_ShouldReturn201_WithDocumentData()
    {
        // Arrange
        var client = factory.CreateAuthenticatedClient();
        var body = new { title = "My Integration Doc", content = "Hello world" };

        // Act
        var response = await client.PostAsJsonAsync("/api/documents", body);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull("Created response must include Location header");

        var json = await ParseResponseAsync(response);
        var doc = json.GetProperty("document");

        doc.GetProperty("title").GetString().Should().Be("My Integration Doc");
        doc.GetProperty("content").GetString().Should().Be("Hello world");
        doc.GetProperty("owner_id").GetString().Should().Be(CollabDocsWebFactory.TestUserId);
        doc.GetProperty("version").GetInt32().Should().Be(1);
        doc.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
    }

    // -----------------------------------------------------------------------
    // GET /api/documents
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetDocuments_ShouldReturnUserDocuments()
    {
        // Arrange — create a document first so the list is non-empty
        var client = factory.CreateAuthenticatedClient(
            userId: "list-test-user",
            email: "list@integration.com",
            name: "List Test User");

        await client.PostAsJsonAsync("/api/documents", new { title = "List Doc 1" });
        await client.PostAsJsonAsync("/api/documents", new { title = "List Doc 2" });

        // Act
        var response = await client.GetAsync("/api/documents");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await ParseResponseAsync(response);
        var count = json.GetProperty("count").GetInt32();
        count.Should().BeGreaterThanOrEqualTo(2);

        var documents = json.GetProperty("documents").EnumerateArray().ToList();
        documents.Should().HaveCountGreaterThanOrEqualTo(2);
        documents.All(d => d.GetProperty("owner_id").GetString() == "list-test-user")
            .Should().BeTrue("list must only return documents owned by or shared with the caller");
    }

    // -----------------------------------------------------------------------
    // GET /api/documents/{id}
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetDocumentById_ShouldReturnDocument()
    {
        // Arrange
        var client = factory.CreateAuthenticatedClient(
            userId: "get-by-id-user",
            email: "getbyid@integration.com",
            name: "GetById User");

        var created = await CreateDocumentAsync(client, "GetById Doc", "Some content");
        var id = created.GetProperty("id").GetString()!;

        // Act
        var response = await client.GetAsync($"/api/documents/{id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await ParseResponseAsync(response);
        var doc = json.GetProperty("document");
        doc.GetProperty("id").GetString().Should().Be(id);
        doc.GetProperty("title").GetString().Should().Be("GetById Doc");
        doc.GetProperty("content").GetString().Should().Be("Some content");
    }

    [Fact]
    public async Task GetDocumentById_WithUnknownId_ShouldReturn404()
    {
        // Arrange
        var client = factory.CreateAuthenticatedClient();
        var unknownId = Guid.NewGuid();

        // Act
        var response = await client.GetAsync($"/api/documents/{unknownId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // -----------------------------------------------------------------------
    // PUT /api/documents/{id}
    // -----------------------------------------------------------------------

    [Fact]
    public async Task PutDocument_ShouldUpdateDocumentAndBumpVersion()
    {
        // Arrange
        var client = factory.CreateAuthenticatedClient(
            userId: "update-user",
            email: "update@integration.com",
            name: "Update User");

        var created = await CreateDocumentAsync(client, "Original Title", "Original content");
        var id = created.GetProperty("id").GetString()!;
        var version = created.GetProperty("version").GetInt32();

        // Act
        var updateBody = new
        {
            title = "Updated Title",
            content = "Updated content",
            expectedVersion = version
        };
        var response = await client.PutAsJsonAsync($"/api/documents/{id}", updateBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await ParseResponseAsync(response);
        var doc = json.GetProperty("document");
        doc.GetProperty("title").GetString().Should().Be("Updated Title");
        doc.GetProperty("content").GetString().Should().Be("Updated content");
        doc.GetProperty("version").GetInt32().Should().Be(version + 1,
            "every successful update must increment the optimistic concurrency version");
    }

    [Fact]
    public async Task PutDocument_WithWrongExpectedVersion_ShouldReturn409()
    {
        // Arrange
        var client = factory.CreateAuthenticatedClient(
            userId: "conflict-user",
            email: "conflict@integration.com",
            name: "Conflict User");

        var created = await CreateDocumentAsync(client, "Conflict Doc", "Content v1");
        var id = created.GetProperty("id").GetString()!;

        // Act — send a stale version number
        var staleVersion = 999;
        var updateBody = new
        {
            title = "Should Fail",
            content = "Should not persist",
            expectedVersion = staleVersion
        };
        var response = await client.PutAsJsonAsync($"/api/documents/{id}", updateBody);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict,
            "optimistic concurrency violation must return 409 Conflict");
    }

    // -----------------------------------------------------------------------
    // DELETE /api/documents/{id}
    // -----------------------------------------------------------------------

    [Fact]
    public async Task DeleteDocument_ShouldReturn204_AndDocumentShouldBeGone()
    {
        // Arrange
        var client = factory.CreateAuthenticatedClient(
            userId: "delete-user",
            email: "delete@integration.com",
            name: "Delete User");

        var created = await CreateDocumentAsync(client, "To Be Deleted", "Delete me");
        var id = created.GetProperty("id").GetString()!;

        // Act
        var deleteResponse = await client.DeleteAsync($"/api/documents/{id}");

        // Assert — delete returns 204
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // A subsequent GET must return 404
        var getResponse = await client.GetAsync($"/api/documents/{id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "deleted document must no longer be accessible");
    }

    // -----------------------------------------------------------------------
    // Visibility: public documents are visible cross-user
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetDocuments_PublicDocumentFromAnotherUser_ShouldAppearInList()
    {
        // Arrange — User A creates a public document
        var userA = factory.CreateAuthenticatedClient(
            userId: "visibility-user-a",
            email: "userA@visibility.com",
            name: "User A");

        var userB = factory.CreateAuthenticatedClient(
            userId: "visibility-user-b",
            email: "userB@visibility.com",
            name: "User B");

        var createBody = new { title = "Public Doc From A", content = "Visible to all", visibility = "public" };
        var createResponse = await userA.PostAsJsonAsync("/api/documents", createBody);
        createResponse.EnsureSuccessStatusCode();
        var created = await ParseResponseAsync(createResponse);
        var publicDocId = created.GetProperty("document").GetProperty("id").GetString()!;

        var privateBody = new { title = "Private Doc From A", content = "Only A sees this", visibility = "private" };
        await userA.PostAsJsonAsync("/api/documents", privateBody);

        // Act — User B lists documents
        var response = await userB.GetAsync("/api/documents");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await ParseResponseAsync(response);
        var documents = json.GetProperty("documents").EnumerateArray().ToList();

        documents.Should().Contain(d => d.GetProperty("id").GetString() == publicDocId,
            "public documents from other users must appear in the list");

        documents.Should().NotContain(d =>
            d.GetProperty("owner_id").GetString() == "visibility-user-a" &&
            d.GetProperty("visibility").GetString() == "private",
            "private documents from other users must not appear in the list");

        var publicDoc = documents.First(d => d.GetProperty("id").GetString() == publicDocId);
        publicDoc.GetProperty("is_owner").GetBoolean().Should().BeFalse(
            "User B is not the owner of User A's document");
    }

    // -----------------------------------------------------------------------
    // Unauthenticated requests
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetDocuments_WithoutToken_ShouldReturn401()
    {
        // Arrange — raw client, no auth header
        var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/documents");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private static async Task<JsonElement> ParseResponseAsync(HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(content).RootElement;
    }

    private static async Task<JsonElement> CreateDocumentAsync(
        HttpClient client,
        string title,
        string? content = null)
    {
        var body = content is null
            ? new { title, content = (string?)null }
            : new { title, content = (string?)content };

        var response = await client.PostAsJsonAsync("/api/documents", body);
        response.EnsureSuccessStatusCode();

        var json = await ParseResponseAsync(response);
        return json.GetProperty("document");
    }
}
