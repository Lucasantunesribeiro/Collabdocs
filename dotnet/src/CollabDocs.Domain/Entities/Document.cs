using CollabDocs.Domain.Enums;

namespace CollabDocs.Domain.Entities;

public class Document
{
    public Guid Id { get; private set; }
    public string OwnerId { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string Content { get; private set; } = string.Empty;
    public Visibility Visibility { get; private set; }
    public int Version { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private Document() { }

    public static Document Create(string ownerId, string title, string content, Visibility visibility)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(ownerId);
        ArgumentException.ThrowIfNullOrWhiteSpace(title);

        return new Document
        {
            Id = Guid.NewGuid(),
            OwnerId = ownerId,
            Title = title,
            Content = content,
            Visibility = visibility,
            Version = 1,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    public void Update(string? content, string? title)
    {
        if (content is not null) Content = content;
        if (title is not null) Title = title;
        Version++;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool CanEdit(string userId, IEnumerable<DocumentCollaborator> collaborators)
    {
        if (OwnerId == userId) return true;
        return collaborators.Any(c =>
            (c.UserId == userId) &&
            (c.Permission == Permission.Editor || c.Permission == Permission.Owner));
    }

    public bool CanView(string userId, IEnumerable<DocumentCollaborator> collaborators)
    {
        if (Visibility == Visibility.Public) return true;
        if (OwnerId == userId) return true;
        return collaborators.Any(c => c.UserId == userId);
    }
}
