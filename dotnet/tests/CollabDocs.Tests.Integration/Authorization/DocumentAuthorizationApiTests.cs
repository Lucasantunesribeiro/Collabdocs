using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CollabDocs.Tests.Integration.Infrastructure;
using FluentAssertions;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace CollabDocs.Tests.Integration.Authorization;

/// <summary>
/// Autorização por documento ponta a ponta (HTTP + JWT + PostgreSQL real).
/// Cobre: privado por padrão, 404 para quem não tem acesso (anti-IDOR),
/// 403 para quem lê mas não pode executar, e regras de colaboradores.
/// </summary>
[Collection("Integration")]
public class DocumentAuthorizationApiTests(CollabDocsWebFactory factory) : IClassFixture<CollabDocsWebFactory>
{
    private sealed record Users(HttpClient Owner, HttpClient Editor, HttpClient Viewer, HttpClient Stranger,
        string EditorEmail, string ViewerEmail);

    private Users NewUsers()
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        var editorEmail = $"editor-{tag}@authz.test";
        var viewerEmail = $"viewer-{tag}@authz.test";
        return new Users(
            factory.CreateAuthenticatedClient($"owner-{tag}", $"owner-{tag}@authz.test", "Owner"),
            // E-mail do token em maiúsculas: o vínculo por e-mail não pode depender de caixa.
            factory.CreateAuthenticatedClient($"editor-{tag}", editorEmail.ToUpperInvariant(), "Editor"),
            factory.CreateAuthenticatedClient($"viewer-{tag}", viewerEmail, "Viewer"),
            factory.CreateAuthenticatedClient($"stranger-{tag}", $"stranger-{tag}@authz.test", "Stranger"),
            editorEmail, viewerEmail);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage r) =>
        JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

    private static async Task<string> CreateDoc(HttpClient client, string? visibility = null)
    {
        object body = visibility is null
            ? new { title = "Authz Doc", content = "segredo" }
            : new { title = "Authz Doc", content = "segredo", visibility };
        var r = await client.PostAsJsonAsync("/api/documents", body);
        r.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await Json(r)).GetProperty("document").GetProperty("id").GetString()!;
    }

    private static async Task Share(HttpClient owner, string id, string email, string permission)
    {
        var r = await owner.PostAsJsonAsync($"/api/documents/{id}/collaborators", new { email, permission });
        r.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    private async Task<(Users u, string id)> PrivateDocWithCollaborators()
    {
        var u = NewUsers();
        var id = await CreateDoc(u.Owner);
        await Share(u.Owner, id, u.EditorEmail, "write");
        await Share(u.Owner, id, u.ViewerEmail, "read");
        return (u, id);
    }

    [Fact]
    public async Task NewDocument_IsPrivateByDefault_AndHiddenFromStrangers()
    {
        var u = NewUsers();
        var id = await CreateDoc(u.Owner);

        var own = await Json(await u.Owner.GetAsync($"/api/documents/{id}"));
        own.GetProperty("document").GetProperty("visibility").GetString().Should().Be("private");
        own.GetProperty("document").GetProperty("permission").GetString().Should().Be("owner");

        var list = await Json(await u.Stranger.GetAsync("/api/documents"));
        list.GetProperty("documents").EnumerateArray()
            .Should().NotContain(d => d.GetProperty("id").GetString() == id);
    }

    [Fact]
    public async Task Stranger_GetsSame404_ForPrivateDocAndForUnknownId()
    {
        var u = NewUsers();
        var id = await CreateDoc(u.Owner);

        var requests = new Func<string, Task<HttpResponseMessage>>[]
        {
            x => u.Stranger.GetAsync($"/api/documents/{x}"),
            x => u.Stranger.PutAsJsonAsync($"/api/documents/{x}", new { content = "pwned" }),
            x => u.Stranger.PutAsJsonAsync($"/api/documents/{x}", new { visibility = "public" }),
            x => u.Stranger.DeleteAsync($"/api/documents/{x}"),
            x => u.Stranger.GetAsync($"/api/documents/{x}/collaborators"),
            x => u.Stranger.PostAsJsonAsync($"/api/documents/{x}/collaborators", new { email = "me@evil.test", permission = "write" }),
        };

        foreach (var send in requests)
        {
            var existing = await send(id);
            var unknown = await send(Guid.NewGuid().ToString());
            existing.StatusCode.Should().Be(HttpStatusCode.NotFound);
            unknown.StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await existing.Content.ReadAsStringAsync()).Should().Be(await unknown.Content.ReadAsStringAsync(),
                "o corpo não pode diferenciar 'existe mas é privado' de 'não existe'");
        }

        var after = await Json(await u.Owner.GetAsync($"/api/documents/{id}"));
        after.GetProperty("document").GetProperty("content").GetString().Should().Be("segredo");
        after.GetProperty("document").GetProperty("visibility").GetString().Should().Be("private");
    }

    [Fact]
    public async Task Collaborators_InvitedByEmail_CanAccessPrivateDoc_WithTheirRole()
    {
        var (u, id) = await PrivateDocWithCollaborators();

        var editorView = await u.Editor.GetAsync($"/api/documents/{id}");
        editorView.StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(editorView)).GetProperty("document").GetProperty("permission").GetString().Should().Be("write");

        var viewerView = await u.Viewer.GetAsync($"/api/documents/{id}");
        viewerView.StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(viewerView)).GetProperty("document").GetProperty("permission").GetString().Should().Be("read");

        var list = await Json(await u.Editor.GetAsync("/api/documents"));
        list.GetProperty("documents").EnumerateArray()
            .Should().Contain(d => d.GetProperty("id").GetString() == id);
    }

    [Fact]
    public async Task Viewer_CannotWrite_Gets403()
    {
        var (u, id) = await PrivateDocWithCollaborators();

        (await u.Viewer.PutAsJsonAsync($"/api/documents/{id}", new { content = "x" })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await u.Viewer.PutAsJsonAsync($"/api/documents/{id}", new { title = "x" })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await u.Viewer.DeleteAsync($"/api/documents/{id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var doc = await Json(await u.Owner.GetAsync($"/api/documents/{id}"));
        doc.GetProperty("document").GetProperty("content").GetString().Should().Be("segredo");
    }

    [Fact]
    public async Task Editor_CanEditAndRename_ButNotDeleteNorChangeVisibility()
    {
        var (u, id) = await PrivateDocWithCollaborators();

        (await u.Editor.PutAsJsonAsync($"/api/documents/{id}", new { content = "editado", title = "Renomeado" }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await u.Editor.PutAsJsonAsync($"/api/documents/{id}", new { visibility = "public" }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await u.Editor.DeleteAsync($"/api/documents/{id}"))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var doc = (await Json(await u.Owner.GetAsync($"/api/documents/{id}"))).GetProperty("document");
        doc.GetProperty("content").GetString().Should().Be("editado");
        doc.GetProperty("title").GetString().Should().Be("Renomeado");
        doc.GetProperty("visibility").GetString().Should().Be("private");
    }

    [Fact]
    public async Task Collaborators_CannotManageCollaborators_NorPromoteThemselves()
    {
        var (u, id) = await PrivateDocWithCollaborators();

        (await u.Viewer.PostAsJsonAsync($"/api/documents/{id}/collaborators", new { email = u.ViewerEmail, permission = "write" }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await u.Editor.PostAsJsonAsync($"/api/documents/{id}/collaborators", new { email = u.EditorEmail, permission = "owner" }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var removeReq = new HttpRequestMessage(HttpMethod.Delete, $"/api/documents/{id}/collaborators")
        { Content = JsonContent.Create(new { email = u.ViewerEmail }) };
        (await u.Editor.SendAsync(removeReq)).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var viewer = (await Json(await u.Viewer.GetAsync($"/api/documents/{id}"))).GetProperty("document");
        viewer.GetProperty("permission").GetString().Should().Be("read");
    }

    [Fact]
    public async Task Owner_ShareRules_OwnerPermissionRejected_ReinviteUpdates_RemoveRevokes()
    {
        var (u, id) = await PrivateDocWithCollaborators();

        (await u.Owner.PostAsJsonAsync($"/api/documents/{id}/collaborators", new { email = "x@authz.test", permission = "owner" }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Reconvidar o mesmo e-mail (outra caixa) atualiza a permissão em vez de dar 500.
        await Share(u.Owner, id, u.ViewerEmail.ToUpperInvariant(), "write");
        (await Json(await u.Viewer.GetAsync($"/api/documents/{id}")))
            .GetProperty("document").GetProperty("permission").GetString().Should().Be("write");

        var collabs = await Json(await u.Owner.GetAsync($"/api/documents/{id}/collaborators"));
        collabs.GetProperty("total").GetInt32().Should().Be(2);

        var removeReq = new HttpRequestMessage(HttpMethod.Delete, $"/api/documents/{id}/collaborators")
        { Content = JsonContent.Create(new { email = u.ViewerEmail }) };
        (await u.Owner.SendAsync(removeReq)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await u.Viewer.GetAsync($"/api/documents/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task PublicDoc_StrangerCanRead_ButNotWrite_AndSeesNoCollaborators()
    {
        var u = NewUsers();
        var id = await CreateDoc(u.Owner, "public");
        await Share(u.Owner, id, u.EditorEmail, "write");

        var read = await u.Stranger.GetAsync($"/api/documents/{id}");
        read.StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(read)).GetProperty("document").GetProperty("permission").GetString().Should().Be("read");

        (await u.Stranger.PutAsJsonAsync($"/api/documents/{id}", new { content = "x" })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await u.Stranger.DeleteAsync($"/api/documents/{id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var collabs = await Json(await u.Stranger.GetAsync($"/api/documents/{id}/collaborators"));
        collabs.GetProperty("total").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task Owner_CanMakeDocPrivate_AndStrangerLosesAccess()
    {
        var u = NewUsers();
        var id = await CreateDoc(u.Owner, "public");
        (await u.Stranger.GetAsync($"/api/documents/{id}")).StatusCode.Should().Be(HttpStatusCode.OK);

        (await u.Owner.PutAsJsonAsync($"/api/documents/{id}", new { visibility = "private" }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        (await u.Stranger.GetAsync($"/api/documents/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task InvalidVisibility_Returns400()
    {
        var u = NewUsers();
        var id = await CreateDoc(u.Owner);
        (await u.Owner.PutAsJsonAsync($"/api/documents/{id}", new { visibility = "everyone" }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Editor_CannotRemoveOrDemoteTheOwner()
    {
        var (u, id) = await PrivateDocWithCollaborators();
        // NewUsers: "editor-{tag}@authz.test" => dono é "owner-{tag}@authz.test".
        var ownerEmail = u.EditorEmail.Replace("editor-", "owner-");

        var removeOwner = new HttpRequestMessage(HttpMethod.Delete, $"/api/documents/{id}/collaborators")
        { Content = JsonContent.Create(new { email = ownerEmail }) };
        (await u.Editor.SendAsync(removeOwner)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await u.Editor.PostAsJsonAsync($"/api/documents/{id}/collaborators", new { email = ownerEmail, permission = "read" }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var own = (await Json(await u.Owner.GetAsync($"/api/documents/{id}"))).GetProperty("document");
        own.GetProperty("permission").GetString().Should().Be("owner");
        own.GetProperty("is_owner").GetBoolean().Should().BeTrue();
    }

    public static TheoryData<string> RejectedTokens => new()
    {
        "sem-exp",
        "expirado",
        "hs384",
    };

    [Theory]
    [MemberData(nameof(RejectedTokens))]
    public async Task InvalidTokens_Get401_EvenForPublicDocs(string kind)
    {
        var u = NewUsers();
        var id = await CreateDoc(u.Owner, "public");

        var token = kind switch
        {
            "sem-exp"  => CollabDocsWebFactory.GenerateJwt("x-user", "x@authz.test", "X", null, SecurityAlgorithms.HmacSha256),
            "expirado" => CollabDocsWebFactory.GenerateJwt("x-user", "x@authz.test", "X", DateTime.UtcNow.AddHours(-1), SecurityAlgorithms.HmacSha256),
            _          => CollabDocsWebFactory.GenerateJwt("x-user", "x@authz.test", "X", DateTime.UtcNow.AddHours(1), SecurityAlgorithms.HmacSha384),
        };
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        (await client.GetAsync($"/api/documents/{id}")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
