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
        if (title is not null)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(title);
            if (title.Length > 255)
                throw new ArgumentException("Title must be at most 255 characters", nameof(title));
        }
        if (content is not null) Content = content;
        if (title is not null) Title = title;
        Version++;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ChangeVisibility(Visibility visibility)
    {
        if (Visibility == visibility) return;
        Visibility = visibility;
        Version++;
        UpdatedAt = DateTime.UtcNow;
    }

    // Regras de acesso ficam em CollabDocs.Domain.Authorization.DocumentAccessPolicy.
}
