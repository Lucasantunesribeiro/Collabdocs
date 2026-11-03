using CollabDocs.Domain.Authorization;
using CollabDocs.Domain.Entities;
using CollabDocs.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace CollabDocs.Tests.Unit.Authorization;

public class DocumentAccessPolicyTests
{
    private static Document Doc(Visibility v = Visibility.Private) => Document.Create("owner-1", "T", "C", v);

    private static DocumentCollaborator Collab(Document d, string email, Permission p, string userId = "") =>
        new() { DocumentId = d.Id, UserEmail = email, UserId = userId, Permission = p };

    // ── ResolveRole ─────────────────────────────────────────────────────────────

    [Fact]
    public void Owner_IsResolvedByOwnerId()
        => DocumentAccessPolicy.ResolveRole(Doc(), "owner-1", "x@y.com", []).Should().Be(DocumentRole.Owner);

    [Fact]
    public void Stranger_OnPrivateDoc_HasNoRole()
        => DocumentAccessPolicy.ResolveRole(Doc(), "stranger", "s@y.com", []).Should().Be(DocumentRole.None);

    [Fact]
    public void Stranger_OnPublicDoc_IsPublicReader()
        => DocumentAccessPolicy.ResolveRole(Doc(Visibility.Public), "stranger", "s@y.com", [])
            .Should().Be(DocumentRole.PublicReader);

    [Theory]
    [InlineData(Permission.Viewer, DocumentRole.Viewer)]
    [InlineData(Permission.Editor, DocumentRole.Editor)]
    [InlineData(Permission.Owner, DocumentRole.Editor)] // linha legada não concede posse
    public void Collaborator_MatchedByEmail_CaseInsensitive(Permission p, DocumentRole expected)
    {
        var d = Doc();
        DocumentAccessPolicy.ResolveRole(d, "uid", "COLLAB@Example.com", [Collab(d, "collab@example.com", p)])
            .Should().Be(expected);
    }

    [Fact]
    public void Collaborator_MatchedByUserId()
    {
        var d = Doc();
        DocumentAccessPolicy.ResolveRole(d, "uid-7", "", [Collab(d, "other@example.com", Permission.Editor, "uid-7")])
            .Should().Be(DocumentRole.Editor);
    }

    [Fact]
    public void EmptyEmail_And_EmptyUserId_NeverMatchCollaborators()
    {
        var d = Doc();
        // Convites por e-mail têm UserId vazio; um token sem e-mail não pode "casar" com eles.
        DocumentAccessPolicy.ResolveRole(d, "", "", [Collab(d, "", Permission.Editor, "")])
            .Should().Be(DocumentRole.None);
    }

    [Fact]
    public void CollaboratorRowOfAnotherDocument_IsIgnored()
    {
        var d = Doc();
        var foreign = new DocumentCollaborator { DocumentId = Guid.NewGuid(), UserEmail = "c@x.com", Permission = Permission.Editor };
        DocumentAccessPolicy.ResolveRole(d, "uid", "c@x.com", [foreign]).Should().Be(DocumentRole.None);
    }

    [Fact]
    public void HighestPermission_WinsWhenUserMatchesSeveralRows()
    {
        var d = Doc();
        DocumentAccessPolicy.ResolveRole(d, "uid", "c@x.com",
            [Collab(d, "c@x.com", Permission.Viewer), Collab(d, "other@x.com", Permission.Editor, "uid")])
            .Should().Be(DocumentRole.Editor);
    }

    // ── Matriz papel x operação ──────────────────────────────────────────────────

    public static TheoryData<DocumentRole, DocumentOperation, bool> Matrix()
    {
        var allowed = new Dictionary<DocumentOperation, DocumentRole[]>
        {
            [DocumentOperation.Read]                = [DocumentRole.PublicReader, DocumentRole.Viewer, DocumentRole.Editor, DocumentRole.Owner],
            [DocumentOperation.ConnectRealtime]     = [DocumentRole.PublicReader, DocumentRole.Viewer, DocumentRole.Editor, DocumentRole.Owner],
            [DocumentOperation.ListCollaborators]   = [DocumentRole.Viewer, DocumentRole.Editor, DocumentRole.Owner],
            [DocumentOperation.EditContent]         = [DocumentRole.Editor, DocumentRole.Owner],
            [DocumentOperation.Rename]              = [DocumentRole.Editor, DocumentRole.Owner],
            [DocumentOperation.SendRealtimeUpdate]  = [DocumentRole.Editor, DocumentRole.Owner],
            [DocumentOperation.ChangeVisibility]    = [DocumentRole.Owner],
            [DocumentOperation.Delete]              = [DocumentRole.Owner],
            [DocumentOperation.ManageCollaborators] = [DocumentRole.Owner],
        };

        var data = new TheoryData<DocumentRole, DocumentOperation, bool>();
        foreach (var role in Enum.GetValues<DocumentRole>())
        foreach (var op in Enum.GetValues<DocumentOperation>())
            data.Add(role, op, allowed[op].Contains(role));
        return data;
    }

    [Theory]
    [MemberData(nameof(Matrix))]
    public void Can_FollowsMatrix(DocumentRole role, DocumentOperation op, bool expected)
        => DocumentAccessPolicy.Can(role, op).Should().Be(expected);

    [Theory]
    [InlineData(DocumentRole.Owner, "owner")]
    [InlineData(DocumentRole.Editor, "write")]
    [InlineData(DocumentRole.Viewer, "read")]
    [InlineData(DocumentRole.PublicReader, "read")]
    [InlineData(DocumentRole.None, null)]
    public void ToApiPermission_MapsRoles(DocumentRole role, string? expected)
        => DocumentAccessPolicy.ToApiPermission(role).Should().Be(expected);
}
